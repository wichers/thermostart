var DirectTemperatureSetter = Backbone.View.extend({

    options: {
        maxTemperature: 300,
        minTemperature: 50,
        step: 5
    },

    events: function() {
        return isiPad ? {
            'touchstart .button-higher': 'up',
            'touchstart .button-lower': 'down'
        } : {
            'click .button-higher': 'up',
            'click .button-lower': 'down',
        }
    },

    initialize: function() {
        
        _.bindAll(this, 'adjustSetTemperature', 'adjustMeasuredTemperature');

        this.model.bind('change:target_temperature', this.adjustSetTemperature);
        this.model.bind('change:room_temperature', this.adjustMeasuredTemperature);

        this.setTemperatureElement = this.$('.set .temperature');
        this.measuredTemperatureElement = this.$('.measured .temperature');

        this.listenTo(this.model, 'change:room_temperature change:target_temperature', this.updateIcon);
    },

    updateIcon: function() {

        var measured = this.model.get('room_temperature');
        var set = this.model.get('target_temperature');
        var $icon = $(this.options.icon);

        $icon.removeClass('icon-thermometer icon-thermometer-minus icon-thermometer-plus');

        if (measured > set) {
            $icon.addClass('icon-thermometer-minus');
        } if (set > measured) {
            $icon.addClass('icon-thermometer-plus');
        } else {
            $icon.addClass('icon-thermometer');
        }
    },

    up: function(evt) {

        evt.preventDefault();

        var t = this.model.get('target_temperature');
	if (t + this.options.step <= this.options.maxTemperature) {

	    this.model.save({
                
                target_temperature: t + this.options.step,
                pause: false,
                source: ThermostatModel.SOURCE_SERVER,
                ui_synced: false,
                ui_source: 'direct_temperature_setter_up',
                ui_change_time: new Date,
                ui_change_browser: navigator.userAgent
            });
            this.trigger('up');
	}
    },

    down: function(evt) {

        evt.preventDefault();
        
        var t = this.model.get('target_temperature');
	if (t - this.options.step >= this.options.minTemperature) {
            
	    this.model.save({

                target_temperature: t - this.options.step,
                pause: false,
                source: ThermostatModel.SOURCE_SERVER,
                ui_synced: false,
                ui_source: 'direct_temperature_setter_down',
                ui_change_time: new Date,
                ui_change_browser: navigator.userAgent
            });
            this.trigger('down');
	}
    },

    adjustSetTemperature: function() {
        
        this.setTemperatureElement.text((this.model.get('target_temperature') / 10).toFixed(1));

        this.$el.removeClass('max-temperature min-temperature');
        
	if (this.model.get('target_temperature') >= this.options.maxTemperature) {
            
	    this.$el.addClass('max-temperature');
            
	} else if (this.model.get('target_temperature') <= this.options.minTemperature) {
            
	    this.$el.addClass('min-temperature');
	}
    },

    adjustMeasuredTemperature: function() {

        var t = (this.model.get('room_temperature') / 10);
        // Round to the nearest 0.5.
        t = Math.round(t * 2) / 2;
        
        this.measuredTemperatureElement.text(t.toFixed(1));
    }
});

