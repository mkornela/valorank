require('dotenv').config();

const config = {
    // Server configuration
    PORT: process.env.PORT || 7312,
    AUTO_REFRESH_SECONDS: 120,
    
    // API Keys and URLs
    HENRIKDEV_API_KEY: process.env.HENRIKDEV_API_KEY,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    DISCORD_USER_ID_ON_ERROR: process.env.DISCORD_USER_ID_ON_ERROR,
    
    // Player configuration
    STATS_PLAYER_NAME: process.env.STATS_PLAYER_NAME || "AGT DawcioAWP",
    STATS_PLAYER_TAG: process.env.STATS_PLAYER_TAG || "FCB",
    STATS_PLAYER_REGION: process.env.STATS_PLAYER_REGION || "FCB",
    
    // Validation
    validateConfig() {
        if (!this.HENRIKDEV_API_KEY) {
            throw new Error("You need to setup your HenrikDev API key!");
        }
    }
};

module.exports = config;