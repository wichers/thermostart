var Dialog = Backbone.View.extend({

    events: function() {

        var events = {};
        if (window.ontouchstart) {
            events['touchstart .ok'] = 'ok';
            events['touchstart .cancel'] = 'cancel';
        } else {
            events['click .ok'] = 'ok';
            events['click .cancel'] = 'cancel';
        }

        return events;
    },

    ok: function(evt) {

        evt.preventDefault();
        evt.stopPropagation();

        this.hide();
        this.trigger('ok');
    },
    cancel: function(evt) {

        evt.preventDefault();
        evt.stopPropagation();

        this.hide();
        this.trigger('cancel');
    },

    hide: function() {
        $(this.el).hide();
    },
    show: function() {
        $(this.el).show();
    }
});


var StandardWeekBlockEditDialog = Dialog.extend({

    el: $('#dialog-edit-standard-week'),

    initialize: function() {
        _.bindAll(this, 'render');
        this.model.bind('change:predefined_temperatures', this.render);
        this.select = this.$('.select-predef select');
    },

    render: function() {
        this.select.empty();
        _.each(this.model.get('predefined_temperatures'), function(predefinedTemperature, key) {
            if (key !== 'pause') {
                this.select.append($('<option/>', {
                    val: key,
                    text: Config.predefinedTemperatures[key]
                }));
            }
        }, this);
        this.select.selectOrDie();
    },

    getSelectedPredefinedTemperature: function() {
        return this.select.val();
    },
    setSelectedPredefinedTemperature: function(key) {
        this.select.val(key);
        this.select.selectOrDie('update');
    }
});

var StandardWeekProgramEditDialog = Dialog.extend({

    ICHECK_CLASS: 'iradio_minimal-grey',

    events: function() {
        return isiPad ? {
            'touchstart .button-higher': 'up',
            'touchstart .button-lower': 'down',
            'touchstart .ok': 'ok',
            'touchstart .cancel': 'cancel'
        } : {
            'click .button-higher': 'up',
            'click .button-lower': 'down',
            'click .ok': 'ok',
            'click .cancel': 'cancel'
        };
    },

    el: $('#dialog-edit-program'),

    initialize: function() {
        this.$output = this.$('.set-temperature .temperature');

        this.$('input[type="radio"]').iCheck({ radioClass: this.ICHECK_CLASS });
    },

    render: function() {
        this.$el.attr('data-type', this.blockType)
            .find('.program-name > span').text(this.blockName);

        // Thermostats with firmware higher of equal this number have enabled domestic hot water setting.
        var FW_DHW_ENABLED = 20140825; // >=

        var fw = this.model.get('fw');
        var hw = this.model.get('hw');
        var oo = this.model.get('oo');
        // DHW is only available for OT connected thermostats or TS Advanced version (even on/off).
        if (!fw || (parseInt(fw, 10) < FW_DHW_ENABLED) || oo !== 1) {
            this.$('.set-dhw').hide();
        }
        if (hw === 3) { // TS Advanced version.
            this.$('.set-dhw').show();
        }

        if (this.model.get('dhw_programs') && this.model.get('dhw_programs')[this.blockType]) {
            this.$('.dhw-mode-enabled').iCheck('check');
            this.$('.dhw-mode-disabled').iCheck('uncheck');
        } else {
            this.$('.dhw-mode-disabled').iCheck('check');
            this.$('.dhw-mode-enabled').iCheck('uncheck');
        }

        this.$('.input-name').val(this.blockName);

        return this;
    },

    getSelectedTemperature: function() {
        return this.temperature;
    },

    getName: function() {
        return this.$('.input-name').val();
    },

    setSelectedTemperature: function(temperature) {
        this.temperature = temperature;
        this.updateTemperature();
    },

    getDHWMode: function() {
        if (this.$('.dhw-mode-enabled').is(':checked')) {
            return 1;
        }
        return 0;
    },

    up: function(evt) {

        evt.preventDefault();

        this.temperature += 0.5;
        this.temperature = Math.min(25, this.temperature);
        this.updateTemperature();
    },

    down: function(evt) {

        evt.preventDefault();

        this.temperature -= 0.5;
        this.temperature = Math.max(5, this.temperature);
        this.updateTemperature();
    },

    updateTemperature: function() {
        this.$output.text(this.temperature);
    }


});

var ExceptionsBlockEditDialog = Dialog.extend({

    el: $('#dialog-edit-exceptions'),

    initialize: function() {
        _.bindAll(this, 'render');
        this.model.bind('change:predefined_temperatures', this.render);
        this.select = this.$('.select-predef select');
    },

    render: function() {
        this.select.empty();
        _.each(this.model.get('predefined_temperatures'), function(predefinedTemperature, key) {
            if (key !== 'pause') {
                this.select.append($('<option/>', {
                    val: key,
                    text: Config.predefinedTemperatures[key]
                }));
            }
        }, this);
        this.select.selectOrDie();
    },

    getSelectedTemperature: function() {
        return this.select.val();
    },
    setSelectedTemperature: function(temperature) {
        this.select.val(temperature);
        this.select.selectOrDie('update');
    },

    setDescription: function(description) {
        this.$('.input-description input').val(description);
    },
    getDescription: function() {
        return this.$('.input-description input').val();
    }
});

var AppRevokeDialog = Dialog.extend({

    el: $('#dialog-app-revoke'),

    initialize: function() {
        _.bindAll(this, 'render');
    },

    render: function() {

        this.$('.app-name').text(this.appName);
        this.$('.app-author').text(this.appAuthor);
        this.$('.app-author-email').text(this.appAuthorEmail);

        return this;
    }
});


var DeviceRemoveDialog = Dialog.extend({
    
    el: $('#dialog-device-remove'),

    initialize: function() {
        _.bindAll(this, 'render');
    },

    render: function() {
        this.$('.model-name').text(this.device.model_name);
        this.$('.in-zone').text(this.device.in_zone ? "true" : "false");
        this.$('.updated-at').text(moment(this.device.updated_at).format('lll'));
        this.$('.created-at').text(moment(this.device.created_at).format('lll'));
        this.$('.hw-id').text(this.device.hw_id);
        return this;
    }
});

var RemoveProfileDialog = Dialog.extend({

    el: $('#dialog-remove-profile'),

    initialize: function() {
        _.bindAll(this, 'render');
    }
});
