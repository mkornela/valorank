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
}

const EVENTS = {
    'VCT 2025: EMEA Stage 2': 'VCT EMEA Stage 2'
}

module.exports = {
    RANK_TIERS,
    VALID_REGIONS,
    RADIANT_BASE_THRESHOLD,
    MAX_MATCHES_PER_REQUEST,
    TEAMS,
    EVENTS
};