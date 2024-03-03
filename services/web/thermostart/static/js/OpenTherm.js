var ts = window.ts || {};

ts.OpenTherm = Backbone.View.extend({

    options: {
        data: {}
    },

    itemTemplate: [
        '<tr><td><%= param %></td><td><%= value %></td></tr>'
    ].join(''),

    separatorTemplate: [
        '<tr class="separator"><td></td><td></td></tr>'
    ].join(''),
    
    template: [
        '<table>',
        '<thead>',
        '<tr><th>Name</th><th>Value</th></tr>',
        '</thead>',
        '<tbody></tbody>',
        '</table>'
    ].join(''),

    render: function() {

        this.$el.empty();
        this.$el.append(_.template(this.template));
        
        var $container = this.$('tbody');

        var itemTemplate = this.itemTemplate;
        var separatorTemplate = this.separatorTemplate;
        function appendItem(data) { $container.append(_.template(itemTemplate)(data)); }
        function appendSeparator() { $container.append(_.template(separatorTemplate)()); }

        // OT 0
        var ot0 = this.options.data[0];
        if (ot0) {

            appendItem({ param: 'CH enable', value: ot0[8] ? 'true' : 'false' });
            appendItem({ param: 'DHW enable', value: ot0[9] ? 'true' : 'false' });
            appendItem({ param: 'Cooling enable', value: ot0[10] ? 'true' : 'false' });
            appendItem({ param: 'OTC active', value: ot0[11] ? 'true' : 'false' });
            appendItem({ param: 'CH2 enable', value: ot0[12] ? 'true' : 'false' });
            appendItem({ param: 'Summer/Winter mode', value: ot0[13] ? 'winter mode active' : 'summer mode active' });
            appendItem({ param: 'DHW blocking', value: ot0[14] ? 'DHW unblocked' : 'DHW blocked' });

            appendItem({ param: 'Fault indication', value: ot0[0] ? 'no fault' : 'fault' });
            appendItem({ param: 'CH mode', value: ot0[1] ? 'CH not active' : 'CH active' });
            appendItem({ param: 'DHW mode', value: ot0[2] ? 'DHW not active' : 'DHW active' });
            appendItem({ param: 'Flame status', value: ot0[3] ? 'flame off' : 'flame on' });
            appendItem({ param: 'Cooling status', value: ot0[4] ? 'cooling mode not active' : 'cooling mode active' });
            appendItem({ param: 'CH2 mode', value: ot0[5] ? 'CH2 not active' : 'CH2 active' });
            appendItem({ param: 'Diagnostic/service indication', value: ot0[6] ? 'no diagnostic/service' : 'diagnostic/service event' });
            appendItem({ param: 'Electricity production', value: ot0[7] ? 'off' : 'on' });

            appendSeparator();
        }            
        
        // OT 1
        var ot1 = this.options.data[1];
        appendItem({ param: 'Control setpoint', value: ot1 });

        appendSeparator();
        
        // OT 3
        var ot3 = this.options.data[3];
        if (ot3) {
        
            appendItem({ param: 'DHW present', value: ot3[0] ? 'present' : 'not present' });
            appendItem({ param: 'Control type', value: ot3[1] ? 'on/off' : 'modulating' });
            appendItem({ param: 'Cooling config', value: ot3[2] ? 'cooling not supported' : 'cooling supported' });
            appendItem({ param: 'DHW config', value: ot3[3] ? 'storage tank' : 'instantaneous or not-specified' });
            appendItem({ param: 'Master low-off &amp; pump control function', value: ot3[4] ? 'not allowed' : 'allowed' });
            appendItem({ param: 'CH2 present', value: ot3[5] ? 'present' : 'not present' });
            appendItem({ param: 'Remote water filling function', value: ot3[6] ? 'not available' : 'available or unknown' });
            appendItem({ param: 'Heat/cool mode control', value: ot3[7] ? 'mode switching done by slave' : 'mode switching can be done by master' });

            appendSeparator();
        }
        
        // OT 17
        var ot17 = this.options.data[17];
        appendItem({ param: 'Relative modulation level', value: ot17 });

        appendSeparator();
        
        // OT 25
        var ot25 = this.options.data[25];
        appendItem({ param: 'Boiler water temperature', value: ot25 });

        return this;
    }
});