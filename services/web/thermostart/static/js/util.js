window.ts = window.ts || {};
window.ts.util = window.ts.util || {};

window.ts.util.normalizeEvent = function(evt) {

    if (evt.changedTouches && evt.changedTouches.length) {
        
        evt = evt.changedTouches[0];
        
    } else if ((evt.originalEvent && evt.originalEvent.changedTouches && evt.originalEvent.changedTouches.length)) {
        
        evt = evt.originalEvent.changedTouches[0];
    }

    return evt;
};