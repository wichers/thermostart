// Global namespace.

// Do this as soon as possible.
var isiPad = navigator.userAgent.match(/iPad/i) != null;
if (isiPad) {
    $(document.body).addClass('device-tablet');
}

var isFirstTime = (location + '').indexOf('first=true') !== -1;

var App = Backbone.Router.extend({

    routes: {
        'home': 'home',
        'standard-week': 'standardWeek',
        'exceptions': 'exceptions',
        'settings': 'settings',
        'ot': 'ot'
    },

    openPage: function(page) {
        $('#navigation-links').show();
        $('#container')
            .removeClass('navigation-overview navigation-exceptions navigation-standard-week navigation-ot navigation-settings navigation-account')
            .addClass(page);
        $('.alert').remove();
    },

    home: function() {
        this.openPage('navigation-overview');
    },

    standardWeek: function() {
        
        this.openPage('navigation-standard-week');
    },
    exceptions: function() {
        
        this.openPage('navigation-exceptions');
    },
    settings: function() {

        this.openPage('navigation-settings');
    },
    ot: function() {

        this.openPage('navigation-ot');
    }
});

$(function() {
    var thermostat = window.thermostat = new ThermostatModel();

    var thermostatUsername = $('body').attr('data-thermostat-username');
    
    // Instantiate widgets.
    // --------------------
    
    ts.initializeStandardWeek(
        thermostat,
        $('.standard-week-container'),
        $('.standard-week-programs .temperature-buttons-container')
    );
    
    ts.initializeExceptions(
        thermostat,
        $('.exceptions-container'),
        $('.exceptions-programs .temperature-buttons-container')
    );

    ts.initializeOverview(
        thermostat,
        $('.overview-container'),
        { updateTimeIndicator: true }
    );

    var directTemperatureSetter = new DirectTemperatureSetter({
        el: $('#adjust-temp-container'),
        icon: $('#adjust-temp-icon'),
        model: thermostat
    });

    var weather = new WeatherView({ el: $('#outside-temperature'), model: thermostat });
    var currentProgram = new CurrentProgramView({ el:$('#block-info'), model: thermostat, programIconEl: $('#program-icon') });
    var pauseButton = new PauseButton({ el: $('.button-pause'), model: thermostat });

    if ($('.dim-toggle').length) {
        var dimToggle = new ts.DimToggle({ el: $('.dim-toggle'), model: thermostat });
    }

    if ($('.statusled-mode-toggle').length) {
        var statusledToggle = new ts.StatusledToggle({ el: $('.statusled-mode-toggle'), model: thermostat });
    }

    if ($('.locale-toggle').length) {
        var localeToggle = new ts.LocaleToggle({ el: $('.locale-toggle'), model: thermostat });
    }

    if ($('.display-mode-toggle').length) {
        var displayModeToggle = new ts.DisplayModeToggle({ el: $('.display-mode-toggle'), model: thermostat });
    }

    if ($('.firmware-toggle').length) {
        var firmwareToggle = new ts.FirmwareToggle({ el: $('#firmware-container'), model: thermostat });
    }

    if ($('.factory-reset').length) {
        
        $('.factory-reset .btn-reset-standard-week').on('click', function() {

            thermostat.resetStandardWeekToDefault();
        });

        $('.factory-reset .btn-remove-profile').on('click', function() {

            var removeProfileDialog = new RemoveProfileDialog();
            removeProfileDialog.on('ok', function() {
                location.href = '/profile/remove';
            });
            removeProfileDialog.render().show();
        });
    }

    if ($('.temperature-calibration-toggle').length) {
        var temperatureCalibrationToggle = new ts.temperatureCalibrationToggle({
            el: $('.temperature-calibration-toggle'),
            model: thermostat
        });
    }
    
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////

    // Broker setup.
    // -------------
    
    var broker = window.broker = io({path: appPath + 'socket.io'});
    
    broker.on('error', function(reason) {
        console.error('Unable to establish RT communication channel.', reason);
    });
    broker.on('disconnect', function(reason) {
        console.error('RT communication channel disconnected.', reason);
    });

    broker.on('connect', function() {
        console.log('Successfully established RT communication channel.');
    });

    broker.on('outside_temperature', function(data) { thermostat.set(data); });
    broker.on('room_temperature', function(data) { thermostat.set(data); });
    broker.on('target_temperature', function(data) { thermostat.set(data); });
    broker.on('source', function(data) { thermostat.set(data); });
    broker.on('location', function(data) { thermostat.set(data); });
    // A change from some other UI.
    broker.on('broadcast-thermostat', function(data) { thermostat.set(data); });
    
    thermostat.fetch();

    var app = window.app = new App();
    Backbone.history.start();

    // JVO issue on mobile where the click is always handled, menu item is enough
    // GOTO exceptions agenda if the overview contains is clicked. Dirty but functional ;-)
    //$('.overview-container').on('click touchstart', function() {
    //    app.navigate('exceptions', { trigger: true });
    //});

});

function enableKonami(callback) {

    var ki = 0;
    var konami = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    
    if (typeof KeyboardJS !== 'undefined') {

        $(document).on('keyup keydown', function() {

            _.defer(function() {

                var keys = KeyboardJS.activeKeys();
                if (!keys || !keys.length) return;

                for (var i = 0; i < keys.length; i += 1) {
                    // Check to see if the key is part of the konami code.
                    if (keys[i] === konami[ki]) {
                        if (ki < konami.length - 1) {
                            ki += 1;
                        } else {
                            callback();
                        }
                    } else {
                        ki = 0;
                    }
                }
            });
        });
    }
}
