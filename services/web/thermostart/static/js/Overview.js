var ts = window.ts || {};

ts.OVERVIEW_RESOLUTION = 4;       // 4 = every 15 minutes, 2 = every 30 minutes, 1 = every hour
ts.OVERVIEW_ROWS = ts.OVERVIEW_RESOLUTION * 24;

ts.initializeOverview = function(thermostat, $scheduleContainer, opts) {

    opts = opts || {};

    // A timer used whe updateTimeIndicator option enabled.
    var indicatorTimer = null;

    function getTopbar(selectedDate) {

        var weekDate = moment(selectedDate).isoWeekday(1);
        var weekdaysShort = i18n['weekdaysShort'];

        return _.map(weekdaysShort, function(dayName) {
            var item = dayName + '&nbsp;' + weekDate.format('DD-MM');
            weekDate = weekDate.add('days', 1);
            return item;
        });
    }
    
    // Initialize schedule view.
    // -------------------------
    
    var scheduleView = new ts.ScheduleView({
        model: new ts.RelaxedCollection,
        columnWidth: (opts.scheduleWidth || 600) / 7,
        rows: ts.OVERVIEW_ROWS,
        rowHeight: (opts.scheduleHeight || 550) / ts.OVERVIEW_ROWS,
        linesDensity: ts.OVERVIEW_RESOLUTION,
        horizontalGap: 12,
        verticalGap: 2,
        topbar: getTopbar(new Date),
        renderLines: true,
        renderColumnsFill: true
    });
    $scheduleContainer.append(scheduleView.render().el);

    thermostat.on('change:utc_offset', function() {

        // Mark current day in the topbar.
        var weekDay = thermostat.getCurrentMoment().isoWeekday();

        scheduleView.$('.topbar li.current-day').removeClass('current-day');
        scheduleView.$('.topbar li:nth-child(' + weekDay + ')').addClass('current-day');
    });

    // Re-render schedule view when standard_week or predefined_temperature changes.
    // -----------------------------------------------------------------------------
    
    thermostat.on('change:standard_week change:exceptions change:predefined_temperatures', function() {

        // Delay rendering of the schedule view so that we don't block the UI.
        _.delay(function() {

            var stdWeekBlocks = ts.createBlocksFromStandardWeek(thermostat.get('standard_week'), thermostat.get('predefined_temperatures'));
            var exceptionsBlocks = ts.createBlocksFromExceptions(thermostat.get('exceptions'), thermostat.get('predefined_temperatures'), thermostat.getCurrentMoment().toDate()).blocks;
            
            scheduleView.model.clean();

            var exceptions = _.sortBy(exceptionsBlocks, function(block) {
                return scheduleView.model.idx(block.get('head'));
            });
            // Fill-up empty exception block space with standard week blocks.
            // 1. Find empty spaces.
            var emptySpaces = [];
            var emptySpaceBegin = 0;
            _.each(exceptions, function(block) {

                var headIdx = scheduleView.model.idx(block.get('head'));
                var tailIdx = scheduleView.model.idx(block.get('tail')) + 1;

                if (headIdx > emptySpaceBegin) {
                    emptySpaces.push({
                        startIdx: emptySpaceBegin,
                        endIdx: headIdx
                    });
                }
                emptySpaceBegin = tailIdx;
            });

            var lastExceptionBlock = _.last(exceptions);
            var lastExceptionBlockTailIdx = lastExceptionBlock ? scheduleView.model.idx(lastExceptionBlock.get('tail')) : -1;
            if (lastExceptionBlockTailIdx + 1 < scheduleView.model.rows * scheduleView.model.columns) {

                emptySpaces.push({
                    startIdx: lastExceptionBlockTailIdx + 1,
                    endIdx: scheduleView.model.rows * scheduleView.model.columns
                });
            }

            var firstEmptySpace = emptySpaces.length && emptySpaces[0];
            var lastEmptySpace = emptySpaces.length && emptySpaces[emptySpaces.length - 1];
            
            var blocks = exceptions;
            
            function fitBlocks(stdWeekBlocks) {

                var additionalBlocks = [];

                _.each(stdWeekBlocks, function(block, index) {

                    var headIdx = scheduleView.model.idx(block.get('head'));
                    var tailIdx = scheduleView.model.idx(block.get('tail'));

                    if (tailIdx < headIdx) {

                        var templateBlock = block.clone();
                        var additionalBlock;
                        var startBlockCut = false;
                        var endBlockCut = false;
                        
                        if (!firstEmptySpace || firstEmptySpace.startIdx != 0) {

                            // There is no space at the beginning of the schedule. We cut the block at the end of the schedule
                            // and create a new block that starts at the beginning and return it so it can be proceed later.
                            additionalBlock = templateBlock.clone();
                            additionalBlock.set('head', scheduleView.model.fromIdx(0));
                            additionalBlocks.push(additionalBlock);
                            
                            block.set('tail', scheduleView.model.fromIdx(scheduleView.model.rows * scheduleView.model.columns));
                            startBlockCut = true;
                            
                        } else if (tailIdx >= firstEmptySpace.endIdx) {

                            // We cut the block so it fits completely to the first empty space.
                            
                            additionalBlock = templateBlock.clone();
                            additionalBlock.set('head', scheduleView.model.fromIdx(firstEmptySpace.endIdx + 1));
                            additionalBlocks.push(additionalBlock);

                            block.set('tail', scheduleView.model.fromIdx(firstEmptySpace.endIdx - 0.9));
                        }

                        if (!lastEmptySpace || lastEmptySpace.endIdx != scheduleView.model.rows * scheduleView.model.columns) {

                            // There is no space at the end the schedule. We cut the block at the start of the schedule
                            // and create a new block that ends at the end and return it so it can be proceed later.
                            
                            additionalBlock = templateBlock.clone();
                            additionalBlock.set('tail', scheduleView.model.fromIdx(scheduleView.model.rows * scheduleView.model.columns - 1));
                            additionalBlocks.push(additionalBlock);

                            block.set('head', scheduleView.model.fromIdx(0));
                            endBlockCut = true;

                        } else if (headIdx < lastEmptySpace.startIdx) {

                            // We cut the block so it fits completely to the last empty space.
                            
                            additionalBlock = templateBlock.clone();
                            additionalBlock.set('tail', scheduleView.model.fromIdx(lastEmptySpace.startIdx - 1));
                            additionalBlocks.push(additionalBlock);

                            block.set('head', scheduleView.model.fromIdx(lastEmptySpace.startIdx));
                        }

                        // If there is a block left that starts at the end of schedule and ends at the beginning falls completely into
                        // an empty space add it to the other blocks.
                        (!endBlockCut || !startBlockCut) && blocks.push(block);

                        return;
                    }

                    _.each(emptySpaces, function(emptySpace) {

                        var newBlock = block.clone();

                        if (headIdx > emptySpace.startIdx && tailIdx < emptySpace.endIdx) {
                            // Blocks falls completely into the empty space.
                            blocks.push(newBlock);
                            
                        } else if (headIdx > emptySpace.startIdx && headIdx < emptySpace.endIdx) {
                            // Head falls into the empty space, cut the tail of the block.
                            newBlock.set('tail', scheduleView.model.fromIdx(emptySpace.endIdx - 1));

                            // If during the cut we create a block that changed the order of its head and tail,
                            // we're dealing with a really small block and so we fool the schedule by giving the
                            // block a floating point tail so that when the BlockView renders the block, it uses
                            // this small number to compute its height.
                            var newTailIdx = scheduleView.model.idx(newBlock.get('tail'));
                            if (tailIdx > headIdx && newTailIdx <= headIdx) {
                                newBlock.set('tail', scheduleView.model.fromIdx(scheduleView.model.idx(newBlock.get('head')) + .2));
                            }
                            blocks.push(newBlock);
                            
                        } else if (tailIdx >= emptySpace.startIdx && tailIdx < emptySpace.endIdx) {

                            // Tail falls into the empty space, cut the head of the block.
                            newBlock.set('head', scheduleView.model.fromIdx(emptySpace.startIdx));

                            // If during the cut we create a block that changed the order of its head and tail,
                            // we're dealing with a really small block and so we fool the schedule by giving the
                            // block a floating point tail so that when the BlockView renders the block, it uses
                            // this small number to compute its height.
                            var newHeadIdx = scheduleView.model.idx(newBlock.get('head'));
                            if (tailIdx > headIdx && tailIdx <= newHeadIdx) {
                                newBlock.set('head', scheduleView.model.fromIdx(scheduleView.model.idx(newBlock.get('tail')) - .2));
                            }
                            blocks.push(newBlock);
                            
                        } else if (emptySpace.startIdx >= headIdx && emptySpace.endIdx <= tailIdx) {
                            // Empty space falls completely into the block. Cut both head and tail of the block.
                            newBlock.set({
                                'head': scheduleView.model.fromIdx(emptySpace.startIdx),
                                'tail': scheduleView.model.fromIdx(emptySpace.endIdx - 1)
                            });
                            // If during the cut we create a block that changed the order of its head and tail,
                            // we're dealing with a really small block and so we fool the schedule by giving the
                            // block a floating point tail so that when the BlockView renders the block, it uses
                            // this small number to compute its height.
                            var newHeadIdx = scheduleView.model.idx(newBlock.get('head'));
                            var newTailIdx = scheduleView.model.idx(newBlock.get('tail'));
                            if (newTailIdx - newHeadIdx < 1) {
                                newBlock.set('tail', scheduleView.model.fromIdx(newHeadIdx + 0.2));
                            }
                            blocks.push(newBlock);
                        }
                    });
                });

                return additionalBlocks;
            }

            // 2. Go through the standard week and find blocks that fall (at least partially) into the empty spaces.
            stdWeekBlocks = _.sortBy(stdWeekBlocks, function(block) {
                return scheduleView.model.idx(block.get('head'));
            });

            // Run twice in case the first execution produces some extra blocks
            fitBlocks(fitBlocks(stdWeekBlocks));
            
            scheduleView.model.add(blocks);

            updateIndicator();

            // Update the time every minute if option enabled.
            if (opts.updateTimeIndicator) {
                clearInterval(indicatorTimer);
                indicatorTimer = setInterval(updateIndicator, 60000);
            }

        }, 50);
    });

    // Render indicator of the current date and set the `.past` CSS class on those blocks that are in the past.
    // --------------------------------------------------------------------------------------------------------

    var $dayIndicator = $('<div/>', { 'class': 'indicator-current-day' });
    var $timeIndicator = $('<div></div>', { 'class': 'indicator' });
//    $dayIndicator.append('<span>vandaag</span>');
    scheduleView.$('.schedule').prepend($dayIndicator).prepend($timeIndicator);
    
    function updateIndicator() {

        var now = thermostat.getCurrentMoment();

        // JVO overview rows contains the window height, so changed to a minute accurate indicator
        var indicatorPosition = ts.OVERVIEW_ROWS / 1440 * ((now.hours() * 60) + now.minutes());
        var gridCoordinates = { x: now.isoWeekday() - 1, y: indicatorPosition };

        $dayIndicator.css('top', gridCoordinates.y * scheduleView.options.rowHeight);

        $timeIndicator.css({
            left: gridCoordinates.x * scheduleView.options.columnWidth - 1,
            top: gridCoordinates.y * scheduleView.options.rowHeight
        }).text(now.format('HH:mm'));

        // Gray out past blocks.
        var indicatorIdx = scheduleView.model.idx(gridCoordinates);

        scheduleView.model.find(function(block) {

            var headIdx = block.idx('head');
            
            if (headIdx > indicatorIdx) {
                return true;
            }
            block.set('data', 'past');
            return false;
        });

        // If the last block is discontinued, mark it as discontinued so that we can color
        // its tail as gray. The reasoning behind is that the tail must always be in the past.
        // Note that this might not be true in cases where the discontinued block is too large finishing
        // on e.g. Tuesday but this is not likely to happen in the real world scenario as
        // a standard week block is probably never going to cover more that one day.
        // Also note that an exception can never be discontinued.
        var lastBlock = scheduleView.model.last();
        var headIdx = lastBlock.idx('head');
        var tailIdx = lastBlock.idx('tail');
        if (tailIdx < headIdx) {
            lastBlock.set('data', 'discontinued');
        }
    }
};
