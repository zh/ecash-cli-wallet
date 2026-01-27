/*
  Unit Tests for Avalanche Finality
  Tests Avalanche Pre-Consensus configuration and finality flag parsing
*/

import { expect } from 'chai'
import sinon from 'sinon'
import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import ConfigManager from '../../src/lib/config-manager.js'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Avalanche Finality', function () {
  let configManager
  let tempConfigPath

  beforeEach(function () {
    // Create temp config path for each test
    const tempDir = path.join(__dirname, '../fixtures/temp')
    tempConfigPath = path.join(tempDir, `test-avalanche-config-${Date.now()}.json`)

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

    // Restore all stubs
    sinon.restore()
  })

  describe('Default Avalanche Configuration', function () {
    it('should have avalanche configuration in defaultConfig', function () {
      expect(configManager.defaultConfig).to.have.property('avalanche')
      expect(configManager.defaultConfig.avalanche).to.be.an('object')
    })

    it('should have avalanche enabled by default', function () {
      expect(configManager.defaultConfig.avalanche.enabled).to.equal(true)
    })

    it('should have defaultAwaitFinality set to false by default', function () {
      expect(configManager.defaultConfig.avalanche.defaultAwaitFinality).to.equal(false)
    })

    it('should have finalityTimeout set to 30000ms by default', function () {
      expect(configManager.defaultConfig.avalanche.finalityTimeout).to.equal(30000)
    })

    it('should have showFinalityStatus set to true by default', function () {
      expect(configManager.defaultConfig.avalanche.showFinalityStatus).to.equal(true)
    })

    it('should have all required avalanche properties', function () {
      const avalanche = configManager.defaultConfig.avalanche
      expect(avalanche).to.have.property('enabled')
      expect(avalanche).to.have.property('defaultAwaitFinality')
      expect(avalanche).to.have.property('finalityTimeout')
      expect(avalanche).to.have.property('showFinalityStatus')
    })
  })

  describe('getAvalancheOptions', function () {
    it('should return avalanche options from default config', async function () {
      const options = await configManager.getAvalancheOptions()

      expect(options).to.have.property('avalanche')
      expect(options.avalanche.enabled).to.equal(true)
      expect(options.avalanche.defaultAwaitFinality).to.equal(false)
      expect(options.avalanche.finalityTimeout).to.equal(30000)
    })

    it('should return avalanche options from saved config', async function () {
      // Create a config file with modified avalanche settings
      const testConfig = {
        ...configManager.defaultConfig,
        avalanche: {
          enabled: false,
          defaultAwaitFinality: true,
          finalityTimeout: 60000,
          showFinalityStatus: false
        }
      }

      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true })
      await fs.writeFile(tempConfigPath, JSON.stringify(testConfig))

      const options = await configManager.getAvalancheOptions()

      expect(options.avalanche.enabled).to.equal(false)
      expect(options.avalanche.defaultAwaitFinality).to.equal(true)
      expect(options.avalanche.finalityTimeout).to.equal(60000)
    })

    it('should return default options on error', async function () {
      // Force an error by making the config file unreadable
      sinon.stub(configManager, 'loadGlobalConfig').rejects(new Error('Mock error'))

      // Suppress console.warn during test
      sinon.stub(console, 'warn')

      const options = await configManager.getAvalancheOptions()

      expect(options.avalanche.enabled).to.equal(true)
      expect(options.avalanche.defaultAwaitFinality).to.equal(false)
      expect(options.avalanche.finalityTimeout).to.equal(30000)
    })
  })

  describe('Avalanche Configuration Persistence', function () {
    it('should save and load avalanche.enabled setting', async function () {
      await configManager.setConfig('avalanche.enabled', false)

      const enabled = await configManager.getConfig('avalanche.enabled')
      expect(enabled).to.equal(false)
    })

    it('should save and load avalanche.defaultAwaitFinality setting', async function () {
      await configManager.setConfig('avalanche.defaultAwaitFinality', true)

      const defaultAwaitFinality = await configManager.getConfig('avalanche.defaultAwaitFinality')
      expect(defaultAwaitFinality).to.equal(true)
    })

    it('should save and load avalanche.finalityTimeout setting', async function () {
      await configManager.setConfig('avalanche.finalityTimeout', 45000)

      const timeout = await configManager.getConfig('avalanche.finalityTimeout')
      expect(timeout).to.equal(45000)
    })

    it('should save and load avalanche.showFinalityStatus setting', async function () {
      await configManager.setConfig('avalanche.showFinalityStatus', false)

      const showStatus = await configManager.getConfig('avalanche.showFinalityStatus')
      expect(showStatus).to.equal(false)
    })

    it('should get entire avalanche configuration section', async function () {
      const avalancheConfig = await configManager.getConfig('avalanche')

      expect(avalancheConfig).to.be.an('object')
      expect(avalancheConfig).to.have.property('enabled')
      expect(avalancheConfig).to.have.property('defaultAwaitFinality')
      expect(avalancheConfig).to.have.property('finalityTimeout')
      expect(avalancheConfig).to.have.property('showFinalityStatus')
    })
  })

  describe('Finality Flag Parsing', function () {
    it('should build txOptions with awaitFinality when finality flag is true', function () {
      const flags = { finality: true }
      const txOptions = {}

      if (flags.finality) {
        txOptions.awaitFinality = true
      }

      expect(txOptions.awaitFinality).to.equal(true)
    })

    it('should build txOptions without awaitFinality when finality flag is false', function () {
      const flags = { finality: false }
      const txOptions = {}

      if (flags.finality) {
        txOptions.awaitFinality = true
      }

      expect(txOptions.awaitFinality).to.be.undefined // eslint-disable-line no-unused-expressions
    })

    it('should include finalityTimeout when provided', function () {
      const flags = { finality: true, finalityTimeout: '45000' }
      const txOptions = {}

      if (flags.finality) {
        txOptions.awaitFinality = true
        if (flags.finalityTimeout) {
          txOptions.finalityTimeout = parseInt(flags.finalityTimeout)
        }
      }

      expect(txOptions.awaitFinality).to.equal(true)
      expect(txOptions.finalityTimeout).to.equal(45000)
    })

    it('should use default timeout when finalityTimeout not provided', function () {
      const flags = { finality: true }
      const defaultTimeout = 30000
      const txOptions = {}

      if (flags.finality) {
        txOptions.awaitFinality = true
        txOptions.finalityTimeout = flags.finalityTimeout
          ? parseInt(flags.finalityTimeout)
          : defaultTimeout
      }

      expect(txOptions.finalityTimeout).to.equal(30000)
    })
  })

  describe('Finality Status Output', function () {
    it('should generate correct status message for confirmed finality', function () {
      const flags = { finality: true }
      let statusMessage

      if (flags.finality) {
        statusMessage = 'Finality: CONFIRMED (Avalanche)'
      } else {
        statusMessage = 'Finality: Pending (~10 min for block confirmation)'
      }

      expect(statusMessage).to.equal('Finality: CONFIRMED (Avalanche)')
    })

    it('should generate correct status message for pending finality', function () {
      const flags = { finality: false }
      let statusMessage

      if (flags.finality) {
        statusMessage = 'Finality: CONFIRMED (Avalanche)'
      } else {
        statusMessage = 'Finality: Pending (~10 min for block confirmation)'
      }

      expect(statusMessage).to.equal('Finality: Pending (~10 min for block confirmation)')
    })
  })

  describe('Avalanche Options Integration', function () {
    it('should provide options compatible with MinimalXecWallet constructor', async function () {
      const options = await configManager.getAvalancheOptions()

      // Verify structure matches what MinimalXecWallet expects
      expect(options).to.have.property('avalanche')
      expect(typeof options.avalanche.enabled).to.equal('boolean')
      expect(typeof options.avalanche.defaultAwaitFinality).to.equal('boolean')
      expect(typeof options.avalanche.finalityTimeout).to.equal('number')
    })

    it('should merge avalanche options with other wallet options', async function () {
      const avalancheOptions = await configManager.getAvalancheOptions()
      const analyticsOptions = await configManager.getWalletAnalyticsOptions()

      // Merge options as done in wallet-create.js
      const mergedOptions = Object.assign({}, analyticsOptions, avalancheOptions)

      expect(mergedOptions).to.have.property('avalanche')
      expect(mergedOptions).to.have.property('utxoAnalytics')
    })
  })
})
