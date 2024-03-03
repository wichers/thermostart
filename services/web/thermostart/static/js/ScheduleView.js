var ScheduleView = Backbone.View.extend({

    options: {
        continuous: true,
        columns: 7,
        rows: 48,
        columnWidth: 92,
        rowHeight: 10,
        gap: 3     /* gap between successive blocks in pixels */
    },

    events: {
        'mousedown .slice .handle.first': 'startDraggingTopHandle',
        'mousedown .slice .handle.last': 'startDraggingBottomHandle',
        'mouseover .slice': 'turnOnBlockHoverState',
        'mouseover .handle': 'turnOnBlockHoverState',
        'mouseout .slice': 'turnOffBlockHoverState',
        'click .remove-button': 'removeBlockHandler',
        'click .edit-button': 'editBlockHandler'
    },

    initialize: function() {
        _.bindAll(this, 'documentMouseUp', 'documentMouseMove');
        $(document).mouseup(this.documentMouseUp);
        $(document).mousemove(this.documentMouseMove);
    },

    renderLines: function() {
        
        for (var i = 0; i < this.options.rows; i++) {

            if (i % 2 === 0) {

                var $line = $('<div/>', { 'class': 'line' });
                $line.css('top', i * this.options.rowHeight);
                this.$el.append($line);
            }
        }
    },

    documentMouseUp: function() {
        if (this.draggingTopHandleBlock || this.draggingBottomHandleBlock) {
            this.trigger('block-adjust');
        }
        
        this.draggingTopHandleBlock = this.draggingBottomHandleBlock = null;
        this.blockBefore = this.blockAfter = null;
        this.turnOffBlockHoverState();
    },

    turnOnBlockHoverState: function(evt) {
        // This method can be called on a reaction on an event or directly with `blockId`.
        var blockId = _.isString(evt) ? evt : $(evt.target).attr('data-block') || $(evt.target).parent('.slice').attr('data-block');
        this.$('.slice[data-block="' + blockId + '"]').addClass('hovered');
    },
    turnOffBlockHoverState: function() {
        this.$('.slice').removeClass('hovered');
    },

    removeBlockGuard: function(block) {
        // Override to implement arbitrary rules that guard a block removal. E.g. StandardWeek
        // does not allow removal of the last block.
        return true;
    },

    removeBlockHandler: function(evt) {
        
        var slice = $(evt.target).closest('.slice');
        var blockId = slice.attr('data-block');
        var block = this.getBlock(blockId);

        if (!this.removeBlockGuard(block)) {
            return this.trigger('block-remove:invalid', block);
        }

        // Fill in the gap with the previous block if we are in the continuous mode
        // and there is one previous block.
        if (this.options.continuous) {
            var blockBefore = this.getBlockBefore(blockId);
            
            if (blockBefore) {
                
                this.removeBlock(blockBefore.id);
                this.createBlock(
                    blockBefore.startCol, blockBefore.startRow,
                    block.endCol, block.endRow,
                    blockBefore.type, blockBefore.id
                );
            }
        }

        this.removeBlock(blockId);
        
        this.trigger('block-remove', blockId, block);
    },

    editBlockHandler: function(evt) {
        var slice = $(evt.target).parent().parent(),
            blockId = slice.attr('data-block'),
            blockType = slice.attr('data-type');
        this.trigger('block-edit', blockId, blockType);
    },

    documentMouseMove: function(evt) {
        var offset = this.$el.offset();
        
        if (this.draggingTopHandleBlock) {

            var x = evt.pageX - offset.left,
                y = evt.pageY - offset.top;

            this.adjustBlockStart(this.draggingTopHandleBlock, x, y);

        } else if (this.draggingBottomHandleBlock) {

            var x = evt.pageX - offset.left,
                y = evt.pageY - offset.top;
            
            this.adjustBlockEnd(this.draggingBottomHandleBlock, x, y);
        }
    },

    startDraggingTopHandle: function(evt) {
        this.draggingTopHandleBlock = $(evt.target).parent().attr('data-block');

        if (this.options.continuous) {
            // Cache the previous block so that we don't have to look for it on over mousemove.
            this.blockBefore = this.getBlockBefore(this.draggingTopHandleBlock);
        }
    },
    startDraggingBottomHandle: function(evt) {
        this.draggingBottomHandleBlock = $(evt.target).parent().attr('data-block');

        if (this.options.continuous) {
            // Cache the next block so that we don't have to look for it on over mousemove.
            this.blockAfter = this.getBlockAfter(this.draggingBottomHandleBlock);
        }
    },

    adjustBlockStart: function(blockId, x, y) {
        // Retrieve and compute grid coordinates.
        var block = this.getBlock(blockId),
            xyGridCoords = this.coordsToGrid(x, y),
            blocksInInterval = this.findBlocksInInterval(xyGridCoords.col, xyGridCoords.row, block.endCol, block.endRow, block.id /* exclude */),
            blockUnder = this.findBlock(xyGridCoords.col, xyGridCoords.row);

        var isEndBeforeStart = (block.endCol < block.startCol) || (block.endCol === block.startCol && block.endRow < block.startRow);
        
        // Determine conditions valid for block adjustment.
        var needsLeftExtension = xyGridCoords.col < block.startCol,
            needsRightExtension = xyGridCoords.col > block.endCol && isEndBeforeStart && xyGridCoords.col < this.options.columns,
            needsShrink = xyGridCoords.col > block.startCol && (xyGridCoords.col <= block.endCol || block.startCol > block.endCol),
            needsRowsUpdate = xyGridCoords.col === block.startCol,
            isInViewport = xyGridCoords.row >= 0 && xyGridCoords.col >= 0 && xyGridCoords.row <= this.options.rows && (xyGridCoords.col < this.options.columns && xyGridCoords.col >= 0),
            isBigEnough = (block.endRow - xyGridCoords.row) >= 1 || (xyGridCoords.col !== block.endCol) || (block.startCol === block.endCol && block.endRow < block.startRow),
            pointsToAnotherBlock = blocksInInterval.length > 0,
            isBlockBeforeBigEnough = true,
            onlyOneBlock = this.blockBefore && this.blockBefore.id === blockId;

        if (isEndBeforeStart) {
            isBigEnough = true;
        }

        // If the block under the pointer is the previous block in continuous mode, continue
        // adjusting.
        // Also check if a discontinued block needs an extension to the last column.
        var needsDiscontinuedExtension = false;
        if (this.options.continuous && blockUnder !== null && this.blockBefore !== null && blockUnder.id === this.blockBefore.id) {
            pointsToAnotherBlock = false;
            needsDiscontinuedExtension = (xyGridCoords.col === this.options.columns - 1) && (this.blockBefore.endCol === this.options.columns - 1);
        }

        // Leaving the below comment in place for future debugging purposes.
        // It prints all the necessary flags and objects that determine the block adjustment.


        // `isBlockBeforeBigEnough` is `true` if we are not in continuous mode. Otherwise,
        // we compute its size and check if it is big enough.
        if (this.options.continuous && this.blockBefore && xyGridCoords.col === this.blockBefore.startCol) {
            
            isBlockBeforeBigEnough = xyGridCoords.row - this.blockBefore.startRow > 1;
            
        } else if (this.blockBefore && xyGridCoords.col < this.blockBefore.startCol) {
            // Previous block would have had negative size otherwise.
            isBlockBeforeBigEnough = false;
            // Well, with one exception and that is shrinking discontinued block.
            if (xyGridCoords.col === 0 && this.blockBefore.startCol === this.options.columns - 1) {
                isBlockBeforeBigEnough = true;
            }
        }

        var isBlockBeforeEndBeforeStart = this.blockBefore && ((this.blockBefore.endCol < this.blockBefore.startCol) || (this.blockBefore.endCol === this.blockBefore.startCol && this.blockBefore.endRow < this.blockBefore.startRow));

        if (isBlockBeforeEndBeforeStart) {
            isBlockBeforeBigEnough = true;
        }

        // This is when there is a 'big' block before. Imagine a block starting Tuesday, ending Monday.
        if (this.blockBefore && this.blockBefore.startCol > this.blockBefore.endCol) {
            isBlockBeforeBigEnough = true;
        }

        if (this.blockBefore && (this.blockBefore.endCol === this.options.columns - 1) && (this.blockBefore.endRow === this.options.rows - 1)) {

            isBlockBeforeBigEnough = true;
        }

        /*
        console.log(
            'needsLeftExtension:', needsLeftExtension,
            'needsRightExtension:', needsRightExtension,
            'needsShrink:', needsShrink,
            'needsRowsUpdate:', needsRowsUpdate,
            'isInViewport:', isInViewport,
            'isBigEnough:', isBigEnough,
            'pointsToAnotherBlock:', pointsToAnotherBlock,
            'isBlockBeforeBigEnough:', isBlockBeforeBigEnough,
            'onlyOneBlock', onlyOneBlock,
            'blockBefore:', this.blockBefore,
            'blockUnder:', blockUnder,
            'block', block,
            'xyGridCoords', xyGridCoords
        );
        */
        
        if (onlyOneBlock && isInViewport) {

            var startCol = xyGridCoords.col;
            var startRow = xyGridCoords.row + 1;
            var endCol = xyGridCoords.col;
            var endRow = xyGridCoords.row;

            if (xyGridCoords.row < 0) {
                startRow = 0;
                endCol = endCol - 1;
                endRow = this.options.rows - 1;
            }

            if (xyGridCoords.row >= this.options.rows - 1) {
                startRow = 0;
                startCol = (startCol + 1) % this.options.columns;
                endRow = this.options.rows - 1;
            }

            if (xyGridCoords.col === 0 && xyGridCoords.row < 0) {
                // Top left corner.
                startRow = 0;
                startCol = 0;
                endRow = this.options.rows - 1;
                endCol = this.options.cols - 1;
                return;
            }
            
            this.removeBlock(blockId);
            this.createBlock(
                startCol, startRow,
                endCol, endRow,
                block.type, blockId,
                'hovered'
            );
            return;
        }

        // For the sake of simplicity, we rather recreate the whole block.
        if ( (isInViewport && isBigEnough && isBlockBeforeBigEnough && !pointsToAnotherBlock) &&
             (needsLeftExtension || needsRightExtension || needsShrink || needsRowsUpdate || needsDiscontinuedExtension) ) {

            var startCol = xyGridCoords.col,
                startRow = xyGridCoords.row;

            // Cover the case when we have our block start at the very last row of the
            // schedule. In that case, we'd rather start the block at the beginning
            // of the next column.
            if (startRow === this.options.rows) {
                startRow = 0;
                startCol = (startCol + 1) % this.options.columns;
            }

            var endCol = block.endCol;
            var endRow = block.endRow;

            this.removeBlock(blockId);
            this.createBlock(
                startCol, startRow,
                endCol, endRow,
                block.type, blockId,
                'hovered'
            );

            // Recreate previous block if there is one and we are in the continuous mode.
            if (this.options.continuous && this.blockBefore && !onlyOneBlock) {

                var blockBeforeEndCol = startCol,
                    blockBeforeEndRow = startRow - 1;

                // Cover the case when end of the previous block is at the zero-th row.
                // In this case, we'd rather end the previous block at the end of the previous
                // column.
                if (blockBeforeEndRow < 0) {
                    blockBeforeEndRow = this.options.rows - 1;
                    // if `(blockBeforeEndCol - 1) < 0` then we are dealing with the discontinued block.
                    blockBeforeEndCol = (blockBeforeEndCol - 1) < 0 ? this.options.columns - 1 : (blockBeforeEndCol - 1);
                }
                
                this.removeBlock(this.blockBefore.id);
                this.createBlock(
                    this.blockBefore.startCol, this.blockBefore.startRow,
                    blockBeforeEndCol, blockBeforeEndRow,
                    this.blockBefore.type, this.blockBefore.id
                );
            }
        } 
    },

    adjustBlockEnd: function(blockId, x, y) {
        // Retrieve and compute grid coordinates.
        var block = this.getBlock(blockId),
            xyGridCoords = this.coordsToGrid(x, y),
            blocksInInterval = this.findBlocksInInterval(block.startCol, block.startRow, xyGridCoords.col, xyGridCoords.row, block.id /* exclude */),
            blockUnder = this.findBlock(xyGridCoords.col, xyGridCoords.row);

        var isEndBeforeStart = (block.endCol < block.startCol) || (block.endCol === block.startCol && block.endRow < block.startRow);
        
        // Determine conditions valid for block adjustment.
        var needsRightExtension = xyGridCoords.col > block.endCol,
            needsLeftExtension = xyGridCoords.col < block.startCol && isEndBeforeStart,
            needsShrink = xyGridCoords.col < block.endCol && (xyGridCoords.col >= block.startCol || block.startCol > block.endCol),
            needsRowsUpdate = xyGridCoords.col === block.endCol,
            isInViewport = xyGridCoords.row >= -1 && xyGridCoords.row < this.options.rows && xyGridCoords.col < this.options.columns,
            isBigEnough = (xyGridCoords.row - block.startRow) >= 1 || (xyGridCoords.col !== block.startCol),
            pointsToAnotherBlock = blocksInInterval.length > 0,
            isBlockAfterBigEnough = true,
            onlyOneBlock = this.blockBefore && this.blockBefore.id === blockId;

        if (isEndBeforeStart) {
            isBigEnough = true;
        }

        // If the block under the pointer is the next block in continuous mode, continue
        // adjusting.
        // Also check if a discontinued block needs an extension to the first column.
        var needsDiscontinuedExtension = false;
        if (this.options.continuous && blockUnder !== null && this.blockAfter !== null && blockUnder.id === this.blockAfter.id) {
            pointsToAnotherBlock = false;
            needsDiscontinuedExtension = (xyGridCoords.col === 0) && (this.blockAfter.startCol === 0);
        }

        // `isBlockAfterBigEnough` is `true` if we are not in continuous mode. Otherwise,
        // we compute its size and check if it is big enough.
        if (this.options.continuous && this.blockAfter && xyGridCoords.col === this.blockAfter.endCol) {
            isBlockAfterBigEnough = this.blockAfter.endRow - xyGridCoords.row > 1;
        } else if (this.blockAfter && xyGridCoords.col > this.blockAfter.endCol) {
            // Next block would have had negative size otherwise.
            isBlockAfterBigEnough = false;
            // Well, with one exception and that is extending/shrinking discontinued block.
            if (xyGridCoords.col >= this.blockAfter.startCol && (this.blockAfter.endCol < this.blockAfter.startCol || this.blockAfter.startCol === 0)) {
                isBlockAfterBigEnough = true;
            }
        }

        // This is when there is a 'big' block after. Imagine a block starting Tuesday, ending Monday.
        if (this.blockAfter && this.blockAfter.startCol > this.blockAfter.endCol) {
            isBlockAfterBigEnough = true;
        }

        /*
        console.log(
            'needsRightExtension:', needsRightExtension,
            'needsLeftExtension:', needsLeftExtension,
            'needsShrink:', needsShrink,
            'needsRowsUpdate:', needsRowsUpdate,
            'isInViewport:', isInViewport,
            'isBigEnough:', isBigEnough,
            'pointsToAnotherBlock:', pointsToAnotherBlock,
            'isBlockAfterBigEnough:', isBlockAfterBigEnough,
            'onlyOneBlock', onlyOneBlock
        );
        console.log('blockUnder:', blockUnder);
        */

        if (onlyOneBlock) {
            
            var startCol = xyGridCoords.col;
            var startRow = xyGridCoords.row + 1;
            var endCol = xyGridCoords.col;
            var endRow = xyGridCoords.row;

            if (xyGridCoords.row < 0) {
                startRow = 0;
                endCol = endCol - 1;
                endRow = this.options.rows - 1;
            }

            if (xyGridCoords.row >= this.options.rows - 1) {
                startRow = 0;
                startCol = (startCol + 1) % this.options.columns;
                endRow = this.options.rows - 1;
            }

            if (xyGridCoords.col === 0 && xyGridCoords.row < 0) {
                // Top left corner.
                startRow = 0;
                startCol = 0;
                endRow = this.options.rows - 1;
                endCol = this.options.cols - 1;
                return;
            }
            
            this.removeBlock(blockId);
            this.createBlock(
                startCol, startRow,
                endCol, endRow,
                block.type, blockId,
                'hovered'
            );
            return;
        }
        
        // For the sake of simplicity, we rather recreate the whole block.
        if ( (isInViewport && isBigEnough && isBlockAfterBigEnough && !pointsToAnotherBlock) &&
             (needsRightExtension || needsLeftExtension || needsShrink || needsRowsUpdate || needsDiscontinuedExtension) ) {

            var endCol = xyGridCoords.col,
                endRow = xyGridCoords.row;

            // Cover the case when we have our block end at the very beginning of a row of the
            // schedule. In that case, we'd rather start the block at the beginning
            // of the previous column.
            if (endRow < 0) {
                endRow = this.options.rows - 1;
                endCol = (endCol - 1) < 0 ? this.options.columns - 1 : (endCol - 1);
            }
            
            this.removeBlock(blockId);
            this.createBlock(
                block.startCol, block.startRow,
                endCol, endRow,
                block.type, blockId,
                'hovered'
            );

            // Recreate next block if there is one and we are in the continuous mode.
            if (this.options.continuous && this.blockAfter) {

                var blockAfterStartCol = xyGridCoords.col,
                    blockAfterStartRow = xyGridCoords.row + 1;

                // Cover the case when start of the next block is at the last row.
                // In this case, we'd rather start the next block at the beginning of the next
                // column.
                if (blockAfterStartRow === this.options.rows) {
                    blockAfterStartRow = 0;
                    blockAfterStartCol = (blockAfterStartCol + 1) % this.options.columns;
                }
                
                this.removeBlock(this.blockAfter.id);
                this.createBlock(
                    blockAfterStartCol, blockAfterStartRow,
                    this.blockAfter.endCol, this.blockAfter.endRow,
                    this.blockAfter.type, this.blockAfter.id
                );
            }
            
        } 
    },
    
    createBlock: function(col1, row1, col2, row2, type, blockId, classes) {
        if (_.isUndefined(blockId)) {
            blockId = _.uniqueId();
        }
        // Additional CSS classes added to all slices of the new block.
        classes = classes || '';

        var firstSlice = this.createSlice('first', type, blockId),
            firstSliceHeight = (this.options.rows * this.options.rowHeight) - (row1 * this.options.rowHeight),
            firstSliceCoords = this.gridToCoords(col1, row1);

        firstSlice.height(firstSliceHeight);
        firstSlice.css({ left: firstSliceCoords.x, top: firstSliceCoords.y });
        // Saving data-col and data-row help us determine to what row the slice
        // belongs. If we have e.g. a grid 10x10 and row height 1, slice that starts
        // at top 0 and ends at top 5, we need to able to determine whether this
        // slice is in row 5 or row 6 without having gaps between consecutive slices.
        firstSlice.attr('data-start-col', col1).attr('data-start-row', row1);
        firstSlice.addClass(classes);
        this.$el.append(firstSlice);

        if (col1 === col2 && row2 > row1) {
            firstSlice.addClass('last');
            firstSlice.append(this.createHandle('last'));
            firstSlice.height((row2 - row1 + 1) * this.options.rowHeight - this.options.gap);
            firstSlice.attr('data-end-col', col2).attr('data-end-row', row2);
            this.updateLabel(firstSlice.find('.label'), type, blockId);
            return;
        }
        
        var lastSlice = this.createSlice('last', type, blockId),
            lastSliceHeight = (row2 + 1) * this.options.rowHeight,
            lastSliceCoords = this.gridToCoords(col2, row2);

        lastSlice.height(lastSliceHeight - this.options.gap);
        lastSlice.css({ left: lastSliceCoords.x, top: 0 });
        lastSlice.attr('data-end-col', col2).attr('data-end-row', row2);
        lastSlice.addClass(classes);
        this.$el.append(lastSlice);


        if (col1 === col2 && row2 < row1 && this.options.continuous) {
            // Special case. Fill in gaps in all the columns except in col1 where both first and last slices reside.
            for (var j = 0; j < this.options.columns; j++) {
                if (j !== col1) {
                    var slice = this.createSlice('', type, blockId);
                    var coords = this.gridToCoords(j, 0);
                    slice.height(this.options.rows * this.options.rowHeight - this.options.gap);
                    slice.css({ left: coords.x, top: 0 });
                    slice.addClass(classes);
                    this.$el.append(slice);
                }
            }
            this.updateLabel(firstSlice.find('.label'), type, blockId);
            return;
        }
        
        // Fill in the space between the first and last slice.
        var i = (col1 + 1) % this.options.columns,
            allCovered = i === col2;

        // We don't want to start again from the first column if
        // we are not in the continuous mode.
        if (col1 === this.options.columns - 1 && !this.options.continuous) {
            allCovered = true;
        }
        
        while (!allCovered) {
            var slice = this.createSlice('', type, blockId),
                coords = this.gridToCoords(i, 0);
            slice.height(this.options.rows * this.options.rowHeight - this.options.gap);
            slice.css({ left: coords.x, top: 0 });
            slice.addClass(classes);
            this.$el.append(slice);

            i = (i + 1) % this.options.columns;
            if (i === col2) {
                allCovered = true;
            } 
        }
        
        this.updateLabel(firstSlice.find('.label'), type, blockId);
    },

    removeBlock: function(blockId) {
        this.$('[data-block="' + blockId +'"]').remove();
    },

    // Finds a block by its grid coordinates.
    // Returns all information associated with the block.
    findBlock: function(col, row, cssClass) {

        var firstSlices = this.$('.slice.first' + (cssClass ? '.' + cssClass : ''));
        var lastSlices = this.$('.slice.last' + (cssClass ? '.' + cssClass : ''));
        var ret = [];
        
        for (var i = 0; i < firstSlices.length; i++) {

            var isIn;
            
            var blockStartCol = parseInt($(firstSlices[i]).attr('data-start-col'), 10),
                blockStartRow = parseInt($(firstSlices[i]).attr('data-start-row'), 10),
                blockEndCol = parseInt($(lastSlices[i]).attr('data-end-col'), 10),
                blockEndRow = parseInt($(lastSlices[i]).attr('data-end-row'), 10);

            var isInStartGap, isInEndGap;

            var isDiscontinued = (blockEndCol < blockStartCol) || (blockEndCol === blockStartCol && blockEndRow < blockStartRow);

            if (isDiscontinued) {
                
                isInStartGap = col === blockStartCol && row < blockStartRow;
                isInEndGap = col === blockEndCol && row > blockEndRow;
                isIn = (col <= blockEndCol && !isInEndGap) || (col >= blockStartCol && !isInStartGap);
                
            } else {

                isInStartGap = col === blockStartCol && row < blockStartRow;
                isInEndGap = col === blockEndCol && row > blockEndRow;
                isIn = col >= blockStartCol && col <= blockEndCol && !isInStartGap && !isInEndGap;
                
            }
            
            if (isIn) {
                return {
                    id: $(firstSlices[i]).attr('data-block'),
                    type: $(firstSlices[i]).attr('data-type'),
                    startCol: blockStartCol,
                    startRow: blockStartRow,
                    endCol: blockEndCol,
                    endRow: blockEndRow
                };
            }

        }
        
        return null;
    },

    // Finds all blocks by an interval specified as grid coordinates.
    // Returns all information associated with the blocks.
    findBlocksInInterval: function(startCol, startRow, endCol, endRow, excludeBlockId, cssClass) {

        var firstSlices = this.$('.slice.first' + (cssClass ? '.' + cssClass : ''));
        var lastSlices = this.$('.slice.last' + (cssClass ? '.' + cssClass : ''));
        var ret = [];
        
        for (var i = 0; i < firstSlices.length; i++) {
            if (excludeBlockId && $(firstSlices[i]).attr('data-block') === excludeBlockId) {
                continue;
            }
            
            var blockStartCol = parseInt($(firstSlices[i]).attr('data-start-col'), 10),
                blockStartRow = parseInt($(firstSlices[i]).attr('data-start-row'), 10),
                blockEndCol = parseInt($(lastSlices[i]).attr('data-end-col'), 10),
                blockEndRow = parseInt($(lastSlices[i]).attr('data-end-row'), 10);

            var isInBoundingBlock = (blockStartCol >= startCol || blockEndCol >= startCol) && (blockStartCol <= endCol || blockEndCol <= endCol),
                isInStartGap = blockEndCol === startCol && blockEndRow < startRow,
                isInEndGap = blockStartCol === endCol && blockStartRow > endRow,
                isDiscontinued = (blockStartCol > endCol || isInEndGap) && (blockEndCol < startCol || isInStartGap);

            /*
            console.log(
                'isInBoundingBlock:', isInBoundingBlock,
                'isInStartGap:', isInStartGap,
                'isInEndGap:', isInEndGap,
                'isDiscontinued:', isDiscontinued
            );
            */

            // `isDiscontinued` is set to `true` if the beginning of the block starts after
            // the [endCol, endRow] coordinate and continues back at the beginning
            // of the schedule max till [startCol, startRow].
            // Imagine a block that starts on Sunday (last column in the schedule)
            // and ends on Monday which is the first column in the schedule.
            
            if (isInBoundingBlock && !isInStartGap && !isInEndGap && !isDiscontinued) {

                ret.push({
                    id: $(firstSlices[i]).attr('data-block'),
                    type: $(firstSlices[i]).attr('data-type'),
                    startCol: blockStartCol,
                    startRow: blockStartRow,
                    endCol: blockEndCol,
                    endRow: blockEndRow
                });

                // Optimization as if the interval points to only one cell, that means
                // that we can have maximum of one block that exists in that cell.
                if (startCol === endCol && startRow === endRow) {
                    return ret;
                }
            }
        }
        return ret;
    },

    getBlock: function(blockId) {
        var firstSlice = this.$('.slice.first[data-block="' + blockId + '"]'),
            lastSlice = this.$('.slice.last[data-block="' + blockId + '"]');
        return {
            id: blockId,
            type: firstSlice.attr('data-type'),
            startCol: parseInt(firstSlice.attr('data-start-col'), 10),
            startRow: parseInt(firstSlice.attr('data-start-row'), 10),
            endCol: parseInt(lastSlice.attr('data-end-col'), 10),
            endRow: parseInt(lastSlice.attr('data-end-row'), 10)
        };
    },

    getBlockBefore: function(blockId) {
        var block = this.getBlock(blockId),
            blockBeforeEndGridCoords = {
                col: block.startCol,
                row: block.startRow - 1
            };

        // Check if the previous block is not in the previous column. This can
        // happen if the current block starts at the very beginning of a column.
        if (block.startRow === 0) {
            // If block start is at the [0, 0] grid coordinate and we are in the continuous
            // mode, look for a block in the very last cell of the schedule (in the last column).
            
            if (block.startCol === 0 && this.options.continuous) {
                blockBeforeEndGridCoords.col = this.options.columns - 1;
                blockBeforeEndGridCoords.row = this.options.rows - 1;
            } else {
                blockBeforeEndGridCoords.col -= 1;
                blockBeforeEndGridCoords.row = this.options.rows - 1;
            }
        }

        return this.findBlock(blockBeforeEndGridCoords.col, blockBeforeEndGridCoords.row);
    },

    getBlockAfter: function(blockId) {
        var block = this.getBlock(blockId),
            blockAfterStartGridCoords = {
                col: block.endCol,
                row: block.endRow + 1
            };

        // Check if the next block is not in the next column. This can
        // happen if the current block ends at the very end of a column.
        if (block.endRow === this.options.rows - 1) {

            if (block.endCol === this.options.columns - 1 && this.options.continuous) {
                blockAfterStartGridCoords.col = 0;
                blockAfterStartGridCoords.row = 0;
            } else {
                blockAfterStartGridCoords.col += 1;
                blockAfterStartGridCoords.row = 0;
            }
        }

        return this.findBlock(blockAfterStartGridCoords.col, blockAfterStartGridCoords.row);
    },
    
    createSlice: function(kind, type, blockId) {
        var slice = $('<div/>', {
            'class': 'slice ' + kind,
            'data-type': type,
            'data-block': blockId
        });
        if (kind === 'first' || kind === 'last') {
            slice.append(this.createHandle(kind));
        }
        if (kind === 'first') {
            slice.append(this.createControls());
            slice.append(this.createLabel(type, blockId));
        }
        return slice;
    },
    createHandle: function(kind) {
        var handle = $('<div/>', {
            'class': 'handle ' + kind
        });
        return handle;
    },
    createControls: function() {
        var controls = $('<div/>', {
            'class': 'controls'
        });
        var removeButton = $('<div/>', {
            'class': 'remove-button'
        });
        var editButton = $('<div/>', {
            'class': 'edit-button'
        });
        controls.append(editButton);
        controls.append(removeButton);
        return controls;
    },
    createLabel: function(blockType, blockId) {
        var label = $('<label/>', {
            'class': 'label'
        });
        return label;
    },
    updateLabel: function(label, blockType, blockId) {
        label.text('');
    },
    gridToCoords: function(col, row) {
        var x = col * this.options.columnWidth,
            y = row * this.options.rowHeight;
        return { x: x, y: y };
    },
    coordsToGrid: function(x, y) {
        var col = Math.floor(x / this.options.columnWidth),
            row = Math.floor(y / this.options.rowHeight);
        return { col: col, row: row };
    }
});
