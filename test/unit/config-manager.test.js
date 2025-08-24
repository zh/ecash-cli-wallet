/*
  Unit Tests for ConfigManager
  Tests configuration management functionality
*/

import { expect } from 'chai'
import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import ConfigManager from '../../src/lib/config-manager.js'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('ConfigManager', function () {
  let configManager
  let tempConfigPath

  beforeEach(function () {
    // Create temp config path for each test
    const tempDir = path.join(__dirname, '../fixtures/temp')
    tempConfigPath = path.join(tempDir, `test-config-${Date.now()}.json`)

    // Create config manager with temp path
    configManager = new ConfigManager()
    configManager.globalConfigPath = tempConfigPath
  })

  afterEach(async function () {
    // Clean up temp config file
    try {
      await fs.unlink(tempConfigPath)
    } catch (err) {
      // Ignore if file doesn't exist
    }
  })

  describe('Constructor', function () {
    it('should create ConfigManager instance', function () {
      expect(configManager).to.be.instanceOf(ConfigManager)
      expect(configManager.defaultConfig).to.be.an('object')
      expect(configManager.defaultConfig.analytics).to.be.an('object')
    })

    it('should have default analytics disabled', function () {
      expect(configManager.defaultConfig.analytics.enabled).to.equal(false)
    })

    it('should have required configuration sections', function () {
      const config = configManager.defaultConfig
      expect(config).to.have.property('analytics')
      expect(config).to.have.property('display')
      expect(config).to.have.property('thresholds')
      expect(config).to.have.property('classification')
      expect(config).to.have.property('security')
      expect(config).to.have.property('performance')
    })
  })

  describe('loadGlobalConfig', function () {
    it('should return default config when file does not exist', async function () {
      const config = await configManager.loadGlobalConfig()
      expect(config).to.deep.equal(configManager.defaultConfig)
    })

    it('should load and merge config from file', async function () {
      // Clean up environment variable that might override our config
      const originalEnvValue = process.env.ECASH_CLI_ANALYTICS_ENABLED
      delete process.env.ECASH_CLI_ANALYTICS_ENABLED

      const testConfig = {
        analytics: {
          enabled: true,
          debug: true
        },
        display: configManager.defaultConfig.display, // Include required sections
        thresholds: configManager.defaultConfig.thresholds,
        classification: configManager.defaultConfig.classification
      }

      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true })

      // Create temp config file
      await fs.writeFile(tempConfigPath, JSON.stringify(testConfig))

      // Verify file was written correctly
      const fileContent = await fs.readFile(tempConfigPath, 'utf8')
      const savedConfig = JSON.parse(fileContent)
      expect(savedConfig.analytics.enabled).to.equal(true)

      const config = await configManager.loadGlobalConfig()
      expect(config.analytics.enabled).to.equal(true)
      expect(config.analytics.debug).to.equal(true)
      expect(config.display).to.deep.equal(configManager.defaultConfig.display) // Should have defaults

      // Restore environment variable
      if (originalEnvValue !== undefined) {
        process.env.ECASH_CLI_ANALYTICS_ENABLED = originalEnvValue
      }
    })

    it('should apply environment variable overrides', async function () {
      // Set environment variable before loading config
      process.env.ECASH_CLI_ANALYTICS_ENABLED = 'true'

      // Create a fresh config file with analytics disabled
      const testConfig = {
        analytics: {
          enabled: false,
          debug: false
        }
      }

      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true })
      await fs.writeFile(tempConfigPath, JSON.stringify(testConfig))

      const config = await configManager.loadGlobalConfig()
      expect(config.analytics.enabled).to.equal(true) // Should be overridden by env var

      // Clean up
      delete process.env.ECASH_CLI_ANALYTICS_ENABLED
    })
  })

  describe('saveGlobalConfig', function () {
    it('should save config to file', async function () {
      const testConfig = {
        ...configManager.defaultConfig,
        analytics: {
          ...configManager.defaultConfig.analytics,
          enabled: true
        }
      }

      await configManager.saveGlobalConfig(testConfig)

      // Verify file exists and has correct content
      const savedContent = await fs.readFile(tempConfigPath, 'utf8')
      const savedConfig = JSON.parse(savedContent)
      expect(savedConfig.analytics.enabled).to.equal(true)
    })

    it('should validate config before saving', async function () {
      const invalidConfig = {
        analytics: {
          enabled: 'invalid' // Should be boolean
        }
      }

      try {
        await configManager.saveGlobalConfig(invalidConfig)
        expect.fail('Should have thrown validation error')
      } catch (err) {
        expect(err.message).to.include('Configuration validation failed')
      }
    })
  })

  describe('getConfig', function () {
    beforeEach(async function () {
      const testConfig = {
        analytics: {
          enabled: true,
          debug: false
        },
        display: {
          showHealthScores: true
        }
      }
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true })
      await fs.writeFile(tempConfigPath, JSON.stringify(testConfig))
    })

    it('should get entire config when no path specified', async function () {
      const config = await configManager.getConfig()
      expect(config).to.be.an('object')
      expect(config.analytics.enabled).to.equal(true)
    })

    it('should get config value by dot notation path', async function () {
      const enabled = await configManager.getConfig('analytics.enabled')
      expect(enabled).to.equal(true)

      const debug = await configManager.getConfig('analytics.debug')
      expect(debug).to.equal(false)
    })

    it('should return undefined for non-existent path', async function () {
      const nonExistent = await configManager.getConfig('nonexistent.path')
      expect(nonExistent).to.be.undefined // eslint-disable-line no-unused-expressions
    })
  })

  describe('setConfig', function () {
    it('should set config value by dot notation path', async function () {
      await configManager.setConfig('analytics.enabled', true)

      const config = await configManager.getConfig()
      expect(config.analytics.enabled).to.equal(true)
    })

    it('should create nested paths if they do not exist', async function () {
      await configManager.setConfig('new.nested.path', 'test-value')

      const value = await configManager.getConfig('new.nested.path')
      expect(value).to.equal('test-value')
    })

    it('should throw error for empty key path', async function () {
      try {
        await configManager.setConfig('', 'value')
        expect.fail('Should have thrown error for empty path')
      } catch (err) {
        expect(err.message).to.include('Configuration key path is required')
      }
    })
  })

  describe('validateConfig', function () {
    it('should validate valid configuration', function () {
      const validConfig = configManager.defaultConfig
      expect(() => configManager.validateConfig(validConfig)).to.not.throw()
    })

    it('should throw error for missing required sections', function () {
      const invalidConfig = { analytics: {} } // Missing other required sections

      expect(() => configManager.validateConfig(invalidConfig)).to.throw()
    })

    it('should throw error for invalid analytics.enabled type', function () {
      const invalidConfig = {
        ...configManager.defaultConfig,
        analytics: { enabled: 'invalid' }
      }

      expect(() => configManager.validateConfig(invalidConfig)).to.throw('analytics.enabled must be a boolean')
    })

    it('should throw error for invalid threshold values', function () {
      const invalidConfig = {
        ...configManager.defaultConfig,
        thresholds: { minHealthScore: 150 } // > 100
      }

      expect(() => configManager.validateConfig(invalidConfig)).to.throw()
    })
  })

  describe('isAnalyticsEnabled', function () {
    it('should return false by default', async function () {
      const enabled = await configManager.isAnalyticsEnabled()
      expect(enabled).to.equal(false)
    })

    it('should return true when analytics is enabled', async function () {
      await configManager.setConfig('analytics.enabled', true)

      const enabled = await configManager.isAnalyticsEnabled()
      expect(enabled).to.equal(true)
    })
  })

  describe('getWalletAnalyticsOptions', function () {
    it('should return disabled options when analytics is disabled', async function () {
      const options = await configManager.getWalletAnalyticsOptions()
      expect(options.utxoAnalytics.enabled).to.equal(false)
    })

    it('should return enabled options when analytics is enabled', async function () {
      await configManager.setConfig('analytics.enabled', true)

      const options = await configManager.getWalletAnalyticsOptions()
      expect(options.utxoAnalytics.enabled).to.equal(true)
      expect(options.utxoAnalytics).to.have.property('classificationConfig')
      expect(options.utxoAnalytics).to.have.property('healthMonitorConfig')
    })

    it('should merge wallet-specific configuration', async function () {
      await configManager.setConfig('analytics.enabled', true)

      const walletConfig = {
        analytics: {
          classificationConfig: {
            valueThresholds: {
              dust: 2000 // Override global setting
            }
          }
        }
      }

      const options = await configManager.getWalletAnalyticsOptions(walletConfig)
      expect(options.utxoAnalytics.classificationConfig.valueThresholds.dust).to.equal(2000)
    })
  })

  describe('Environment Variable Overrides', function () {
    afterEach(function () {
      // Clean up environment variables
      delete process.env.ECASH_CLI_ANALYTICS_ENABLED
      delete process.env.ECASH_CLI_DEBUG
      delete process.env.ECASH_CLI_DEFAULT_STRATEGY
    })

    it('should override analytics enabled from environment', function () {
      process.env.ECASH_CLI_ANALYTICS_ENABLED = 'true'

      const overrides = configManager.getEnvironmentOverrides()
      expect(overrides.analytics.enabled).to.equal(true)
    })

    it('should handle various truthy values for analytics enabled', function () {
      const truthyValues = ['true', '1', 'yes', 'TRUE', 'Yes']

      for (const value of truthyValues) {
        process.env.ECASH_CLI_ANALYTICS_ENABLED = value
        const overrides = configManager.getEnvironmentOverrides()
        expect(overrides.analytics.enabled).to.equal(true, `Failed for value: ${value}`)
      }
    })

    it('should override debug from environment', function () {
      process.env.ECASH_CLI_DEBUG = 'true'

      const overrides = configManager.getEnvironmentOverrides()
      expect(overrides.analytics.debug).to.equal(true)
    })

    it('should override default strategy from environment', function () {
      process.env.ECASH_CLI_DEFAULT_STRATEGY = 'privacy'

      const overrides = configManager.getEnvironmentOverrides()
      expect(overrides.analytics.defaultStrategy).to.equal('privacy')
    })
  })
})
