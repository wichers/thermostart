var ts = window.ts || {};

ts.AutoPauseToggle = Backbone.View.extend({

  events: {
    'click .switch': 'switch',
  },

  initialize: function () {

  },

  switch: function (evt) {

    var button = $(evt.target).closest('.auto-pause-toggle').find('.switch');
    button.toggleClass("inactive");

    var xhr = $.ajax({
      type: 'POST',
      dataType: 'json',
      url: '/set-geofence-enabled',
      data: { enabled: !button.hasClass("inactive") }
    });
    
    xhr.done(function (data, textStatus, xhr) {
      if (data && data.ok) {
        // Do nothing, everything is OK
      } else {
        alert('Something went wrong. Please try again.');
      }
    })
    xhr.fail(function () {
      alert('Something went wrong. Please try again.');
    });
  },
});
