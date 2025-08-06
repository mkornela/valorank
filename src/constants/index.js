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
    'VCT 2025: EMEA Stage 2': 'VCT EMEA Stage 2',
    'VCT 2025: Americas Stage 2': 'VCT Americas Stage 2'
}

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

module.exports = {
    RANK_TIERS,
    VALID_REGIONS,
    RADIANT_BASE_THRESHOLD,
    MAX_MATCHES_PER_REQUEST,
    TEAMS,
    EVENTS,
    RANK_ELO_THRESHOLDS
};