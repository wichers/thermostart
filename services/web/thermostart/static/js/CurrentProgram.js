var CurrentProgramView = Backbone.View.extend({

    options: {
        labels: {
            'date': i18n['overview.CurrentProgramDate'],
            'start': i18n['overview.CurrentProgramStart'],
            'end': i18n['overview.CurrentProgramEnd'],
            'temperature': i18n['overview.CurrentProgramTemperature']
        }
    },

    initialize: function() {
        
        _.bindAll(this, 'render');
        
        this.dateStringEl = this.$('.date-string');
        this.predefinedTemperatureEl = this.$('.predefined-temperature');
        this.blockTitleEl = this.$('.title');
        this.blockStartTimeEl = this.$('.start-time');
        this.blockEndTimeEl = this.$('.end-time');
        this.blockEndTimeEl = this.$('.end-time');
        this.iconProgramEl = this.options.programIconEl || this.$('.icon-program');
        
        setInterval(this.render, 1000);
        
        this.render();
    },
    
    // A helper to prepend a zero to single digit values.
    pad: function(t) {
        
        return (t + '').length == 2 ? t : '0' + t;
    },

    render: function(){
        
        // Update clock.
        var now = this.model.getCurrentMoment().toDate();
        var nowHour = this.pad(now.getHours());
        var nowMinute = this.pad(now.getMinutes());
        
        var dateString = Config.weekdayNamesShort[now.mGetDay()] + ' ' + 
            now.getDate() + ' ' + Config.monthNamesShort[now.getMonth()] + ', ' + 
            nowHour + ':' + nowMinute;
        
        if (thermostat.has('utc_offset')) {
            this.dateStringEl.html(this.options.labels.date + '<span>' + dateString + '</span>');
        } else {
            this.dateStringEl.html(i18n['overview.Loading']);
        }
        
        this.updateCurrentBlockInfo();
    },

    updateCurrentBlockInfo: function(){

        var currentBlock = this.model.getCurrentBlock();
        if (currentBlock) {
            
            var weekDayStart = Config.weekdayNamesShort[currentBlock.start.day];
            var weekDayEnd = Config.weekdayNamesShort[currentBlock.end.day];
            var startHour = this.pad(currentBlock.start.hour);
            var startMinute = this.pad(currentBlock.start.minute);
            var endHour = this.pad(currentBlock.end.hour);
            var endMinute = this.pad(currentBlock.end.minute);
            var oldProgram = this.$el.data('current_program');
            var predefinedTemperature = this.model.get('predefined_temperatures')[currentBlock.program];
            var isSetManually = _.contains([
                ThermostatModel.SOURCE_MANUAL,
                ThermostatModel.SOURCE_SERVER
            ], this.model.get('source'));

            // alternative: if we manually set the temperature to a temperature that is equal to the programmed
            // temperature we remove the manual settings mode.
            // if (isSetManually && predefinedTemperature != this.model.get('target_temperature')) {

            if (isSetManually) {
                // Manual settings

                if (oldProgram !== 'manual') {

                    this.$el.attr('data-type', 'manual');
                    this.$el.data('current_program', 'manual');
                    this.blockTitleEl.text(i18n['program.manual'] || 'Handbediend');
                    this.predefinedTemperatureEl.hide();
                    this.blockStartTimeEl.html('<span/>');
                    this.iconProgramEl.removeClass('icon-clock').addClass('icon-manual');
                }

                this.blockEndTimeEl.html(this.options.labels.end + "<span>" + weekDayEnd + ' ' + endHour + ':' + endMinute  + '</span>');

            } else {
                // Programmed

                if (oldProgram !== currentBlock.program) {

                    this.$el.data('current_program', currentBlock.program);
                    this.$el.attr('data-type', currentBlock.program);
                    this.blockTitleEl.text(currentBlock.programFullName);
                    this.predefinedTemperatureEl.html(this.options.labels.temperature + '<span>' + (predefinedTemperature / 10) + '</span>').show();
                    this.iconProgramEl.removeClass('icon-manual').addClass('icon-clock');
                }

                this.blockStartTimeEl.html(this.options.labels.start + "<span>" + weekDayStart + ' ' + startHour + ':' + startMinute + '</span>');
                this.blockEndTimeEl.html(this.options.labels.end + "<span>" + weekDayEnd + ' ' + endHour + ':' + endMinute  + '</span>');
            }
        }
    }
});
