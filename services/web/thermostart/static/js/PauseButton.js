var PauseButton = Backbone.View.extend({

    options: {
        pauseTemperature: 50
    },

    events: function() {

        var events = {};
        if (window.ontouchstart) {
            events.touchstart = 'toggle';
        } else {
            events.click = 'toggle';
        }

        return events;
    },

    initialize: function() {
        
        _.bindAll(this, 'reflectChanges');
        
        this.model.bind('change:source', this.reflectChanges);
    },

    reflectChanges: function() {

        if (this.model.get('source') === ThermostatModel.SOURCE_PAUSE) {

            this.$el.addClass('inactive');
            //this.$el.find('span').text('Heractiveer programma');
            
        } else {
            
            this.$el.removeClass('inactive');
            //this.$el.find('span').text('Pauzeer programma');
        }
    },

    toggle: function(evt) {

	evt.stopPropagation();
	evt.preventDefault();

        if (evt.handled) return false;

        var source = this.model.get('source');
        var pause = source === ThermostatModel.SOURCE_PAUSE;

        pause = !pause;

        var currentBlock;
        if (!pause) {

            currentBlock = this.model.getCurrentBlock();
        }

        var predefined_temperatures = this.model.get('predefined_temperatures');
        var pauseTemperature = predefined_temperatures['pause'] || this.options.pauseTemperature;
        
        // Note that this also triggers `reflectChanges()`.
        this.model.save({

            source: pause ? ThermostatModel.SOURCE_PAUSE : currentBlock.source,
            set_temperature: pause ? pauseTemperature : predefined_temperatures[currentBlock.program],
            ui_synced: false,
            ui_source: 'pause_button',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });

        evt.handled = true;
    }
});
