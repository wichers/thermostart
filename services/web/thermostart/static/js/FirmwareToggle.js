var ts = window.ts || {};

ts.FirmwareToggle = Backbone.View.extend({

    events: {
        'mouseover [data-tip]': 'showTooltip',
        'mouseout [data-tip]': 'hideTooltip',
        'click .btn-download': 'downloadFirmware',
        "change input[name='host']": 'onChangeHost',
        "change input[name='port']": 'onChangePort'
    },

    initialize: function() {
		  this.$tooltip = $('<label class="tooltip"></label>').appendTo(document.body);
      this.listenTo(this.model, 'change:host', function() {
          this.$('input[name="host"]').val(this.model.get('host'));
      }, this);
      this.listenTo(this.model, 'change:port', function() {
          this.$('input[name="port"]').val(this.model.get('port'));
      }, this);
    },

    onChangeHost: function(evt) {
        
        this.model.save({ 
            host: $(evt.target).val(),
            ui_source: 'host_changed',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });
    },

    onChangePort: function(evt) {
        
        this.model.save({ 
            port: $(evt.target).val(),
            ui_source: 'port_changed',
            ui_change_time: new Date,
            ui_change_browser: navigator.userAgent
        });
    },

    showTooltip: function(evt) {
        var offset = $(evt.target).offset();
      	var tip = $(evt.target).data('tip');
      	this.$tooltip.css({ left: offset.left + 30, top: offset.top + 30 }).html(tip).show();
    },

    hideTooltip: function() {

        this.$tooltip.hide();
    },

    downloadFirmware: function(evt) {
    }
});
