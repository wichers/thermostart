var ts = window.ts || {};

ts.DisplayModeToggle = Backbone.View.extend({

    ICHECK_CLASS: 'iradio_minimal-grey',

    events: function() {
        return isiPad ? {
            'ifChecked input': 'toggle'
        } : {
            'ifChecked input': 'toggle',
            'mouseover label': 'showTooltip',
            'mouseout label': 'hideTooltip'
        };
    },

    initialize: function() {

        this.$('input').iCheck({ radioClass: this.ICHECK_CLASS });

        this.listenTo(this.model, 'change:sd', function() {
            this.$('input[value=' + this.model.get('sd') + ']').iCheck('check');
        }, this);

	this.$tooltip = $('<label class="tooltip"></label>').appendTo(document.body);
    },

    toggle: function(evt) {
        
        var mode = parseInt($(evt.target).val(), 10);
        this.model.save({ 
            sd: mode,
            ui_synced: false,
            ui_source: 'display_mode_toggle',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });
    },

    showTooltip: function(evt) {

        var offset = $(evt.target).offset();

	var tip = $(evt.target).data('tip');
        if (tip) {
	    this.$tooltip.css({ left: offset.left + 30, top: offset.top + 30 }).html(tip).show();
        }
    },

    hideTooltip: function() {

        this.$tooltip.hide();
    }
});
