const { logToDiscord } = require('./discord');
const log = require('./logger');

const sendSuccessResponse = (res, data, discordConfig = null) => {
    if (discordConfig) {
        const logMessage = `API Success: ${discordConfig.title || 'Unknown'}`;
        const logEntry = log.info('API', logMessage, { ...discordConfig, type: 'success' });
        logToDiscord({
            ...discordConfig,
            color: 0x00FF00,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        }, false, logEntry);
    }
    // Normalize output: always { success: true, data, timestamp }
    const normalize = (payload) => {
        // If payload already follows our shape, return as-is
        if (payload && typeof payload === 'object' && ('success' in payload || 'data' in payload)) {
            return payload;
        }
        return { data: payload };
    };

    const body = {
        success: true,
        ...normalize(data),
        timestamp: new Date().toISOString()
    };

    console.log('sendSuccessResponse', body);
    res.json(body);
};

const sendErrorResponse = (res, message, status = 404, discordConfig = null) => {
    if (discordConfig) {
        const logMessage = `API Error: ${discordConfig.title || 'Unknown'} - ${message}`;
        const logEntry = log.error('API', logMessage, null, { ...discordConfig, type: 'error', statusCode: status });
        logToDiscord({
            ...discordConfig,
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        }, true, logEntry);
    }
    res.status(status).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        statusCode: status
    });
};

const sendInfoResponse = (res, message, discordConfig = null) => {
    if (discordConfig) {
        const logMessage = `API Info: ${discordConfig.title || 'Unknown'} - ${message}`;
        const logEntry = log.info('API', logMessage, { ...discordConfig, type: 'info' });
        logToDiscord({
            ...discordConfig,
            color: 0xFFA500,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        }, false, logEntry);
    }
    res.json({
        success: true,
        info: message,
        timestamp: new Date().toISOString()
    });
};

const formatWinLossString = (wins, losses, draws = 0) => {
    return draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
};

const formatRRChange = (rrChange) => {
    return rrChange >= 0 ? `+${rrChange}` : rrChange.toString();
};

module.exports = {
    sendSuccessResponse,
    sendErrorResponse,
    sendInfoResponse,
    formatWinLossString,
    formatRRChange
};