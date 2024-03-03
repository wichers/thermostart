$(function(){

var ProfileView = Backbone.View.extend({
    el: '#profile-container',

    events: {
        "change select[name='country']": 'onChangeCountry',
    },

    initialize: function() {
        _.bindAll(this, 'onChangeCountry');
        this.city = this.$('select[name="city"]');
    },

    onChangeCountry: function(evt) {
        var param = evt.target.value;

        var xhr = $.ajax({
          type: 'POST',
          dataType: 'json',
          url: '/account-cities',
          data: { country: param }
        });
    
        xhr.done(_.bind(function(data, xhr) {
            this.city.empty();
            this.city.append($('<option/>', {val: '', text: '-- Select a city --'}));
                _.each(data, function(row) {
                this.city.append($('<option/>', {
                    val: row['id'],
                    text: row['city']
                }));
            }, this);
        }, this));
    },
  });


  var App = new ProfileView;
});
