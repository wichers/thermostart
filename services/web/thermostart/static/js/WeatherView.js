var WeatherView = Backbone.View.extend({

    initialize: function() {

        this.listenTo(this.model, 'change:outside_temperature', this.showOutsideTemperature);
        this.listenTo(this.model, 'change:outside_temperature_icon', this.showOutsideTemperatureIcon);
        this.listenTo(this.model, 'change:location', this.showLocation);
    },

    showLocation: function() {
        this.$('.location').text(this.model.get('location'));
    },

    showOutsideTemperature: function() {

        var t = (this.model.get('outside_temperature') || 0) / 10;
        // Round to the nearest 0.5.
        t = Math.round(t * 2) / 2;

        this.$('.temperature').text(t.toFixed(1));
    },

    showOutsideTemperatureIcon: function() {
        
        var icon = this.model.get('outside_temperature_icon');
        if (icon) {
            this.$('img').attr('src', 'static/images/weather/' + icon);
        } else {
            this.$('img').attr('src', 'static/images/shim.png');
        }
    }
});
