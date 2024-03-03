var ts = window.ts || {};

ts.AutoPauseDevices = Backbone.View.extend({

  events: {
    'click .device-btn-remove': 'showRemoveDialog',
  },

  initialize: function () {

    this.appRemoveDialog = new DeviceRemoveDialog;
    this.appRemoveDialog.on('ok', function () {

      this.removeDevice(this.appRemoveDialog.device)

    }, this);

  },

  showRemoveDialog: function (evt) {
    var attr = $(evt.target).closest('.device').data('device')
    this.appRemoveDialog.device = JSON.parse(decodeURI(attr));
    this.appRemoveDialog.render().show();
  },

  removeDevice: function (device) {
    
    var xhr = $.ajax({
      type: 'POST',
      dataType: 'json',
      url: '/remove-geofence-device',
      data: { hw_id: device.hw_id }
    });

    xhr.done(function (data, textStatus, xhr) {
      if (data && data.ok) {
        $("#" + device.hw_id).remove()
      } else {
        alert('Something went wrong. Please try again.');
      }
    }.bind(this))

    xhr.fail(function () {
      alert('Something went wrong. Please try again.');
    });
  },
});
