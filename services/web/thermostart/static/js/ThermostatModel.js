var ThermostatModel = Backbone.Model.extend({

    defaults: {
        url: 'thermostatmodel'
    },

    isDemoAccount: function(username) {

        var username = username || this.get('username') || '';
        if (username.substr(0, 'demo'.length) === 'demo') {
            return true;
        }
        return false;
    },

    findExceptionsBlock: function(time, exceptions) {

        var block;

        exceptions = exceptions || this.get('exceptions');

        _.each(exceptions, function(exception) {

            var startTime = new Date(exception.start[0], exception.start[1], exception.start[2], exception.start[3], exception.start[4]);
            var endTime = new Date(exception.end[0], exception.end[1], exception.end[2], exception.end[3], exception.end[4]);

            if (time > startTime && time < endTime) {

                var endDay = endTime.mGetDay();
                var endHour = exception.end[3];
                // Small correction for when e.g. Friday 00:00 is returned, and exception actually ends Thursday 24:00.
                if (endTime.getHours() === 0 && endHour === 24) {
                    endDay = (endDay - 1 + 7) % 7;      // make sure we modulate over the week (i.e. -1 => Sunday)
                }

                block = {

                    source: ThermostatModel.SOURCE_EXCEPTION,
                    programFullName: Config.predefinedTemperatures[exception.temperature],
                    start: {
                        day: startTime.mGetDay(),       // note mGetDay() is defined in config.js and returns days starting on Monday instead of Sunday
                        hour: exception.start[3],
                        minute: exception.start[4]
                    },
                    end: {
                        day: endDay,
                        hour: endHour,
                        minute: exception.end[4]
                    },
                    program: exception.temperature
                };
            }

        }, this);

        return block;
    },

    findStandardWeekBlock: function(time, standardWeek) {

        // Compute week minutes for easier comparison.
        var timeWeekMinutes = time.mGetDay() * 24 * 60 + time.getHours() * 60 + time.getMinutes();

        standardWeek = standardWeek || this.get('standard_week');

        standardWeek = _.sortBy(standardWeek, function(item) {
            return item.start[0] * 100000 + item.start[1] * 1000 + item.start[2] * 1;
        });

        var currentStandardWeekBlock;
        var nextStandardWeekBlock;

        for (var i = 0; i < standardWeek.length - 1; i++) {

            var currentItem = standardWeek[i];
            var nextItem = standardWeek[i + 1];

            if (nextItem) {

                var currentItemWeekMinutes = currentItem.start[0] * 24 * 60 + currentItem.start[1] * 60 + currentItem.start[2];
                var nextItemWeekMinutes = nextItem.start[0] * 24 * 60 + nextItem.start[1] * 60 + nextItem.start[2];

                if (timeWeekMinutes > currentItemWeekMinutes && timeWeekMinutes < nextItemWeekMinutes) {

                    currentStandardWeekBlock = currentItem;
                    nextStandardWeekBlock = nextItem;
                }
            }
        }

        // If none found, get last item.
        if (!currentStandardWeekBlock) {

            currentStandardWeekBlock = standardWeek[standardWeek.length - 1];
            nextStandardWeekBlock = standardWeek[0];
        }

        if (!currentStandardWeekBlock) {

            // If still nothing, then this model is probably empty.
            return undefined;
        }

        return {

            source: ThermostatModel.SOURCE_STD_WEEK,
            programFullName: Config.predefinedTemperatures[currentStandardWeekBlock.temperature],
            start: {
                day: currentStandardWeekBlock.start[0],
                hour: currentStandardWeekBlock.start[1],
                minute: currentStandardWeekBlock.start[2]
            },
            end: {
                day: nextStandardWeekBlock.start[0],
                hour: nextStandardWeekBlock.start[1],
                minute: nextStandardWeekBlock.start[2]
            },
            program: currentStandardWeekBlock.temperature
        };
    },

    getCurrentBlock: function() {

        var now = this.getCurrentMoment().toDate();
        // Try to find exception first, then standard week block
        var currentBlock = this.findExceptionsBlock(now) || this.findStandardWeekBlock(now);

        return currentBlock;
    },

    resetStandardWeekToDefault: function() {

        this.save({
            standard_week: [{ 'start':[0, 6, 30], 'temperature':'home' }, { 'start':[0, 7, 30], 'temperature':'not_home' }, { 'start':[0, 17, 0], 'temperature':'home' }, { 'start':[0, 20, 30], 'temperature':'pause' }, { 'start':[1, 6, 30], 'temperature':'home' }, { 'start':[1, 7, 30], 'temperature':'not_home' }, { 'start':[1, 17, 0], 'temperature':'home' }, { 'start':[1, 20, 30], 'temperature':'pause' }, { 'start':[2, 6, 30], 'temperature':'home' }, { 'start':[2, 7, 30], 'temperature':'not_home' }, { 'start':[2, 17, 0], 'temperature':'home' }, { 'start':[2, 20, 30], 'temperature':'pause' }, { 'start':[3, 6, 30], 'temperature':'home' }, { 'start':[3, 7, 30], 'temperature':'not_home' }, { 'start':[3, 17, 0], 'temperature':'home' }, { 'start':[3, 20, 30], 'temperature':'pause' }, { 'start':[4, 6, 30], 'temperature':'home' }, { 'start':[4, 7, 30], 'temperature':'not_home' }, { 'start':[4, 17, 0], 'temperature':'home' }, { 'start':[4, 20, 30], 'temperature':'pause' }, { 'start':[5, 7, 30], 'temperature':'home' }, { 'start':[5, 20, 30], 'temperature':'pause' }, { 'start':[6, 7, 30], 'temperature':'home' }, { 'start':[6, 20, 30], 'temperature':'pause' }]
        });
    },

    getCurrentMoment: function() {

        if (!this.has('utc_offset')) {
            // console.log('No UTC offset provided');
        }

        var localTime = moment();
        var utc_offset = this.get('utc_offset');

        return localTime.add(localTime.zone(), 'minutes').add(utc_offset, 'hours');
    }

}, {

    SOURCE_CRASH: 0,
    SOURCE_MANUAL: 1,
    SOURCE_SERVER: 2,
    SOURCE_STD_WEEK: 3,
    SOURCE_EXCEPTION: 4,
    SOURCE_PAUSE: 5
});

Backbone.sync = function(method, model, options) {

    if (method == 'read') {

        var params = {
            type: 'GET',
            dataType: 'json',
            url: model.get('url'),
            xhrFields: { withCredentials: true },
            crossDomain: true
        };

        return $.ajax(_.extend(params, options));

    } else if (method == 'create') {

        // `mobile_ui_change_processed` makes sure that we are not interested in `broadcast-thermostat` changes
        // unless we get back `mobile_ui_change_processed` flag. This prevents collisions in
        // thermostat changes.

        var dataToSend = {

                exceptions: model.get('exceptions'),
                room_temperature: model.get('room_temperature'),
                outside_temperature: model.get('outside_temperature'),
                predefined_temperatures: model.get('predefined_temperatures'),
                predefined_labels: model.get('predefined_labels'),
                target_temperature: model.get('target_temperature'),
                standard_week: model.get('standard_week'),
                source: model.get('source'),
                ui_synced: model.get('ui_synced'),
                ui_source: model.get('ui_source'),
                ui_change_time: model.get('ui_change_time'),
                ui_change_browser: model.get('ui_change_browser'),
                ta: model.get('ta'),
                dim: model.get('dim'),
                sl: model.get('sl'),
                sd: model.get('sd'),
                locale: model.get('locale'),
                host: model.get('host'),
                port: model.get('port'),
                dhw_programs: model.get('dhw_programs')
            };

        window.broker.emit('store-thermostat', dataToSend);
    }
};
