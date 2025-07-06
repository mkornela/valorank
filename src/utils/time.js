function getPolandTimezoneOffset(date) {
    const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const polandTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    return polandTime.getTime() - utcTime.getTime();
}

function getSessionTimeRange(sinceTimestampMs, resetTimeParam) {
    const now = new Date();
    let startTime;
    
    if (resetTimeParam) {
        if (!/^\d{4}$/.test(resetTimeParam)) {
            throw new Error('Invalid resetTime format. Use HHMM format (e.g., 0800 for 8:00 AM).');
        }
        
        const hours = parseInt(resetTimeParam.substring(0, 2), 10);
        const minutes = parseInt(resetTimeParam.substring(2, 4), 10);
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error('Invalid resetTime. Hours must be 00-23, minutes must be 00-59.');
        }
        
        const nowInPoland = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
        
        const todayInPoland = new Date(nowInPoland);
        todayInPoland.setHours(hours, minutes, 0, 0);
        
        let resetTimeInPoland;
        
        if (nowInPoland.getTime() < todayInPoland.getTime()) {
            resetTimeInPoland = new Date(todayInPoland);
            resetTimeInPoland.setDate(resetTimeInPoland.getDate() - 1);
        } else {
            resetTimeInPoland = todayInPoland;
        }
        
        startTime = new Date(Date.UTC(
            resetTimeInPoland.getFullYear(),
            resetTimeInPoland.getMonth(),
            resetTimeInPoland.getDate(),
            resetTimeInPoland.getHours(),
            resetTimeInPoland.getMinutes(),
            0,
            0
        ));
        
        const polandOffset = getPolandTimezoneOffset(startTime);
        startTime = new Date(startTime.getTime() - polandOffset);
    }
    else if (sinceTimestampMs && !isNaN(sinceTimestampMs) && sinceTimestampMs > 0) {
        startTime = new Date(sinceTimestampMs);
    }
    else {
        const polandDate = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }));
        startTime = new Date(polandDate.getFullYear(), polandDate.getMonth(), polandDate.getDate(), 0, 0, 0, 0);
    }
    
    return { startTime, endTime: now };
}

module.exports = {
    getPolandTimezoneOffset,
    getSessionTimeRange
};