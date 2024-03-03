var ts = window.ts || {};

ts.temperatureCalibrationToggle = Backbone.View.extend({

    events: function() {
        return isiPad ? { 'touchstart .button': 'toggle' } : {
            'click .button': 'toggle',
            'mouseover .temperature': 'showTooltip',
            'mouseout .temperature': 'hideTooltip'
        }
    },

    initialize: function() {

        var $temperature = this.$('.temperature');

        this.listenTo(this.model, 'change:ta', function() {
            $temperature.text(this.model.get('ta') / 10);
        });

	this.$tooltip = $('<label class="tooltip"></label>').appendTo(document.body);
    },

    toggle: function(evt) {

        evt.preventDefault();

        var sign = $(evt.target).hasClass('button-lower') ? -1 : 1;

        var ta = (this.model.get('ta') || 0) / 10 + sign * 0.5;

        ta = Math.max(-2.5, Math.min(2.5, ta));

        // Round to the nearest 0.5.
        ta = Math.round(ta * 2) / 2;

        this.model.save({
            ta: ta * 10,
            ui_synced: false,
            ui_source: 'temperature_calibration',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });
    },

    showTooltip: function(evt) {

        var offset = $(evt.target).offset();

        var measured = thermostat.get('measured_temperature') / 10;
        var corrected = measured + this.model.get('ta')  / 10;

	var tip = measured + '°C > ' + corrected + '°C';

	this.$tooltip.css({ left: offset.left + 30, top: offset.top + 30 }).html(tip).show();
    },

    hideTooltip: function() {

        this.$tooltip.hide();
    }

});
