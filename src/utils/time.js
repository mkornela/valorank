const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');
const { pl } = require('date-fns/locale');

const POLAND_TIME_ZONE = 'Europe/Warsaw';


function parseMatchDateTimeToUtc(matchDate, matchTime) {
    const dateParts = matchDate.split(', ');
    const monthDay = dateParts[1];
    const year = dateParts[2];

    const timeParts = matchTime.split(' ');
    const time = timeParts[0];
    const period = timeParts[1];

    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours, 10);

    if (period === 'PM' && hour24 !== 12) {
        hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
        hour24 = 0;
    }

    const monthIndex = new Date(Date.parse(monthDay.split(' ')[0] + " 1, 2012")).getMonth();
    const day = parseInt(monthDay.split(' ')[1], 10);

    const naiveDateTimeString = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const incorrectUtcDate = fromZonedTime(naiveDateTimeString, 'Europe/Berlin');

    incorrectUtcDate.setHours(incorrectUtcDate.getHours() - 1);

    return incorrectUtcDate;
}

function getSessionTimeRange(sinceTimestampMs, resetTimeParam) {
    const nowUtc = new Date();

    if (resetTimeParam) {
        if (!/^\d{4}$/.test(resetTimeParam)) {
            throw new Error('Invalid resetTime format. Use HHMM format (e.g., 0800 for 8:00 AM).');
        }
        const hours = parseInt(resetTimeParam.substring(0, 2), 10);
        const minutes = parseInt(resetTimeParam.substring(2, 4), 10);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error('Invalid resetTime. Hours must be 00-23, minutes must be 00-59.');
        }
        
        const nowInPoland = toZonedTime(nowUtc, POLAND_TIME_ZONE);
        
        let resetTimeTodayInPoland = new Date(nowInPoland.getFullYear(), nowInPoland.getMonth(), nowInPoland.getDate(), hours, minutes, 0);

        if (nowInPoland.getTime() < resetTimeTodayInPoland.getTime()) {
            resetTimeTodayInPoland.setDate(resetTimeTodayInPoland.getDate() - 1);
        }
        
        const startTime = fromZonedTime(resetTimeTodayInPoland, POLAND_TIME_ZONE);
        return { startTime, endTime: nowUtc };

    } else if (sinceTimestampMs && !isNaN(sinceTimestampMs) && sinceTimestampMs > 0) {
        return { startTime: new Date(sinceTimestampMs), endTime: nowUtc };
    } else {
        const nowInPoland = toZonedTime(nowUtc, POLAND_TIME_ZONE);
        const startOfTodayInPoland = new Date(nowInPoland.getFullYear(), nowInPoland.getMonth(), nowInPoland.getDate(), 0, 0, 0);
        
        const startTime = fromZonedTime(startOfTodayInPoland, POLAND_TIME_ZONE);
        return { startTime, endTime: nowUtc };
    }
}

function formatMatchDateTime(matchDate, matchTime) {
    const utcDate = parseMatchDateTimeToUtc(matchDate, matchTime);
    return format(utcDate, "EEEE, d MMMM yyyy, HH:mm", {
        timeZone: POLAND_TIME_ZONE,
        locale: pl
    });
}

function formatMatchDateTimeShort(matchDate, matchTime) {
    const utcDate = parseMatchDateTimeToUtc(matchDate, matchTime);
    return format(utcDate, 'dd.MM.yyyy, HH:mm', {
        timeZone: POLAND_TIME_ZONE
    });
}

function formatMatchDateTimeShortHour(matchDate, matchTime) {
    const utcDate = parseMatchDateTimeToUtc(matchDate, matchTime);
    return format(utcDate, 'HH:mm', {
        timeZone: POLAND_TIME_ZONE
    });
}

function getTimeUntilMatch(matchDate, matchTime) {
    const matchDateTimeUtc = parseMatchDateTimeToUtc(matchDate, matchTime);
    const nowUtc = new Date();

    const diffMs = matchDateTimeUtc.getTime() - nowUtc.getTime();

    if (diffMs < 0) {
        return "Mecz aktualnie trwa!";
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const remainingHours = diffHours % 24;
    const remainingMinutes = diffMinutes % 60;
    
    const formatUnit = (value, units) => {
        if (value === 1) return units[0];
        const lastDigit = value % 10;
        const lastTwoDigits = value % 100;
        if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return units[2];
        if (lastDigit >= 2 && lastDigit <= 4) return units[1];
        return units[2];
    };

    const dayText = formatUnit(diffDays, ["dzień", "dni", "dni"]);
    const hourText = formatUnit(remainingHours, ["godzina", "godziny", "godzin"]);
    const minuteText = formatUnit(remainingMinutes, ["minuta", "minuty", "minut"]);
    
    if (diffDays > 0) {
        return remainingHours > 0 ? `${diffDays} ${dayText}, ${remainingHours} ${hourText}` : `${diffDays} ${dayText}`;
    } else if (diffHours > 0) {
        return remainingMinutes > 0 ? `${diffHours} ${hourText}, ${remainingMinutes} ${minuteText}` : `${diffHours} ${hourText}`;
    } else {
        return `${diffMinutes <= 0 ? 1 : diffMinutes} ${minuteText}`;
    }
}

module.exports = {
    getSessionTimeRange,
    formatMatchDateTime,
    formatMatchDateTimeShort,
    getTimeUntilMatch,
    formatMatchDateTimeShortHour,
    // Exported for route-level filtering/comparisons
    parseMatchDateTimeToUtc,
    isMatchInFuture: (matchDate, matchTime) => {
        try {
            const start = parseMatchDateTimeToUtc(matchDate, matchTime);
            return start.getTime() > Date.now();
        } catch (e) {
            return false;
        }
    }
};