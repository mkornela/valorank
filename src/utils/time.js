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

function formatMatchDateTime(matchDate, matchTime) {
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
    
    const fullDateTime = new Date(`${monthDay}, ${year} ${hour24}:${minutes}:00`);
    
    const polishFormatter = new Intl.DateTimeFormat('pl-PL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Warsaw'
    });
    
    return polishFormatter.format(fullDateTime);
}

function formatMatchDateTimeShort(matchDate, matchTime) {
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
    
    const fullDateTime = new Date(`${monthDay}, ${year} ${hour24}:${minutes}:00`);
    
    const polishFormatter = new Intl.DateTimeFormat('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Warsaw'
    });
    
    return polishFormatter.format(fullDateTime);
}

function getTimeUntilMatch(matchDate, matchTime) {
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
    
    const matchDateTime = new Date(`${monthDay}, ${year} ${hour24}:${minutes}:00`);
    const now = new Date();
    
    const diffMs = matchDateTime.getTime() - now.getTime();
    
    if (diffMs < 0) {
        return "Mecz aktualnie trwa!";
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const remainingHours = diffHours % 24;
    const remainingMinutes = diffMinutes % 60;
    
    if (diffDays > 0) {
        if (remainingHours > 0) {
            const dayText = diffDays === 1 ? "dzień" : "dni";
            const hourText = remainingHours === 1 ? "godzina" : 
                           remainingHours < 5 ? "godziny" : "godzin";
            return `${diffDays} ${dayText}, ${remainingHours} ${hourText}`;
        } else {
            const dayText = diffDays === 1 ? "dzień" : "dni";
            return `${diffDays} ${dayText}`;
        }
    } else if (diffHours > 0) {
        if (remainingMinutes > 0) {
            const hourText = diffHours === 1 ? "godzina" : 
                           diffHours < 5 ? "godziny" : "godzin";
            const minuteText = remainingMinutes === 1 ? "minuta" : 
                             remainingMinutes < 5 ? "minuty" : "minut";
            return `${diffHours} ${hourText}, ${remainingMinutes} ${minuteText}`;
        } else {
            const hourText = diffHours === 1 ? "godzina" : 
                           diffHours < 5 ? "godziny" : "godzin";
            return `${diffHours} ${hourText}`;
        }
    } else {
        const minuteText = diffMinutes === 1 ? "minuta" : 
                         diffMinutes < 5 ? "minuty" : "minut";
        return `${diffMinutes} ${minuteText}`;
    }
}

module.exports = {
    getPolandTimezoneOffset,
    getSessionTimeRange,
    formatMatchDateTime,
    formatMatchDateTimeShort,
    getTimeUntilMatch
};