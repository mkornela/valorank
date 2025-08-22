require('dotenv').config();

/**
 * Custom error class for configuration errors
 */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Enhanced configuration with validation and environment handling
 */
const config = {
  // Server configuration
  PORT: parseInt(process.env.PORT) || 7312,
  NODE_ENV: process.env.NODE_ENV || 'development',
  AUTO_REFRESH_SECONDS: parseInt(process.env.AUTO_REFRESH_SECONDS) || 120,
  
  // API Keys and URLs
  HENRIKDEV_API_KEY: process.env.HENRIKDEV_API_KEY,
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  DISCORD_USER_ID_ON_ERROR: process.env.DISCORD_USER_ID_ON_ERROR,
  
  // Player configuration
  STATS_PLAYER_NAME: process.env.STATS_PLAYER_NAME || "AGT DawcioAWP",
  STATS_PLAYER_TAG: process.env.STATS_PLAYER_TAG || "FCB",
  STATS_PLAYER_REGION: process.env.STATS_PLAYER_REGION || "eu",
  
  // Security configuration
  API_SECRET_KEY: process.env.API_SECRET_KEY || 'default-secret-key-change-in-production',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Performance configuration
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS) || 300, // 5 minutes
  API_TIMEOUT_MS: parseInt(process.env.API_TIMEOUT_MS) || 15000,
  MAX_LOG_ENTRIES: parseInt(process.env.MAX_LOG_ENTRIES) || 1000,
  
  // Logging configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_ENABLED: process.env.LOG_FILE_ENABLED === 'true',
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs',
  
  // Validation
  validateConfig() {
    const errors = [];
    
    // Required configuration validation
    if (!this.HENRIKDEV_API_KEY) {
      errors.push('HENRIKDEV_API_KEY is required');
    }
    
    // Port validation
    if (this.PORT < 1 || this.PORT > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }
    
    // Timeout validation
    if (this.API_TIMEOUT_MS < 1000 || this.API_TIMEOUT_MS > 60000) {
      errors.push('API_TIMEOUT_MS must be between 1000 and 60000');
    }
    
    // Cache TTL validation
    if (this.CACHE_TTL_SECONDS < 60 || this.CACHE_TTL_SECONDS > 3600) {
      errors.push('CACHE_TTL_SECONDS must be between 60 and 3600');
    }
    
    // Rate limiting validation
    if (this.RATE_LIMIT_MAX_REQUESTS < 1 || this.RATE_LIMIT_MAX_REQUESTS > 1000) {
      errors.push('RATE_LIMIT_MAX_REQUESTS must be between 1 and 1000');
    }
    
    // Log level validation
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.LOG_LEVEL)) {
      errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
    }
    
    // Player configuration validation
    if (!this.STATS_PLAYER_NAME || this.STATS_PLAYER_NAME.length < 3) {
      errors.push('STATS_PLAYER_NAME must be at least 3 characters long');
    }
    
    if (!this.STATS_PLAYER_TAG || this.STATS_PLAYER_TAG.length < 3) {
      errors.push('STATS_PLAYER_TAG must be at least 3 characters long');
    }
    
    const validRegions = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];
    if (!validRegions.includes(this.STATS_PLAYER_REGION)) {
      errors.push(`STATS_PLAYER_REGION must be one of: ${validRegions.join(', ')}`);
    }
    
    // Environment-specific warnings
    if (this.NODE_ENV === 'production') {
      const warnings = [];
      
      if (this.API_SECRET_KEY === 'default-secret-key-change-in-production') {
        warnings.push('API_SECRET_KEY should be changed in production');
      }
      
      if (warnings.length > 0) {
        console.warn('⚠️  Production warnings:');
        warnings.forEach(warning => console.warn(`   - ${warning}`));
      }
    }
    
    if (errors.length > 0) {
      throw new ConfigError(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  },
  
  /**
   * Get configuration for specific environment
   */
  getEnvironmentConfig() {
    const baseConfig = { ...this };
    
    // Development-specific overrides
    if (this.NODE_ENV === 'development') {
      baseConfig.LOG_LEVEL = 'debug';
      baseConfig.CACHE_TTL_SECONDS = 60; // Shorter cache for development
    }
    
    // Production-specific overrides
    if (this.NODE_ENV === 'production') {
      baseConfig.LOG_LEVEL = 'warn';
      baseConfig.LOG_FILE_ENABLED = true;
    }
    
    return baseConfig;
  },
  
  /**
   * Get safe configuration for client-side exposure
   */
  getClientConfig() {
    return {
      NODE_ENV: this.NODE_ENV,
      VERSION: require('../../../package.json').version,
      STATS_PLAYER_NAME: this.STATS_PLAYER_NAME,
      STATS_PLAYER_TAG: this.STATS_PLAYER_TAG,
      STATS_PLAYER_REGION: this.STATS_PLAYER_REGION
    };
  },
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName) {
    return process.env[`FEATURE_${featureName.toUpperCase()}`] === 'true';
  }
};

// Validate configuration on load
try {
  config.validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.message);
  process.exit(1);
}

module.exports = config;