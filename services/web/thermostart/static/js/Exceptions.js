var ts = window.ts || {};

ts.EXCEPTIONS_RESOLUTION = 4;       // 4 = every 15 minutes, 2 = every 30 minutes, 1 = every hour
ts.EXCEPTIONS_ROWS = ts.EXCEPTIONS_RESOLUTION * 24;

ts.initializeExceptions = function(thermostat, $scheduleContainer, $stencilContainer, opts) {

    opts = opts || {};

    // `selectedDate` holds the currently selected date from the datepicker.
    var selectedDate = new Date;
    
    // Initialize schedule view.
    // -------------------------

    function getTopbar(selectedDate) {

        var weekDate = moment(selectedDate).isoWeekday(1);
        var weekdaysShort = i18n['weekdaysShort'];
        
        return _.map(weekdaysShort, function(dayName) {
            var item = dayName + ' ' + weekDate.format('DD-MM');
            weekDate = weekDate.add('days', 1);
            return item;
        });
    }
    
    var scheduleView = new ts.ScheduleView({
        model: new (ts.ExceptionsCollection.extend({
            blockMinSize: ts.EXCEPTIONS_RESOLUTION
        })),
        columnWidth: (opts.width || 600) / 7,
        rows: ts.EXCEPTIONS_ROWS,
        rowHeight: (opts.height || 550) / ts.EXCEPTIONS_ROWS,
        blockSmallSize: ts.EXCEPTIONS_RESOLUTION,
        linesDensity: ts.EXCEPTIONS_RESOLUTION,
        horizontalGap: 12,
        verticalGap: 2,
        topbar: getTopbar(selectedDate)
    });
    $scheduleContainer.append(scheduleView.render().el);

    thermostat.on('change:utc_offset', function() {

        // Mark current day in the topbar.
        var weekDay = thermostat.getCurrentMoment().isoWeekday();

        scheduleView.$('.topbar li.current-day').removeClass('current-day');
        scheduleView.$('.topbar li:nth-child(' + weekDay + ')').addClass('current-day');
    });

    // This array holds exceptions, that are not displayed in the schedule view (in the DB format).
    // Those are then merged with the displayed exception when exceptions are saved to the thermostat model.
    var notDisplayedExceptions = [];


    // Re-render schedule view when standard_week or predefined_temperature changes.
    // -----------------------------------------------------------------------------
    
    thermostat.on('change:standard_week change:exceptions change:predefined_temperatures', function() {

        // Delay rendering of the schedule view so that we don't block the UI.
        _.delay(function() {

            var stdWeekBlocks = ts.createBlocksFromStandardWeek(thermostat.get('standard_week'), thermostat.get('predefined_temperatures'), 'background');
            var exceptions = ts.createBlocksFromExceptions(thermostat.get('exceptions'), thermostat.get('predefined_temperatures'), selectedDate);
            notDisplayedExceptions = exceptions.rest;
            scheduleView.model.clean();
            scheduleView.model.add(stdWeekBlocks);
            scheduleView.model.add(exceptions.blocks);
            
        }, 200);
    });

    // Initialize date picker and re-render schedule view if the selected date changes.
    // --------------------------------------------------------------------------------

    $.datepicker.setDefaults(i18n['datepicker']);

    $('#datepicker').datepicker({
        
        onSelect: function(dateText, datepicker) {
            
            var parsed = dateText.split('-');
            var year = parseInt(parsed[2], 10);
            var month = parseInt(parsed[1], 10) - 1;
            var date = parseInt(parsed[0], 10);

            selectedDate = new Date(year, month, date);

            // Re-render the scheduleView so that the topbar contains the selected dates.
            scheduleView.options.topbar = getTopbar(selectedDate);
            scheduleView.render();

            var stdWeekBlocks = ts.createBlocksFromStandardWeek(thermostat.get('standard_week'), thermostat.get('predefined_temperatures'), 'background');
            var exceptions = ts.createBlocksFromExceptions(thermostat.get('exceptions'), thermostat.get('predefined_temperatures'), selectedDate);
            notDisplayedExceptions = exceptions.rest;
            scheduleView.model.clean();
            scheduleView.model.add(stdWeekBlocks);
            scheduleView.model.add(exceptions.blocks);
        },

        beforeShowDay: function (date) {

            // We are changing the shown day here approximately to the noon.
            // This way we can easily compare it with start or end of another day.
            var shownDay = moment(date).set('hour', 12);

            var containsException = _.find(thermostat.get('exceptions'), function(e) {
                var start = moment(e.start.slice(0,3)).startOf('day');
                var end = moment(e.end.slice(0,3)).endOf('day');
                return shownDay.isAfter(start) && shownDay.isBefore(end);
            });

            return containsException ? [true, "ui-state-active", "Exceptions"] : [true, ""];
        }

    });

    thermostat.on('change:exceptions', function() {
        $('#datepicker').datepicker('refresh');
    });

    // Save exceptions if there was a change in the schedule (convert it from ExceptionsCollection).
    // ---------------------------------------------------------------------------------------------

    var $tooltip = $('<label class="tooltip metric-tooltip"></label>').appendTo(document.body).css('position', 'fixed');

    scheduleView.model.on('change-block remove-block new-block', function() {

        // Merge the exceptions that were not displayed in the schedule view with those that were.
        var exceptions = notDisplayedExceptions.slice();

        // This is the date of Monday.
        //var dateWeekBegin = selectedDate.getDate() - selectedDate.getDay() + 1
        var dateWeekBegin = parseInt(moment(selectedDate).isoWeekday(1).format('D'), 10);
        
        scheduleView.model.each(function(block) {

            if (block.get('data') == 'background') return;

            var startMoment = moment(selectedDate).isoWeekday(1 + block.get('head').x);
            var endMoment = moment(selectedDate).isoWeekday(1 + block.get('tail').x);

            var tailY = block.get('tail').y;
            tailY += 1;
            
            exceptions.push({
                start: [
                    startMoment.get('year'),
                    startMoment.get('month'),
                    startMoment.get('date'),
                    Math.floor(block.get('head').y / ts.EXCEPTIONS_RESOLUTION),
                    ts.scheduleBlockYCoordinateToMinutes(block.get('head').y, ts.EXCEPTIONS_RESOLUTION)
                ],
                end: [
                    endMoment.get('year'),
                    endMoment.get('month'),
                    endMoment.get('date'),
                    Math.floor(tailY / ts.EXCEPTIONS_RESOLUTION),
                    ts.scheduleBlockYCoordinateToMinutes(tailY, ts.EXCEPTIONS_RESOLUTION)
                ],
                description: block.get('description'),
                temperature: block.get('type')
            });
        });

        thermostat.save({ exceptions: exceptions });

        $tooltip.hide();
    });
    
    scheduleView.on('adjust-block', function(block, evt) {

        var tailY = block.get('tail').y;
        tailY += 1;
        
        var startHour = Math.floor(block.get('head').y / ts.EXCEPTIONS_RESOLUTION);
        var startMinutes = ts.scheduleBlockYCoordinateToMinutes(block.get('head').y, ts.EXCEPTIONS_RESOLUTION);
        var endHour = Math.floor(tailY / ts.EXCEPTIONS_RESOLUTION);
        var endMinutes = ts.scheduleBlockYCoordinateToMinutes(tailY, ts.EXCEPTIONS_RESOLUTION);

        function pad(n) {
            if ((n + '').length === 1) return '0' + n;
            return n + '';
        }
        
        startHour = pad(startHour);
        endHour = pad(endHour);
        startMinutes = pad(startMinutes);
        endMinutes = pad(endMinutes);
        
        var tip = [
            startHour + ':' + startMinutes, '&nbsp;->&nbsp;',
            endHour + ':' + endMinutes
        ].join('');

        $tooltip.css({ top: evt.clientY + 20, left: evt.clientX + 20 }).attr('data-type', block.get('type')).html(tip).show();
    });

    // Initialize stencil with program buttons.
    // ----------------------------------------
    
    var stencilView = new ts.ScheduleStencil({
        scheduleView: scheduleView,
        freeDrop: true,
        newBlockSize: ts.EXCEPTIONS_RESOLUTION * 2 - 1,
        blocks: [
            { type: 'anti_freeze', label: i18n['program.anti_freeze'], value: '5.0', btnChangeLabel: '' },
            { type: 'not_home', label: i18n['program.not_home'], value: '15.0', btnChangeLabel: '' },
            { type: 'home', label: i18n['program.home'], value: '18.0', btnChangeLabel: '' },
            { type: 'comfort', label: i18n['program.comfort'], value: '21.5', btnChangeLabel: '' }
        ],
    });
    $stencilContainer.append(stencilView.render().el);

    // Re-render stencil if predefined_temperatures changes
    // -----------------------------------------------------
    
    thermostat.on('change:predefined_temperatures', function() {

        var predefinedTemperatures = thermostat.get('predefined_temperatures');
        _.each(stencilView.options.blocks, function(def) {

            def.value = predefinedTemperatures[def.type] / 10;
        });
        stencilView.render();
    });

    // Initialize dialogs for block changes and stencil changes.
    // ---------------------------------------------------------
    
    var blockEditDialog = new ExceptionsBlockEditDialog({ model: thermostat });

    scheduleView.on('edit-block', function(blockView) {

        var block = blockView.model;

        blockEditDialog.setSelectedTemperature(block.get('type'));
        blockEditDialog.setDescription(block.get('description') || '');
        blockEditDialog.blockViewModel = block;
        blockEditDialog.show();
    });

    blockEditDialog.on('ok', function() {

        var type = blockEditDialog.getSelectedTemperature();
        var description = blockEditDialog.getDescription();
        var label = (thermostat.get('predefined_temperatures')[type]) / 10 + '&deg;C' + '<br/>' + (description || '');
        var block = blockEditDialog.blockViewModel;
        block.set({ type: type, label: label, description: description });
        scheduleView.model.trigger('change-block');
    });

    // make dialogs accesible from outsite via scheduleView
    scheduleView.blockEditDialog = blockEditDialog;
    
    // Touch related controls of blocks.
    // ---------------------------------

    var $blockTouchControls = opts.touchControls || $('.exceptions-programs .touch-controls');
    $blockTouchControls.hide();
    scheduleView.on('block-touched', function(blockView) {
        scheduleView.$('.highlight').removeClass('highlight');
        blockView.$el.addClass('highlight');
        $blockTouchControls.data('block-view', blockView).show();
    });
    $blockTouchControls.find('.edit-button').on('touchstart', function(evt) {

        evt.preventDefault();
        evt.stopPropagation();

        var blockView = $(this).parent().data('block-view');
        scheduleView.trigger('edit-block', blockView);
    });
    $blockTouchControls.find('.remove-button').on('touchstart', function(evt) {

        evt.preventDefault();
        evt.stopPropagation();

        var blockView = $(this).parent().data('block-view');
        blockView.removeBlock();
    });
    scheduleView.model.on('change-block remove-block new-block', function() {
        $blockTouchControls.hide();
    });

    return scheduleView;
};

ts.createBlocksFromExceptions = function(exceptions, predefinedTemperatures, selectedDate, blockData, oneColumn) {

    var ret = { blocks: [], rest: [] };

    var year = selectedDate.getFullYear();
    var month = selectedDate.getMonth();
    var date = selectedDate.getDate();
    var day = selectedDate.getDay();
    var hours = selectedDate.getHours();
    var minutes = selectedDate.getMinutes();

    // We count Sunday as day `7` instead of `0`.
    if (day === 0) { day = 7; }

    // `start` and `end` gives us always one week time starting on Monday ending on Sunday.
    var start = new Date(year, month, date - day + 1, 0, 0, 0, 0);
    var end = moment(start).add('days', 7).toDate();

    _.each(exceptions, function(exception) {

        var exceptionStart = new Date(exception.start[0], exception.start[1], exception.start[2], exception.start[3], exception.start[4]);
        var exceptionEnd = new Date(exception.end[0], exception.end[1], exception.end[2], exception.end[3], exception.end[4]);

        if ((exceptionEnd > start && exceptionEnd <= end) ||
            (exceptionStart > start && exceptionStart < end)) {

            var head = { x: exceptionStart.getDay(), y: exceptionStart.getHours() * ts.EXCEPTIONS_RESOLUTION };
            var tail = { x: exceptionEnd.getDay(), y: exceptionEnd.getHours() * ts.EXCEPTIONS_RESOLUTION - 1 };

            // Add rows in case of `minutes > 0`.
            head.y += ts.scheduleMinutesToBlockOffset(exceptionStart.getMinutes(), ts.EXCEPTIONS_RESOLUTION);
            tail.y += ts.scheduleMinutesToBlockOffset(exceptionEnd.getMinutes(), ts.EXCEPTIONS_RESOLUTION);

            if (tail.y < 0) {
                // if tail ends at the start of the next day 00:00:00, change it to the end of the
                // previous day.
                tail.x = (tail.x + 6) % 7;
                tail.y = ts.EXCEPTIONS_ROWS - 1;
            }

            // Normalization. Sunday is counted as day `0`, but we have it in the last column.
            head.x = head.x === 0 ? 6 : head.x - 1;
            tail.x = tail.x === 0 ? 6 : tail.x - 1;

            if (oneColumn) {
                // Adjustment for one-column schedule:
                head.y = ts.EXCEPTIONS_ROWS * head.x + head.y;
                head.x = 0;
                tail.y = ts.EXCEPTIONS_ROWS * tail.x + tail.y;
                tail.x = 0;
            }
            
            var block = new ts.ScheduleBlock({
                head: head,
                tail: tail,
                type: exception.temperature,
                label: predefinedTemperatures && ((predefinedTemperatures[exception.temperature] / 10) + '&deg;C') + '<br/>' + (exception.description || ''),
                description: exception.description
            });
            if (blockData) {
                block.set('data', blockData);
            }
            ret.blocks.push(block);
            
        } else {

            ret.rest.push(exception);
        }
    });

    return ret;
};
