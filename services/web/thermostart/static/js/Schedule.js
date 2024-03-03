var ts = window.ts || {};

// resolution: 4 = every 15 minutes, 2 = every 30 minutes, 1 = every hour
ts.scheduleMinutesToBlockOffset = function(minutes, resolution) {

    return Math.floor((minutes * resolution) / 60);
};

// resolution: 4 = every 15 minutes, 2 = every 30 minutes, 1 = every hour
ts.scheduleBlockYCoordinateToMinutes = function(y, resolution) {

    return (y % resolution) * (60 / resolution);
};

// BlockView
// ---------

ts.ScheduleBlockView = Backbone.View.extend({

    className: 'block',

    options: {

        rows: undefined,
        columns: undefined,
        rowHeight: undefined,
        columnWidth: undefined,
        horizontalGap: 5,
        verticalGap: 5,
        blockSmallSize: 2
    },

    events: {

        'click .remove-button': 'removeBlock',
        'touchstart .remove-button': 'removeBlock',
        'click .edit-button': 'editBlock',
        'touchstart': 'onTouchStart'
    },

    templates: {

        handle: [
            '<div class="handle <%= kind %>"></div>'
        ].join(''),
        
        controls: [
            '<div class="controls">',
                '<div class="remove-button"></div>',
                '<div class="edit-button"></div>',
            '</div>'
        ].join(''),

        label: [
            '<label class="label"><%= text %></label>'
        ].join('')
    },

    initialize: function() {

        _.bindAll(this, 'render');

        this.registerHandlers();
        
        this.$el.data('view', this);
    },

    registerHandlers: function() {
        
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model, 'remove', this.remove);
    },

    // Render a block starting at `head` grid coordinate ending at `tail` grid coordinate of type `type`.
    render: function() {

        this.$el.empty();

        var head = this.model.get('head');
        var tail = this.model.get('tail');
        var type = this.model.get('type');

        if (this.model.size() <= this.options.blockSmallSize) {
            this.$el.addClass('small');
        } else {
            this.$el.removeClass('small');
        }

        if (this.model.get('data')) {
            this.$el.attr('data-custom', this.model.get('data'));
        }

        var localPoint;
        
        var $headSlice = this.createSlice('head', type);
        $headSlice.height((this.options.rows * this.options.rowHeight) - (head.y * this.options.rowHeight));
        localPoint = this.gridToLocal(head);
        $headSlice.css({ left: localPoint.x + this.options.horizontalGap/2, top: localPoint.y });

        var headSliceOnly = head.x === tail.x && tail.y > head.y;
        
        if (headSliceOnly) {
            $headSlice.addClass('tail');
            $headSlice.append(_.template(this.templates.handle)({ kind: 'tail' }));
            $headSlice.height((tail.y - head.y + 1) * this.options.rowHeight - this.options.verticalGap); // @TODO gap
        }
        
        this.$el.append($headSlice);

        // If there is only once slice in the block, we're done.
        if (headSliceOnly) return this;

        var $tailSlice = this.createSlice('tail', type);
        $tailSlice.height((tail.y + 1) * this.options.rowHeight - this.options.verticalGap); // @TODO gap
        localPoint = this.gridToLocal(tail);
        $tailSlice.css({ left: localPoint.x + this.options.horizontalGap/2, top: 0 });

        this.$el.append($tailSlice);

        // Create the full slices in between head and tail.
        // ------------------------------------------------
        
        if (tail.x > head.x) {
            // Typical block.
            for (var x = head.x + 1; x < tail.x; x++) {

                var $slice = this.createSlice('', type);
                localPoint = this.gridToLocal({ x: x, y: 0 });
                $slice.height(this.options.rows * this.options.rowHeight);
                $slice.css({ left: localPoint.x + this.options.horizontalGap/2, top: 0 });
                this.$el.append($slice);
            }
            
        } else {
            // Block of a continuous schedule where the end time is before the start time.

            for (var x = 0; x < this.options.columns; x++) {

                if (x <= head.x && x >= tail.x) continue;

                var $slice = this.createSlice('', type);
                localPoint = this.gridToLocal({ x: x, y: 0 });
                $slice.height(this.options.rows * this.options.rowHeight);
                $slice.css({ left: localPoint.x + this.options.horizontalGap/2, top: 0 });
                this.$el.append($slice);
            }
        }

        return this;
    },

    createSlice: function(kind, type) {

        var $slice = $('<div/>', { 'class': 'slice ' + kind, 'data-type': type });
        $slice.width(this.options.columnWidth - this.options.horizontalGap);

        // Create handle for first and last slice.
        if (kind === 'head' || kind === 'tail') {

            $slice.append(_.template(this.templates.handle)({ kind: kind }));
        }

        // Create controls for first slice only.
        if (kind === 'head') {

            $slice.append(_.template(this.templates.controls)());
            $slice.append(_.template(this.templates.label)({ text: this.model.get('label') }));
        }

        return $slice;
    },

    // Convert grid coordinates to the this.el coordinates that can be directly used in CSS left/top.
    gridToLocal: function(gridPosition) {

        return {
            x: this.options.columnWidth * gridPosition.x,
            y: this.options.rowHeight * gridPosition.y
        };
    },

    removeBlock: function() {

        this.model.remove();
    },
    editBlock: function() {
        
        this.options.scheduleView.trigger('edit-block', this);
    },
    onTouchStart: function(evt) {

        this.options.scheduleView.trigger('block-touched', this, evt);
    }
});


ts.ScheduleSimpleBlockView = ts.ScheduleBlockView.extend({

    registerHandlers: function() {
        
        this.listenTo(this.model, 'change:head', this.adjustHead);
        this.listenTo(this.model, 'change:tail', this.adjustTail);
        this.listenTo(this.model, 'remove', this.remove);
    },

    adjustHead: function() {

        var head = this.model.get('head');
        var tail = this.model.get('tail');
        var type = this.model.get('type');

        if (this.model.size() <= this.options.blockSmallSize) {
            this.$el.addClass('small');
        } else {
            this.$el.removeClass('small');
        }

        var localPoint;
        var headSliceOnly = head.x === tail.x && tail.y > head.y;
        var $headSlice = this.$('.slice.head');
        
        $headSlice.height((tail.y - head.y + 1) * this.options.rowHeight - this.options.verticalGap);
        localPoint = this.gridToLocal(head);
        $headSlice.css({ left: localPoint.x + this.options.horizontalGap/2, top: localPoint.y });
    },
    
    adjustTail: function() {

        this.adjustHead();
    }
});


// ScheduleView
// ------------

ts.ScheduleView = Backbone.View.extend({

    events: {

        'mousedown .handle.head': 'onHeadHandleGrab',
        'touchstart .handle.head': 'onHeadHandleGrab',
        'mousedown .handle.tail': 'onTailHandleGrab',
        'touchstart .handle.tail': 'onTailHandleGrab',
        
        'mouseover .block': 'onMouseOver'
    },

    className: 'schedule-container',

    options: {

        BlockView: ts.ScheduleBlockView,
        hoverable: true,
        columns: 7,
        rows: 48,
        topbar: ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
        sidebar: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00','24:00'],
        renderColumnsFill: false,
        linesDensity: 2
    },

    template: [
        '<ul class="topbar">',
        '<% _.each(topbar, function(item) { %> <li><%= item %></li> <% }); %>',
        '</ul>',
        '<ul class="sidebar">',
        '<% _.each(sidebar, function(item) { %> <li><%= item %></li> <% }); %>',
        '</ul>',
        '<div class="schedule <% if (hoverable) { %> hoverable <% } %>">',
        '<% if (renderColumnsFill) { %>',
        '<ul class="columns-fill">',
        '<% _.each(_.range(columns), function() { %> <li></li> <% }); %>',
        '</ul>',
        '<% } %>',
        '</div>'
    ].join(''),

    initialize: function() {

        _.bindAll(this, 'onMouseMove', 'onMouseUp', 'addBlock');

        $(document.body).on('mousemove', this.onMouseMove);
        $(document.body).on('mouseup', this.onMouseUp);

        this.model.rows = this.options.rows;
        this.model.columns = this.options.columns;
        
        this.listenTo(this.model, 'add', this.addBlock);
        this.listenTo(this.model, 'remove', this.updateCount);

        this.columnWidth = this.options.columnWidth;
        this.rowHeight = this.options.rowHeight;
    },

    renderMarker: function(label) {

        var $marker = $('<label/>', { html: label, 'class': 'marker' })
        this.$('.marker').remove();
        this.$('.schedule').prepend($marker);
    },

    updateCount: function() {

        this.$el.attr('block-count', this.model.length);
    },

    addBlock: function(block) {

        var blockView = new this.options.BlockView({
            rows: this.options.rows,
            columns: this.options.columns,
            rowHeight: this.rowHeight,
            columnWidth: this.columnWidth,
            blockSmallSize: this.options.blockSmallSize,
            horizontalGap: this.options.horizontalGap,
            verticalGap: this.options.verticalGap,
            model: block,
            scheduleView: this
        });

        this.$('.schedule').append(blockView.el);
        blockView.render();

        /*
        // @DEBUG to be removed!!!
        blockView.on('mouseover', function() {

            var t = JSON.stringify(blockView.model.toJSON());
            t += '<br/>headIdx: ' + blockView.model.idx('head');
            t += '<br/>tailIdx: ' + blockView.model.idx('tail');
            
            $('#debug').html(t);
        });
        */

        this.updateCount();
    },

    onMouseMove: function(evt) {

        evt.preventDefault();
        evt = ts.util.normalizeEvent(evt);

        if (this._blockView) {
            // `pageCoordinates` are used to fool the `pointerToGrid()` method used in `onMouseUp()` below
            // as this method expects an event object out of which it takes `pageX`/`pageY`.
            var pageCoordinates = { pageX: evt.pageX, pageY: evt.pageY + this.rowHeight };
            var gridPosition = this.pointerToGrid(pageCoordinates);

            this.model.setBlock(this._blockView.model, gridPosition, this._adjustingEnd);
            this.trigger('adjust-block', this._blockView.model, evt);
        }
    },
    
    onMouseUp: function(evt) {

        evt.preventDefault();
        evt = ts.util.normalizeEvent(evt);

        if (this._blockView) {

            this._blockView.$el.removeClass('in-operation');
            delete this._blockView;

            this.model.trigger('change-block');
        }

        evt.target.removeEventListener('touchmove', this.onMouseMove, false);
        evt.target.removeEventListener('touchend', this.onMouseUp, false);
    },
    
    onHeadHandleGrab: function(evt) {

        // Prevent page from scrolling.
        evt.preventDefault();
        evt = ts.util.normalizeEvent(evt);

        // Touch events always target elemets where the touch STARTED! Therefore,
        // if the targeted element gets removed (which is the case of a block being adjusted - re-rendered),
        // that handler does not get fired. A work around this is to register a handler for `touchmove`
        // on `touchstart` for the target element and remove it on `touchend`.
        // See http://www.html5rocks.com/en/mobile/touchandmouse/
        evt.target.addEventListener('touchmove', this.onMouseMove, false);
        evt.target.addEventListener('touchend', this.onMouseUp, false);

        this._blockView = $(evt.target).closest('.block').data('view');
        this._blockView.$el.addClass('in-operation');
        this._adjustingEnd = 'head';
    },
    
    onTailHandleGrab: function(evt) {

        // Prevent page from scrolling.
        evt.preventDefault();
        evt = ts.util.normalizeEvent(evt);

        // Touch events always target elemets where the touch STARTED! Therefore,
        // if the targeted element gets removed (which is the case of a block being adjusted - re-rendered),
        // that handler does not get fired. A work around this is to register a handler for `touchmove`
        // on `touchstart` for the target element and remove it on `touchend`.
        // See http://www.html5rocks.com/en/mobile/touchandmouse/
        evt.target.addEventListener('touchmove', this.onMouseMove, false);
        evt.target.addEventListener('touchend', this.onMouseUp, false);

        this._blockView = $(evt.target).closest('.block').data('view');
        this._blockView.$el.addClass('in-operation');
        this._adjustingEnd = 'tail';
    },

    onMouseOver: function(evt) {

        evt.preventDefault();
        evt = ts.util.normalizeEvent(evt);
        
        var blockView = $(evt.target).closest('.block').data('view');
        if (blockView) {
            blockView.trigger('mouseover');
        }
    },

    render: function() {

        this.$el.empty();
        this.$el.append(_.template(this.template)({ 
            topbar: this.options.topbar, 
            sidebar: this.options.sidebar, 
            hoverable: this.options.hoverable, 
            renderColumnsFill: this.options.renderColumnsFill, 
            columns: this.options.columns 
        }));

        this.$('.schedule').css('width', (this.columnWidth * this.options.columns) + 'px');
        this.$('.schedule').css('height', (this.rowHeight * this.options.rows) + 'px');
        this.$('.topbar').css('width', (this.columnWidth * this.options.columns) + 'px');
        this.$('.sidebar li').css('height', this.options.sidebarLineHeight || (Math.ceil(this.rowHeight * (this.options.rows / this.options.sidebar.length)) + 1) + 'px');

        if (this.options.renderLines !== false) {
            this.renderLines();
        }

        return this;
    },

    renderLines: function(mod) {

        var $lines = $('<div class="lines"/>');

        mod = mod || this.options.linesDensity;

        var rows = this.options.rows;
        
        for (var i = 0; i < rows; i++) {

            if (i % mod === 0) {

                var $line = $('<div/>', { 'class': 'line' });
                $line.css('top', i * this.rowHeight);
                if (i === rows/2) {
                    $line.addClass('line-middle');
                }
                $lines.append($line);
            }
        }

        this.$('.schedule').append($lines);
    },


    // Convert a mouse coordinates (stored in the event object evt) to the grid coordinates.
    pointerToGrid: function(evt) {

        var offset = this.$('.schedule').offset();
        var x = evt.pageX - offset.left;
        var y = evt.pageY - offset.top;

        var col = Math.floor(x / this.columnWidth);
        var row = Math.floor(y / this.rowHeight) - 1;

        col = Math.max(0, Math.min(this.options.columns - 1, col));
        row = Math.max(0, Math.min(this.options.rows - 1, row));

        return { x: col, y: row };
    },

    remove: function() {

        $(document.body).off('mousemove', this.onMouseMove);
        $(document.body).off('mouseup', this.onMouseUp);
        return Backbone.View.prototype.remove.apply(this, arguments);
    }
});

// Block model
// -----------


ts.ScheduleBlock = Backbone.Model.extend({

    remove: function(options) {

        // Give the collection a chance to react on the remove event.
        this.trigger('remove', this, this.collection, options);
    },

    // Return an index in one-dimensional space for either 'head' or 'tail'.
    // Note that the block must be part of a collection for this method to work.
    idx: function(end, rows) {

        return this.get(end).y + this.collection.rows * this.get(end).x;
    },

    fromIdx: function(idx) {

        return this.collection.fromIdx(idx);
    },

    size: function() {

        var headIdx = this.idx('head');
        var tailIdx = this.idx('tail');

        if (tailIdx > headIdx) {

            return tailIdx - headIdx;
        }
        
        var rows = this.collection.rows;
        var columns = this.collection.columns;
        return tailIdx + rows * columns - headIdx;
    }
});


// Generic Schedule collection.
// ----------------------------

ts.ScheduleCollection = Backbone.Collection.extend({

    model: ts.ScheduleBlock,

    blockMinSize: 2,

    initialize: function(models, options) {

        this.listenTo(this, 'remove', this.removeBlock);

        this.rows = options && options.rows;
        this.columns = options && options.columns;
    },

    comparator: function(model) {

        return model.idx('head');
    },

    fromIdx: function(idx) {

        var rows = this.rows;
        var columns = this.columns;

        idx = idx < 0 ? rows * columns - 1 : idx;

        return { x: Math.floor(idx / rows) % columns, y: idx % rows };
    },

    idx: function(gridPosition) {

        return gridPosition.y + this.rows * gridPosition.x;
    },

    blockSize: function(block) {
        
        var headIdx = this.idx(block.get('head'));
        var tailIdx = this.idx(block.get('tail'));

        if (tailIdx > headIdx) {

            return tailIdx - headIdx;
        }
        
        var rows = this.rows;
        var columns = this.columns;
        return tailIdx + rows * columns - headIdx;
    },
    
    isValidBlock: function(block) {

        var blockHeadIdx = block.idx('head');
        var blockTailIdx = block.idx('tail');

        var minSize = this.blockMinSize;
        
        if (blockTailIdx >= blockHeadIdx) {

            if (blockTailIdx - blockHeadIdx >= minSize - 1) {
                
                return true;
            }
            return false;
        }
        
        // Special case for a 'discontinued' block (block who's tail is before its head).
        // Find if there is another block that this block 'eats'.
        for (var i = 0; i < this.length; i++) {

            var other = this.at(i);
            var otherHeadIdx = other.idx('head');
            
            // If the other block head is in between the head and tail of the block,
            // then the block crosses the other block.
            if (otherHeadIdx <= blockTailIdx || otherHeadIdx > blockHeadIdx) {
                return false;
            }
        }
        
        return true;
    },

    clean: function() {

        _.each(this.models, function(block) { block.remove({ clean: true }); });
        this.reset([]);
    }
});


// Standard week collection
// -------------------------


ts.StandardWeekCollection = ts.ScheduleCollection.extend({

    getBlockBefore: function(block) {
        
        var idx = this.indexOf(block);
        return this.at(idx - 1) || this.last();
    },
    getBlockAfter: function(block) {
        
        var idx = this.indexOf(block);
        return this.at(idx + 1) || this.first();
    },

    setBlock: function(block, gridPosition, end) {
        // A special case for when there is only one block in the schedule.
        // Such a block is always valid.
        if (this.length === 1) {

            block.set('head', gridPosition);
            block.set('tail', block.fromIdx(block.idx('head') - 1));
            return;
        }
        
        var before = this.getBlockBefore(block);
        var after = this.getBlockAfter(block);

        // console.log('before', JSON.stringify(before));
        // console.log('after', JSON.stringify(after));

        // Store the values we're gonna be changing so that
        // they can be possibly restored later.
        var beforeTail = _.clone(before.get('tail'));
        var afterHead = _.clone(after.get('head'));
        var blockEnd = block.get(end);

        // Set the block ends based on the grid position. Also
        // set the head/tail ends of the block before and after as those
        // are the only ones that can possibly get adjusted together with
        // the current block in operation.
        block.set(end, gridPosition);
        before.set('tail', block.fromIdx(block.idx('head') - 1));
        after.set('head', block.fromIdx(block.idx('tail') + 1));

        var issues = [];

        // 0. Check the special case when there are exactly two blocks in the schedule.
        if (before === after) {
            
            var blockHeadIdx = block.idx('head');
            var blockTailIdx = block.idx('tail');
            if (blockHeadIdx === blockTailIdx + 1) {

                issues.push('Block covers the whole schedule even though there are two blocks.');
            }
        }

        // 1. Check if the size of the block before is ok.
        if (!this.isValidBlock(before)) {
            
            issues.push('Block before is invalid.');

        // 2. Check if the size of the block after is ok.
        } else if (!this.isValidBlock(after)) {
            
            issues.push('Block after is invalid.');

        // 3. Check if the block size is ok.
        } else if (!this.isValidBlock(block)) {
            
            issues.push('Block is invalid.');
        }

        if (issues.length) {
            
            // Put the old values back and pretend nothing happened.
            block.set(end, blockEnd);
            before.set('tail', beforeTail);
            after.set('head', afterHead);

            // console.log(issues);
        }
        
        // Keep the collection in the sort order. Backbone doesn't automatically do that
        // when models are changed, only when they are added.
        this.sort();
    },

    removeBlock: function(block, collection, opt) {

        if (opt && opt.clean) return;

        // Make sure we don't remove the last block from standard week.
        if (this.length > 1) {
        
            var before = this.getBlockBefore(block);
            this.remove(block, { silent: true });
            // This trick reuses the `setBlock()` method in order to re-adjust
            // the block after so that the gap gets filled.
            this.setBlock(before, before.get('head'), 'head');

            this.trigger('remove-block');
        }
    }
});


// Exceptions collection
// ----------------------


ts.ExceptionsCollection = ts.ScheduleCollection.extend({

    blockMinSize: 2,

    getBlockBefore: function(block) {
        
        var idx = this.indexOf(block);

        var before = this.at(idx - 1)

        if (before && before.get('data') == 'background') {
            return this.getBlockBefore(before);
        }

        return before;
    },

    getBlockAfter: function(block) {
        
        var idx = this.indexOf(block);

        var after = this.at(idx + 1)

        if (after && after.get('data') == 'background') {
            return this.getBlockAfter(after);
        }

        return after;
    },

    isValidBlock: function(block) {

        var blockHeadIdx = block.idx('head');
        var blockTailIdx = block.idx('tail');

        var minSize = this.blockMinSize;
        
        if (blockTailIdx - blockHeadIdx >= minSize - 1) {
                
            return true;
        }
        return false;
    },
    
    setBlock: function(block, gridPosition, end) {

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
            if (blockHeadIdx <= beforeTailIdx) {

                issues.push('Collision with the block before. (' + before.get('temperature') + ')');
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
            
            //console.log(issues);
        }
    },

    removeBlock: function(block, collection, opt) {

        if (opt && opt.clean) return;
        
        this.remove(block, { silent: true });
        this.trigger('remove-block');
    }
    
});

ts.RelaxedCollection = ts.ScheduleCollection.extend({

    setBlock: function(block, gridPosition, end) {
    },

    removeBlock: function(block, collection, opt) {

        if (opt && opt.clean) return;
        
        this.remove(block, { silent: true });
        this.trigger('remove-block');
    }
});

// `AllScheduleCollection` mixes standard week with exceptions and pretend as if the standard
// week blocks weren't there.
ts.AllScheduleCollection = ts.ExceptionsCollection.extend({

    getBlockBefore: function(block) {
        
        var idx = this.indexOf(block);
        var before = this.at(idx - 1);
        if (!before) return undefined;
        if (before.get('data') === 'background') {
            return this.getBlockBefore(before);
        }
        return before;
    },
    getBlockAfter: function(block) {
        
        var idx = this.indexOf(block);
        var after = this.at(idx + 1);
        if (!after) return undefined;
        if (after.get('data') === 'background') {
            return this.getBlockAfter(after);
        }
        return after;
    }
});


ts.ScheduleStencil = Backbone.View.extend({

    className: 'schedule-stencil',

    options: {
        blocks: [
            { type: 'anti_freeze', label: 'Anti-vries', value: '5.0', btnChangeLabel: '' },
            { type: 'not_home', label: 'Niet thuis', value: '15.0', btnChangeLabel: '' },
            { type: 'home', label: 'Thuis', value: '18.0', btnChangeLabel: '' },
            { type: 'comfort', label: 'Comfort', value: '21.5', btnChangeLabel: '' }
//            { type: 'pause', label: 'Pauze', value: '5.0', btnChangeLabel: 'wijzig' }
        ],
        scheduleView: null,
        newBlockSize: 3 // number of rows a new dropped block will take up
    },

    events: {
        'mousedown .schedule-stencil-block button:not(.disabled)': 'dragStart',
        'touchstart .schedule-stencil-block button:not(.disabled)': 'dragStart',
        'click .btn-change': 'editBlock',
        'touchstart .btn-change': 'editBlock'
    },

    blockTemplate: [
        '<% if (typeof tip !== "undefined") { %>',
        '<span data-type="<%= type %>" class="schedule-stencil-block-tip"><%= tip %></span>',
        '<% } %>',
        '<div class="schedule-stencil-block" data-type="<%= type %>">',
        '<button class="schedule-stencil-block-button" data-type="<%= type %>" data-value="<%= value %>">',
        '<i class="icon icon-gripper"></i>',
        '<label><%= label %></label>',
        '<span><%= value %></span>',
        '</button>',
        '<a class="btn-change"><%= btnChangeLabel %><i class="icon icon-settings"></i>',
        '</a>',
        '</div>'
    ].join(''),

    initialize: function() {
        
        _.bindAll(this, 'onMouseMove', 'onMouseUp');

        $(document.body).on('mousemove touchmove', this.onMouseMove);
        $(document.body).on('mouseup touchend', this.onMouseUp);

        this._$indicator = $('<div/>', { 'class': 'schedule-stencil-indicator' });
        this.options.scheduleView.$('.schedule').append(this._$indicator);
    },
    
    dragStart: function(evt) {

        evt.preventDefault();

        evt = ts.util.normalizeEvent(evt);

        this._$buttonDrag = $(evt.target)
            .closest('button')
            .clone(true)
            .addClass('dragging')
            .appendTo(document.body);

        var offset = {
            left: evt.clientX - this._$buttonDrag.width()/2 + (window.scrollX || document.documentElement.scrollLeft || 0),
            top: evt.clientY - this._$buttonDrag.height()/2 + (window.scrollY || document.documentElement.scrollTop || 0)
        };

        this._$buttonDrag.offset(offset);
    },

    onMouseMove: function(evt) {

        evt = ts.util.normalizeEvent(evt);

        if (this._$buttonDrag) {

            this._freeDrop = false;
            this._$indicator.css('visibility', 'hidden');

            var offset = {
                left: evt.clientX - this._$buttonDrag.width()/2 + (window.scrollX || document.documentElement.scrollLeft || 0),
                top: evt.clientY - this._$buttonDrag.height()/2 + (window.scrollY || document.documentElement.scrollTop || 0)
            };
            this._$buttonDrag.offset(offset);

            var scheduleView = this.options.scheduleView;
            var gridPosition = scheduleView.pointerToGrid(evt);
            var idx = gridPosition.y + scheduleView.options.rows * gridPosition.x;

            // Find first block that this idx falls into.
            this._indicatedBlock = scheduleView.model.find(function(block) {

                // Special `background` blocks are not counted for. They're only for display.
                if (block.get('data') === 'background') return undefined;
                
                var headIdx = block.idx('head');
                var tailIdx = block.idx('tail');

                if (idx >= headIdx && idx - headIdx <= block.size()) {

                    return true;
                }
            });
            
            // If the block the indicator points to is too small, don't indicate this block.
            // Otherwise, it would cause issues when we drop the block and the `indicatedBlock`
            // gets smaller.
            this._indicatedBlockSmall = false;
            if (this._indicatedBlock && this._indicatedBlock.size() <= this.options.newBlockSize) {

                this._indicatedBlockSmall = true;
                return;
            }

            if (this._indicatedBlock) {

                var localPoint = {
                    x: scheduleView.options.columnWidth * this._indicatedBlock.get('head').x,
                    y: scheduleView.options.rowHeight * this._indicatedBlock.get('head').y
                };

                this._$indicator.css({ left: localPoint.x, top: localPoint.y, visibility: 'visible' });
                
            } else if (this.options.freeDrop) {

                // Check if there is enough space for the new block in the empty area.
                var isEnoughSpace = !scheduleView.model.find(function(block) {

                    if (block.get('data') === 'background') return undefined;
                    
                    var headIdx = block.idx('head');
                    var tailIdx = block.idx('tail');

                    if (idx + this.options.newBlockSize >= headIdx && idx + this.options.newBlockSize < tailIdx + this.options.newBlockSize) {

                        return true;
                    }
                }, this);

                if (isEnoughSpace) {

                    // We're dragging a block over an empty area.
                    // The magic numbers below adjust the position of the indicator depending
                    // on its height, width and gap that is set on the schedule.
                    this._$indicator.offset({ left: offset.left + 25, top: offset.top + 10 }).css('visibility', 'visible');
                    // `pageCoordinates` are used to fool the `pointerToGrid()` method used in `onMouseUp()` below
                    // as this method expects an event object out of which it takes `pageX`/`pageY`.
                    this._$indicator.pageCoordinates = { pageX: evt.pageX, pageY: evt.pageY };
                    this._freeDrop = true;
                }
            }
        }
    },

    onMouseUp: function(evt) {

        evt = ts.util.normalizeEvent(evt);
        
        if (this._$buttonDrag) {

            if (this._indicatedBlock && !this._indicatedBlockSmall) {

                var head = this._indicatedBlock.get('head');
                
                this._indicatedBlock.set('head', this._indicatedBlock.fromIdx(this._indicatedBlock.idx('head') + this.options.newBlockSize));

                var newBlock = new ts.ScheduleBlock({
                    head: head, tail: this._indicatedBlock.fromIdx(this._indicatedBlock.idx('head') - 1),
                    type: this._$buttonDrag.data('type'),
                    label: this._$buttonDrag.data('value') + '&deg;C'
                });
                this.options.scheduleView.model.add(newBlock);
                this.options.scheduleView.model.trigger('new-block');
                
            } else if (this._freeDrop && !this._indicatedBlockSmall) {

                var scheduleView = this.options.scheduleView;

                // Drop to an empty area.
                var gridPosition = scheduleView.pointerToGrid(this._$indicator.pageCoordinates);
                var newBlock = new ts.ScheduleBlock({
                    head: gridPosition, tail: scheduleView.model.fromIdx(scheduleView.model.idx(gridPosition) + this.options.newBlockSize),
                    type: this._$buttonDrag.data('type'),
                    label: this._$buttonDrag.data('value') + '&deg;C'
                });
                this.options.scheduleView.model.add(newBlock);
                this.options.scheduleView.model.trigger('new-block');

                this._freeDrop = false;
            }
            
            this._$buttonDrag.remove();
            this._$buttonDrag = null;
            this._$indicator.css('visibility', 'hidden');
            this._indicatedBlock = null;
        }
    },
    
    editBlock: function(evt) {

        this.trigger('edit-block', $(evt.target).closest('.schedule-stencil-block'));
    },

    render: function() {

        this.$el.empty();
        
        var blockTemplate = _.template(this.blockTemplate);

        _.each(this.options.blocks, function(block) {

            this.$el.append(blockTemplate(block));
            
        }, this);

        return this;
    },

    remove: function() {

        $(document.body).off('mousemove touchmove', this.onMouseMove);
        $(document.body).off('mouseup touchend', this.onMouseUp);
        return Backbone.View.prototype.remove.apply(this, arguments);
    }
});
