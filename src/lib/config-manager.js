/*
  Configuration Management for eCash CLI Wallet
  Handles global configuration, environment variables, and per-wallet settings
*/

// Global npm libraries
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
// Get current directory

class ConfigManager {
  constructor () {
    // Encapsulate dependencies
    this.fs = fs
    this.os = os

    // Configuration paths
    this.globalConfigPath = path.join(os.homedir(), '.ecash-cli-config.json')

    // Default configuration
    this.defaultConfig = {
      analytics: {
        enabled: false, // Disabled by default for backward compatibility
        debug: false,
        defaultStrategy: 'balanced',
        cacheEnabled: true
      },
      display: {
        showHealthScores: true,
        showPrivacyScores: true,
        showClassifications: true,
        detailedByDefault: false,
        colorOutput: true
      },
      thresholds: {
        minHealthScore: 50,
        minPrivacyScore: 30,
        dustThreshold: 546
      },
      classification: {
        ageThresholds: {
          fresh: 6, // ~1 hour (in blocks)
          recent: 144, // ~1 day
          mature: 1008, // ~1 week
          aged: 4032 // ~1 month
        },
        valueThresholds: {
          dust: 1000, // 10 XEC
          micro: 5000, // 50 XEC
          small: 50000, // 500 XEC
          medium: 500000, // 5000 XEC
          large: 5000000 // 50000 XEC
        }
      },
      security: {
        dustAttackThreshold: 10,
        suspiciousPatternDetection: true,
        autoQuarantineDust: false
      },
      performance: {
        utxoCacheSize: 1000,
        analyticsCacheSize: 100,
        maxAnalyticsProcessingTime: 5000 // 5 seconds
      }
    }

    // Bind methods
    this.loadGlobalConfig = this.loadGlobalConfig.bind(this)
    this.saveGlobalConfig = this.saveGlobalConfig.bind(this)
    this.getConfig = this.getConfig.bind(this)
    this.setConfig = this.setConfig.bind(this)
    this.resetConfig = this.resetConfig.bind(this)
    this.mergeConfigs = this.mergeConfigs.bind(this)
    this.validateConfig = this.validateConfig.bind(this)
    this.getWalletAnalyticsOptions = this.getWalletAnalyticsOptions.bind(this)
    this.isAnalyticsEnabled = this.isAnalyticsEnabled.bind(this)
    this.getEnvironmentOverrides = this.getEnvironmentOverrides.bind(this)
  }

  // Load global configuration from file
  async loadGlobalConfig () {
    try {
      // Check if config file exists
      try {
        await this.fs.access(this.globalConfigPath)
      } catch (err) {
        // File doesn't exist, return default config
        return { ...this.defaultConfig }
      }

      // Load and parse config file
      const configStr = await this.fs.readFile(this.globalConfigPath, 'utf8')
      const fileConfig = JSON.parse(configStr)

      // Merge with defaults to ensure all properties exist
      const config = this.mergeConfigs(this.defaultConfig, fileConfig)

      // Apply environment variable overrides
      const envOverrides = this.getEnvironmentOverrides()
      const finalConfig = this.mergeConfigs(config, envOverrides)

      // Validate merged configuration
      this.validateConfig(finalConfig)

      return finalConfig
    } catch (err) {
      console.warn(`Warning: Could not load global config: ${err.message}`)
      console.warn('Using default configuration')
      return { ...this.defaultConfig }
    }
  }

  // Save global configuration to file
  async saveGlobalConfig (config) {
    try {
      // Validate configuration before saving
      this.validateConfig(config)

      // Ensure config directory exists
      const configDir = path.dirname(this.globalConfigPath)
      await this.fs.mkdir(configDir, { recursive: true })

      // Save configuration
      await this.fs.writeFile(this.globalConfigPath, JSON.stringify(config, null, 2))

      return true
    } catch (err) {
      throw new Error(`Failed to save global config: ${err.message}`)
    }
  }

  // Get configuration value by dot notation path
  async getConfig (keyPath) {
    try {
      const config = await this.loadGlobalConfig()

      if (!keyPath) {
        return config
      }

      const keys = keyPath.split('.')
      let value = config

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key]
        } else {
          return undefined
        }
      }

      return value
    } catch (err) {
      throw new Error(`Failed to get config '${keyPath}': ${err.message}`)
    }
  }

  // Set configuration value by dot notation path
  async setConfig (keyPath, value) {
    try {
      if (!keyPath || keyPath === '') {
        throw new Error('Configuration key path is required')
      }

      const config = await this.loadGlobalConfig()
      const keys = keyPath.split('.')
      let current = config

      // Navigate to parent object
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (!(key in current) || typeof current[key] !== 'object') {
          current[key] = {}
        }
        current = current[key]
      }

      // Set the final value
      const finalKey = keys[keys.length - 1]
      current[finalKey] = value

      // Save updated configuration
      await this.saveGlobalConfig(config)

      return true
    } catch (err) {
      throw new Error(`Failed to set config '${keyPath}': ${err.message}`)
    }
  }

  // Reset configuration to defaults
  async resetConfig () {
    try {
      await this.saveGlobalConfig({ ...this.defaultConfig })
      return true
    } catch (err) {
      throw new Error(`Failed to reset config: ${err.message}`)
    }
  }

  // Deep merge two configuration objects
  mergeConfigs (target, source) {
    const result = { ...target }

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfigs(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }

    return result
  }

  // Validate configuration structure and values
  validateConfig (config) {
    try {
      // Check required top-level sections
      const requiredSections = ['analytics', 'display', 'thresholds', 'classification']
      for (const section of requiredSections) {
        if (!(section in config) || typeof config[section] !== 'object') {
          throw new Error(`Missing or invalid '${section}' configuration section`)
        }
      }

      // Validate analytics section
      if (typeof config.analytics.enabled !== 'boolean') {
        throw new Error('analytics.enabled must be a boolean')
      }

      // Validate thresholds
      if (typeof config.thresholds.minHealthScore !== 'number' ||
          config.thresholds.minHealthScore < 0 ||
          config.thresholds.minHealthScore > 100) {
        throw new Error('thresholds.minHealthScore must be a number between 0 and 100')
      }

      // Validate value thresholds
      const valueThresholds = config.classification.valueThresholds
      const thresholdKeys = ['dust', 'micro', 'small', 'medium', 'large']
      for (const key of thresholdKeys) {
        if (typeof valueThresholds[key] !== 'number' || valueThresholds[key] < 0) {
          throw new Error(`classification.valueThresholds.${key} must be a positive number`)
        }
      }

      return true
    } catch (err) {
      throw new Error(`Configuration validation failed: ${err.message}`)
    }
  }

  // Get environment variable overrides
  getEnvironmentOverrides () {
    const overrides = {}

    // Analytics enabled override
    if (process.env.ECASH_CLI_ANALYTICS_ENABLED !== undefined) {
      const enabled = process.env.ECASH_CLI_ANALYTICS_ENABLED.toLowerCase()
      overrides.analytics = {
        enabled: enabled === 'true' || enabled === '1' || enabled === 'yes'
      }
    }

    // Debug override
    if (process.env.ECASH_CLI_DEBUG !== undefined) {
      const debug = process.env.ECASH_CLI_DEBUG.toLowerCase()
      if (!overrides.analytics) overrides.analytics = {}
      overrides.analytics.debug = debug === 'true' || debug === '1' || debug === 'yes'
    }

    // Strategy override
    if (process.env.ECASH_CLI_DEFAULT_STRATEGY !== undefined) {
      const strategy = process.env.ECASH_CLI_DEFAULT_STRATEGY.toLowerCase()
      const validStrategies = ['efficient', 'privacy', 'balanced', 'conservative']
      if (validStrategies.includes(strategy)) {
        if (!overrides.analytics) overrides.analytics = {}
        overrides.analytics.defaultStrategy = strategy
      }
    }

    return overrides
  }

  // Check if analytics is enabled globally
  async isAnalyticsEnabled () {
    try {
      const config = await this.loadGlobalConfig()
      return config.analytics.enabled === true
    } catch (err) {
      return false // Default to disabled on error
    }
  }

  // Get wallet analytics options for minimal-xec-wallet
  async getWalletAnalyticsOptions (walletData = {}) {
    try {
      const globalConfig = await this.loadGlobalConfig()

      // Extract wallet config and hdPath from walletData
      const walletConfig = walletData || {}
      const hdPath = walletData.wallet?.hdPath

      // Check if analytics is enabled (wallet config overrides global)
      let analyticsEnabled = globalConfig.analytics.enabled
      if (walletConfig.analytics && typeof walletConfig.analytics.enabled === 'boolean') {
        analyticsEnabled = walletConfig.analytics.enabled
      }

      // Build base options with hdPath (always include hdPath for proper wallet functionality)
      const baseOptions = {}
      if (hdPath) {
        baseOptions.hdPath = hdPath
      }

      if (!analyticsEnabled) {
        return {
          ...baseOptions,
          utxoAnalytics: { enabled: false }
        }
      }

      // Merge global and wallet-specific configuration
      const walletAnalyticsConfig = walletConfig.analytics || {}
      const classificationConfig = this.mergeConfigs(
        globalConfig.classification,
        walletAnalyticsConfig.classificationConfig || {}
      )

      // Build analytics options for minimal-xec-wallet
      return {
        ...baseOptions,
        utxoAnalytics: {
          enabled: true,
          debug: globalConfig.analytics.debug,
          classificationConfig: {
            ageThresholds: classificationConfig.ageThresholds,
            valueThresholds: classificationConfig.valueThresholds
          },
          healthMonitorConfig: {
            dustLimit: globalConfig.thresholds.dustThreshold,
            economicalThreshold: 2.0,
            alertThresholds: {
              highDustRatio: 0.7,
              lowLiquidity: 0.3,
              highConsolidationNeed: 0.5
            },
            suspiciousPatterns: {
              dustAttackSize: globalConfig.security.dustAttackThreshold,
              rapidDeposits: 5,
              timeWindow: 3600000 // 1 hour in milliseconds
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not get wallet analytics options: ${err.message}`)
      // Still try to include hdPath even on error
      const baseOptions = {}
      if (walletData.wallet?.hdPath) {
        baseOptions.hdPath = walletData.wallet.hdPath
      }
      return {
        ...baseOptions,
        utxoAnalytics: { enabled: false }
      }
    }
  }

  // List all configuration keys and values
  async listConfig () {
    try {
      const config = await this.loadGlobalConfig()
      return this.flattenConfig(config)
    } catch (err) {
      throw new Error(`Failed to list config: ${err.message}`)
    }
  }

  // Flatten configuration object to dot notation
  flattenConfig (obj, prefix = '') {
    const flattened = {}

    for (const key in obj) {
      const value = obj[key]
      const newKey = prefix ? `${prefix}.${key}` : key

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenConfig(value, newKey))
      } else {
        flattened[newKey] = value
      }
    }

    return flattened
  }

  // Get configuration file path for reference
  getConfigPath () {
    return this.globalConfigPath
  }

  // Get default configuration for reference
  getDefaultConfig () {
    return { ...this.defaultConfig }
  }
}

export default ConfigManager
