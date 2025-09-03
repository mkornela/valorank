const { logToDiscord } = require('./discord');

const sendSuccessResponse = (res, data, discordConfig = null) => {
    if (discordConfig) {
        logToDiscord({
            ...discordConfig,
            color: 0x00FF00,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        });
    }
    res.type('text/plain').send(data);
};

const sendErrorResponse = (res, message, status = 404, discordConfig = null) => {
    if (discordConfig) {
        logToDiscord({
            ...discordConfig,
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        });
    }
    res.status(status).type('text/plain').send(message);
};

const sendInfoResponse = (res, message, discordConfig = null) => {
    if (discordConfig) {
        logToDiscord({
            ...discordConfig,
            color: 0xFFA500,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${discordConfig.ip || 'unknown'}` }
        });
    }
    res.status(200).type('text/plain').send(message);
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