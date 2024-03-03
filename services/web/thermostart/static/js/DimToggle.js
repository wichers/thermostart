var ts = window.ts || {};


ts.DimToggle = Backbone.View.extend({

    events: function() {
        return isiPad ? { 'touchstart .button': 'toggle' } : { 'click .button': 'toggle' }
    },

    initialize: function() {

        this.listenTo(this.model, 'change:dim', function() {
            this.$('.dim').text(this.model.get('dim'));
        }, this);
    },

    toggle: function(evt) {

        evt.preventDefault();

        var sign = $(evt.target).hasClass('button-lower') ? -1 : 1;

        var oldDim = this.model.get('dim');
        var dim = (_.isUndefined(oldDim) ? 0 : oldDim) + sign * 25;

        dim = Math.max(0, Math.min(100, dim));
        
        this.model.save({
            dim: dim,
            ui_synced: false,
            ui_source: 'dim_toggle',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });
    }
});
