var ts = window.ts || {};

ts.STANDARD_WEEK_RESOLUTION = 4;       // 4 = every 15 minutes, 2 = every 30 minutes, 1 = every hour
ts.STANDARD_WEEK_ROWS = ts.STANDARD_WEEK_RESOLUTION * 24;

ts.createBlocksFromStandardWeek = function(stdWeek, predefinedTemperatures, blockData, oneColumn) {

    var blocks = [];
    if (!stdWeek || stdWeek.length === 0) return blocks;

    // Sort standard week by times.
    stdWeek = _.sortBy(stdWeek, function(item) {
        return item.start[0] * 100000 + item.start[1] * 1000 + item.start[2] * 1;
    });

    for (var i = 0; i < stdWeek.length; i++) {

        var item = stdWeek[i];
        var isLast = i === stdWeek.length - 1;
        var next = stdWeek[isLast ? 0 : i + 1];

        var head = { x: item.start[0], y: item.start[1] * ts.STANDARD_WEEK_RESOLUTION };

        // Add rows in case of `minutes > 0`.
        head.y += ts.scheduleMinutesToBlockOffset(item.start[2], ts.STANDARD_WEEK_RESOLUTION);
        // Add one row in case of `minutes === 30`.
        //if (item.start[2] > 0) { head.y += 1; }

        var tail = { x: next.start[0], y: next.start[1] * ts.STANDARD_WEEK_RESOLUTION - 1 };

        // Add one row in case of `minutes === 30`.
        //if (next.start[2] > 0) { tail.y += 1; }
        tail.y += ts.scheduleMinutesToBlockOffset(next.start[2], ts.STANDARD_WEEK_RESOLUTION);

        if (tail.y < 0) {
            // if tail ends at the start of the next day 00:00:00, change it to the end of the
            // previous day.
            tail.x = (tail.x + 6) % 7;
            tail.y = ts.STANDARD_WEEK_ROWS - 1;
        }

        if (oneColumn) {
            // Adjustment for one-column schedule:
            head.y = ts.STANDARD_WEEK_ROWS * head.x + head.y;
            head.x = 0;
            tail.y = ts.STANDARD_WEEK_ROWS * tail.x + tail.y;
            tail.x = 0;
        }

        var block = new ts.ScheduleBlock({
            head: head, tail: tail, type: item.temperature,
            label: predefinedTemperatures && ((predefinedTemperatures[item.temperature] / 10) + '&deg;C')
        });
        if (blockData) {
            block.set('data', blockData);
        }

        // We don't show 'pause' blocks. Those blocks only fill up the space
        // and are used as a 'base temperature'.
        if (item.temperature !== 'pause') {
            blocks.push(block);
        }
    }

    return blocks;
};

ts.initializeStandardWeek = function(thermostat, $scheduleContainer, $stencilContainer, opts) {

    opts = opts || {};
    // Initialize schedule view.
    // -------------------------

    var scheduleView = new ts.ScheduleView({
        model: new (ts.ExceptionsCollection.extend({
            isValidBlock: ts.StandardWeekCollection.prototype.isValidBlock,
            setBlock: function(block, gridPosition, end) {

                // If your head is spinning from the code below, don't worry, you're
                // not the only one. Author here.

                var before = this.getBlockBefore(block);
                var after = this.getBlockAfter(block);

                // console.log('before', JSON.stringify(before));
                // console.log('after', JSON.stringify(after));

                // Store the values we're gonna be changing so that
                // they can be possibly restored later.
                var blockEnd = block.get(end);

                // Set the block ends based on the grid position. Also
                // set the head/tail ends of the block before and after as those
                // are the only ones that can possibly get adjusted together with
                // the current block in operation.
                block.set(end, gridPosition);

                var issues = [];

                var blockHeadIdx = block.idx('head');
                var blockTailIdx = block.idx('tail');

                if (!this.isValidBlock(block)) {

                    issues.push('Block is too small.');
                }

                if (before) {

                    var beforeTailIdx = before.idx('tail');
                    var beforeHeadIdx = before.idx('head');

                    //console.log('beforeTailIdx', beforeTailIdx, 'beforeHeadIdx', beforeHeadIdx, 'blockHeadIdx', blockHeadIdx, 'blockTailIdx', blockTailIdx);

                    // If the before block is 'discontinued', collision appears
                    // when the block head is before the tail of the block before.
                    if (beforeTailIdx < beforeHeadIdx && blockHeadIdx <= beforeTailIdx) {

                        issues.push('Collision with the block before.');

                    } else if (blockTailIdx < blockHeadIdx && blockHeadIdx <= beforeTailIdx) {
                        // If the block itself is 'discontinued', collision appears when
                        // the block head is before the tail of the block before.

                        issues.push('Collision with the block before.');

                    } else if (blockTailIdx > beforeTailIdx && blockHeadIdx <= beforeTailIdx) {
                        // If the block is AFTER the before block (meaning really after, like visually after,
                        // collisian appears when its head is before the tail of the block before.

                        issues.push('Collision with the block before.');
                    }
                }

                if (after) {

                    var afterHeadIdx = after.idx('head');
                    if (blockTailIdx >= afterHeadIdx) {

                        issues.push('Collision with the block after.');
                    }
                }

                if (issues.length) {

                    // Put the old values back and pretend nothing happened.
                    block.set(end, blockEnd);
                }

                // Keep the collection in the sort order. Backbone doesn't automatically do that
                // when models are changed, only when they are added.
                this.sort();
            },
            getBlockBefore: ts.StandardWeekCollection.prototype.getBlockBefore,
            blockMinSize: ts.STANDARD_WEEK_RESOLUTION
        })),
        columnWidth: (opts.width || 600) / 7,
        rows: ts.STANDARD_WEEK_ROWS,
        rowHeight: (opts.height || 550) / ts.STANDARD_WEEK_ROWS,
        blockSmallSize: ts.STANDARD_WEEK_RESOLUTION,
        linesDensity: ts.STANDARD_WEEK_RESOLUTION,
        horizontalGap: 12,
        verticalGap: 2,
        hoverable: !$(document.body).hasClass('device-tablet'),
        renderColumnsFill: true,
        topbar: i18n['weekdaysLong']
    });
    $scheduleContainer.append(scheduleView.render().el);
    scheduleView.$el.addClass('std-week');

    thermostat.on('change:utc_offset', function() {

        // Mark current day in the topbar.
        var weekDay = thermostat.getCurrentMoment().isoWeekday();

        scheduleView.$('.topbar li.current-day').removeClass('current-day');
        scheduleView.$('.topbar li:nth-child(' + weekDay + ')').addClass('current-day');
    });

    // Re-render schedule view when standard_week or predefined_temperature changes.
    // -----------------------------------------------------------------------------

    thermostat.on('change:standard_week change:predefined_temperatures', function() {

        // Delay rendering of the schedule view so that we don't block the UI.
        _.delay(function() {

            var blocks = ts.createBlocksFromStandardWeek(thermostat.get('standard_week'), thermostat.get('predefined_temperatures'));
            scheduleView.model.clean();
            scheduleView.model.add(blocks);

            var pauseTemp = thermostat.get('predefined_temperatures')['pause'];
            scheduleView.renderMarker((pauseTemp / 10) + '&deg;C');

        }, 200);
    });

    // Save standard_week if there was a change in the schedule (convert it from ScheduleCollection).
    // ----------------------------------------------------------------------------------------------

    var $tooltip = $('<label class="tooltip metric-tooltip"></label>').appendTo(document.body).css('position', 'fixed');

    scheduleView.model.on('change-block remove-block new-block', function() {

        var standardWeek = [];
        scheduleView.model.each(function(block, i, collection) {

            standardWeek.push({
                start: [block.get('head').x, Math.floor(block.get('head').y / ts.STANDARD_WEEK_RESOLUTION), ts.scheduleBlockYCoordinateToMinutes(block.get('head').y, ts.STANDARD_WEEK_RESOLUTION)],
                temperature: block.get('type')
            });

            var firstBlock = collection[0];
            var firstBlockHeadIdx = firstBlock.idx('head');
            var nextBlock = collection[i + 1];
            var headIdx = block.idx('head');
            var tailIdx = block.idx('tail');
            var nextHeadIdx;
            var x;      // x-coordinate (the column number) where the newly created block should start.
            var y;      // y-coordinate (the row number) where the newly created block should start.
            var maxIdx = scheduleView.model.rows * scheduleView.model.columns - 1;

            if (nextBlock) {

                nextHeadIdx = nextBlock.idx('head');
                if (nextHeadIdx - tailIdx <= 1) {

                    // The next block is right after, there is no space for 'pause' block.
                    return;
                }

                x = block.get('tail').x;
                y = block.get('tail').y + 1;

            } else if (block === firstBlock) {
                // There is only one block in the schedule.

                if (tailIdx === headIdx - 1) {
                    // Example standard week: [{ start: [3, 12, 0], temperature: 'home' }]

                    // The only block covers the whole schedule. There is no free
                    // space that we can fill with 'pause' blocks.
                    return;

                } else if (tailIdx === maxIdx) {

                    // The only block does not cover the whole schedule. Therefore,
                    // create a pause block that fills the gap between the block tail
                    // and head (in other words, the start of the block starts at the block tail).
                    x = 0;
                    y = 0;

                } else {

                    x = block.get('tail').x;
                    y = block.get('tail').y + 1;
                }

            } else {
                // There are more blocks in the schedule and `block` is the last one.

                if (firstBlockHeadIdx > 0) {

                    // The next block (which is the first block) does not start at [0 0 0],
                    var startIdx = tailIdx % maxIdx;
                    // Little adjustment for the first block/middle blocks. In other words,
                    // if the module above is 0, we want the 'pause' block to start right
                    // at the beginning of the schedule ([0, 0, 0]). However, if it is
                    // anywhere else, we want to start AFTER the tail (i.e. +1).
                    if (startIdx !== 0) {
                        startIdx += 1;
                    }

                    if (firstBlockHeadIdx == startIdx) {
                        // If the next block is right after, there is no space for 'pause' block.
                        return;
                    }

                    var coord = scheduleView.model.fromIdx(startIdx);
                    x = coord.x;
                    y = coord.y;

                } else if (tailIdx === maxIdx) {

                    return;

                } else {

                    x = block.get('tail').x;
                    y = block.get('tail').y + 1;
                }
            }

            // There is a gap between the current iterated block and the next block.
            // Therefore, fill this gap with a pause stdweek block as per spec.
            // We don't show this pause blocks in the view, they mark something we
            // call "base temperature".
            standardWeek.push({
                start: [x, Math.floor(y / ts.STANDARD_WEEK_RESOLUTION), ts.scheduleBlockYCoordinateToMinutes(y, ts.STANDARD_WEEK_RESOLUTION)],
                temperature: 'pause'
            });
        });

        thermostat.save({ standard_week: standardWeek });

        $tooltip.hide();
    });

    scheduleView.on('adjust-block', function(block, evt) {

        var tailY = block.get('tail').y;
        tailY += 1;

        var startHour = Math.floor(block.get('head').y / ts.STANDARD_WEEK_RESOLUTION);
        var startMinutes = ts.scheduleBlockYCoordinateToMinutes(block.get('head').y, ts.STANDARD_WEEK_RESOLUTION);
        var endHour = Math.floor(tailY / ts.STANDARD_WEEK_RESOLUTION);
        var endMinutes = ts.scheduleBlockYCoordinateToMinutes(tailY, ts.STANDARD_WEEK_RESOLUTION);

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
        newBlockSize: ts.STANDARD_WEEK_RESOLUTION * 2 - 1,
        blocks: [
            { type: 'anti_freeze', label: i18n['program.anti_freeze'], value: '5.0', btnChangeLabel: '' },
            { type: 'not_home', label: i18n['program.not_home'], value: '15.0', btnChangeLabel: '' },
            { type: 'home', label: i18n['program.home'], value: '18.0', btnChangeLabel: '' },
            { type: 'comfort', label: i18n['program.comfort'], value: '21.5', btnChangeLabel: '' },
            { type: 'pause', label: i18n['program.pause'], value: '5.0', btnChangeLabel: '', tip: i18n['schedule.Set the base temperature. This temperature is maintained when there is no program set.'] }
        ]
    });
    $stencilContainer.append(stencilView.render().el);

    thermostat.on('change:fw', function() {

        var fw = thermostat.get('fw');
        // Strip of the firmware type prefix for >=HW5 devices
        fw = (fw[0] === 'h') ? fw.substring(1) : fw;

        stencilView.$el.toggleClass('fs-adjustable-pause', parseInt(fw, 10) >= 20140983);
    });

    // Re-render stencil if predefined_temperatures changes
    // -----------------------------------------------------

    thermostat.on('change:predefined_temperatures change:predefined_labels', function() {

        var predefinedTemperatures = thermostat.get('predefined_temperatures');
        var predefinedLabels = thermostat.get('predefined_labels') || {};

        _.each(stencilView.options.blocks, function(def) {

            def.value = predefinedTemperatures[def.type] / 10;

            if (!_.isUndefined(predefinedLabels[def.type])) {
                def.label = predefinedLabels[def.type];
            }
        });
        stencilView.render();
    });

    // Initialize dialogs for block changes and stencil changes.
    // ---------------------------------------------------------

    var programEditDialog = new StandardWeekProgramEditDialog({ model: thermostat });
    var blockEditDialog = new StandardWeekBlockEditDialog({ model: thermostat });

    stencilView.on('edit-block', function($block) {
        var type = $block.data('type');
        var block = _.findWhere(this.options.blocks, { type: type }) || {};
        var temperature = (thermostat.get('predefined_temperatures')[type]) / 10;
        programEditDialog.setSelectedTemperature(temperature);
        programEditDialog.blockType = type;
        programEditDialog.blockName = block.label;
        programEditDialog.render().show();
        // Position the dialog so that it is displayed ideally next to the stencil block.
        // However, always make sure the dialog box is visible on the screen
        // (i.e. respect the window size).
        var $dialogWindow = programEditDialog.$('.dialog-window');
        var blockOffset = $block.offset();
        var dialogWidth = $dialogWindow.outerWidth();
        var dialogHeight = $dialogWindow.outerHeight();
        var left = blockOffset.left - dialogWidth;
        var top = Math.max(Math.min(blockOffset.top, $(window).height() - dialogHeight - 50), 0);
        $dialogWindow.offset({ left: left, top: top });
    });

    programEditDialog.on('ok', function() {
        // temperature
        var temperature = parseFloat(programEditDialog.getSelectedTemperature()) * 10;
        var predefinedTemperatures = _.clone(thermostat.get('predefined_temperatures'));
        predefinedTemperatures[programEditDialog.blockType] = temperature;
        // labels
        var label = programEditDialog.getName();
        var predefinedLabels = _.clone(thermostat.get('predefined_labels'));
        if (_.isUndefined(predefinedLabels)) {
            // if no predefined labels saved in thermostat used the default ones.
            predefinedLabels = _.reduce(stencilView.options.blocks, function(res, block) {
                res[block.type] = block.label;
                return res;
            }, {});
        }
        predefinedLabels[programEditDialog.blockType] = label;
        // dhw
        var dhw_programs = _.clone(thermostat.get('dhw_programs') || {});
        var dhwMode = programEditDialog.getDHWMode();
        dhw_programs[programEditDialog.blockType] = dhwMode;

        thermostat.save({
            'predefined_temperatures': predefinedTemperatures,
            'dhw_programs': dhw_programs,
            'predefined_labels': predefinedLabels
        });
    });

    scheduleView.on('edit-block', function(blockView) {

        blockEditDialog.setSelectedPredefinedTemperature(blockView.model.get('type'));
        blockEditDialog.blockView = blockView;
        blockEditDialog.show();
    });

    blockEditDialog.on('ok', function() {

        var type = blockEditDialog.getSelectedPredefinedTemperature();
        var label = (thermostat.get('predefined_temperatures')[type]) / 10 + '&deg;C';
        var block = blockEditDialog.blockView.model;
        block.set({ type: type, label: label });
        scheduleView.model.trigger('change-block');
    });

    // make dialogs accesible from outsite via scheduleView
    scheduleView.blockEditDialog = blockEditDialog;
    scheduleView.programEditDialog = programEditDialog;

    // Touch related controls of blocks.
    // ---------------------------------

    var $blockTouchControls = opts.touchControls || $('.standard-week-programs .touch-controls');
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
