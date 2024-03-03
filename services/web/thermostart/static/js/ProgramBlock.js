var ProgramBlock = Backbone.View.extend({
    
    events: {
        'mousedown .button-temperature:not(.pause)': 'programDragStart',
        'touchstart .button-temperature:not(.pause)': 'programDragStart',
        'click .change-link': 'editProgram'
    },

    initialize: function() {
        _.bindAll(this, 'render', 'programDragStart', 'editProgram', 'changeProgramTemperature');

        if (this.options.editable) {
            this.programEditDialog = new StandardWeekProgramEditDialog({
                model: this.model
            });
            this.programEditDialog.bind('ok', this.changeProgramTemperature);
        }

        this.model.bind('change:predefined_temperatures', this.render);
    },

    render: function() {
        var predefinedTemperatures = this.model.get('predefined_temperatures');
        _.each(predefinedTemperatures, function(value, key) {
            var button = this.$('.button-temperature[data-type="' + key + '"]'),
                temperatureElement = button.find('.temperature');
            temperatureElement.text(value / 10);
            button.attr('data-temperature', value);
        }, this);
    },

    programDragStart: function(evt) {

        evt.preventDefault();

        evt = ts.util.normalizeEvent(evt);

        var button = $(evt.target).closest('div');
        this.trigger('program-drag', button);
    },

    editProgram: function(evt) {
        this.editProgramType = $(evt.target).attr('data-type');
        var temperature = (this.model.get('predefined_temperatures')[this.editProgramType]) / 10;
        this.programEditDialog.setSelectedTemperature(temperature);
        this.programEditDialog.show();
        evt.stopPropagation();
        evt.preventDefault();
    },

    changeProgramTemperature: function() {
        var temperature = parseFloat(this.programEditDialog.getSelectedTemperature()) * 10,
            predefinedTemperatures = _.clone(this.model.get('predefined_temperatures'));

        // Note that we are cloning the predefined temperatures from the model so
        // that if we change one of the program temperature, the change is
        // recognized in `model.set()`. Otherwise, we would be manipulating
        // the same object.
        predefinedTemperatures[this.editProgramType] = temperature;
        
        this.model.save({ 'predefined_temperatures': predefinedTemperatures });
    }
    
});
