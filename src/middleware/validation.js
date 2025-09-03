const { VALID_REGIONS } = require('../constants');

const validateRegion = (req, res, next) => {
    const { region } = req.params;
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }
    next();
};

const validatePosition = (req, res, next) => {
    const { position } = req.params;
    const rankPosition = parseInt(position, 10);

    if (isNaN(rankPosition) || rankPosition <= 0) {
        return res.status(400).type('text/plain').send('Błąd: Podano nieprawidłową pozycję.');
    }
    if (rankPosition > 15000) {
        return res.type('text/plain').send(`Leaderboard VALORANT obsługuje tylko top 15000!`);
    }
    req.rankPosition = rankPosition;
    next();
};

const validatePlayerData = (mmr, account) => {
    if (!mmr.data || !mmr.data.current_data) {
        return { valid: false, message: 'Błąd: Nie znaleziono gracza lub brak danych rankingowych.' };
    }
    if (!account.data?.puuid) {
        return { valid: false, message: 'Błąd: Nie znaleziono konta gracza dla statystyk dziennych.' };
    }
    return { valid: true };
};

const validateAccountExists = (account) => {
    if (!account.data?.puuid) {
        return { valid: false, message: 'Błąd: Nie znaleziono gracza.' };
    }
    return { valid: true };
};

const validateMMRExists = (mmr) => {
    if (!mmr.data?.current_data) {
        return { valid: false, message: 'Błąd: Brak danych rankingowych dla gracza.' };
    }
    return { valid: true };
};

module.exports = {
    validateRegion,
    validatePosition,
    validatePlayerData,
    validateAccountExists,
    validateMMRExists
};