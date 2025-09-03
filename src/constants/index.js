const RANK_TIERS = {
    0: "Unranked", 
    3: "Iron 1", 4: "Iron 2", 5: "Iron 3",
    6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
    9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
    12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
    15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
    18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
    21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
    24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3",
    27: "Radiant"
};

const VALID_REGIONS = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];

const RADIANT_BASE_THRESHOLD = 550;

const MAX_MATCHES_PER_REQUEST = 10;

const TEAMS = {
    'BBL Esports': 'BBL',
    'FNATIC': 'FNC',
    'FUT Esports': 'FUT',
    'GIANTX': 'GIANTX',
    'Karmine Corp': 'KC',
    'KOI': 'KOI',
    'Natus Vincere': 'NAVI',
    'Team Heretics': 'TH',
    'Team Liquid': 'Liquid',
    'Team Vitality': 'Vitality',
    'Gentle Mates': 'M8',
    'Apeks': 'APEKS'
};

const EVENTS = {
    'VCT 2025: EMEA Stage 2': 'VCT EMEA Stage 2',
    'VCT 2025: Americas Stage 2': 'VCT Americas Stage 2'
};

const RANK_ELO_THRESHOLDS = {
    'Iron 1': 0,
    'Iron 2': 100,
    'Iron 3': 200,
    'Bronze 1': 300,
    'Bronze 2': 400,
    'Bronze 3': 500,
    'Silver 1': 600,
    'Silver 2': 700,
    'Silver 3': 800,
    'Gold 1': 900,
    'Gold 2': 1000,
    'Gold 3': 1100,
    'Platinum 1': 1200,
    'Platinum 2': 1300,
    'Platinum 3': 1400,
    'Diamond 1': 1500,
    'Diamond 2': 1600,
    'Diamond 3': 1700,
    'Ascendant 1': 1800,
    'Ascendant 2': 1900,
    'Ascendant 3': 2000,
    'Immortal 1': 2100,
    'Immortal 2': 2200,
    'Immortal 3': 2300,
    'Radiant': 2650
};

const GAME_MODES = {
    COMPETITIVE: 'competitive',
    UNRATED: 'unrated',
    SPIKE_RUSH: 'spikerush',
    DEATHMATCH: 'deathmatch',
    ESCALATION: 'escalation',
    REPLICATION: 'replication',
    CUSTOM: 'custom'
};

const PLATFORMS = {
    PC: 'pc',
    CONSOLE: 'console'
};

const API_STATUS = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

const ERROR_MESSAGES = {
    INVALID_PLAYER_NAME: 'Player name must be between 3 and 16 characters and contain only letters, numbers, and underscores',
    INVALID_PLAYER_TAG: 'Player tag must be between 3 and 5 characters and contain only letters and numbers',
    INVALID_REGION: 'Invalid region. Valid regions: na, eu, ap, kr, latam, br',
    PLAYER_NOT_FOUND: 'Player not found',
    NO_RANKING_DATA: 'No ranking data available for this player',
    API_TIMEOUT: 'API request timeout',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later',
    INVALID_RANK_NAME: 'Invalid rank name',
    INVALID_MATCH_ID: 'Invalid match ID',
    INVALID_SESSION_TIME: 'Invalid session time parameters'
};

const TIME_CONSTANTS = {
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000
};

const CACHE_KEYS = {
    PLAYER_MMR: 'player_mmr',
    PLAYER_ACCOUNT: 'player_account',
    MATCH_HISTORY: 'match_history',
    MMR_HISTORY: 'mmr_history',
    LEADERBOARD: 'leaderboard'
};

const VALIDATION_PATTERNS = {
    PLAYER_NAME: /^[\p{L}\p{N}_\-\s\.]{3,16}$/u,
    PLAYER_TAG: /^[a-zA-Z0-9]{3,5}$/,
    REGION: /^(na|eu|ap|kr|latam|br)$/i,
    RANK_NAME: /^(Iron|Bronze|Silver|Gold|Platinum|Diamond|Ascendant|Immortal|Radiant)(\s[1-3])?$/i,
    MATCH_ID: /^[a-f0-9\-]{36}$/i
};

module.exports = {
    RANK_TIERS,
    VALID_REGIONS,
    RADIANT_BASE_THRESHOLD,
    MAX_MATCHES_PER_REQUEST,
    TEAMS,
    EVENTS,
    RANK_ELO_THRESHOLDS,
    GAME_MODES,
    PLATFORMS,
    API_STATUS,
    ERROR_MESSAGES,
    TIME_CONSTANTS,
    CACHE_KEYS,
    VALIDATION_PATTERNS
};