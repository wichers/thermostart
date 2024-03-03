var Config = {
    predefinedTemperatures: {
        'anti_freeze': i18n['program.anti_freeze'],
        'home': i18n['program.home'],
        'not_home': i18n['program.not_home'],
        'comfort': i18n['program.comfort'],
        'pause': i18n['program.pause']
    },
    weekdayNamesShort: i18n['weekdaysShort'],
    monthNamesShort: i18n['monthsShort']
};

// replacement for getDay, where monday is the first in the array in stead of sunday
Date.prototype.mGetDay = function() {
    
    return (this.getDay() + 6) % 7;
};
