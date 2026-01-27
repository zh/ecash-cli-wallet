/*
  Wallet utility functions for managing XEC wallet files
  Enhanced with analytics configuration support
*/

// Global npm libraries
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Local libraries
import ConfigManager from './config-manager.js'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WalletUtil {
  constructor () {
    // Encapsulate dependencies
    this.fs = fs
    this.configManager = new ConfigManager()

    // Bind 'this' object to all subfunctions
    this.saveWallet = this.saveWallet.bind(this)
    this.loadWallet = this.loadWallet.bind(this)
    this.loadWalletWithAnalytics = this.loadWalletWithAnalytics.bind(this)
    this.getWalletPath = this.getWalletPath.bind(this)
    this.walletExists = this.walletExists.bind(this)
    this.listWallets = this.listWallets.bind(this)
    this.migrateWalletToAnalytics = this.migrateWalletToAnalytics.bind(this)
    this.updateWalletAnalyticsConfig = this.updateWalletAnalyticsConfig.bind(this)
    this.validateWalletData = this.validateWalletData.bind(this)
    this.getAvalancheOptions = this.getAvalancheOptions.bind(this)
  }

  // Get the full path for a wallet file
  getWalletPath (walletName) {
    if (!walletName || typeof walletName !== 'string') {
      throw new Error('Wallet name is required and must be a string')
    }

    return path.join(__dirname, '../../.wallets', `${walletName}.json`)
  }

  // Check if a wallet file exists
  async walletExists (walletName) {
    try {
      const walletPath = this.getWalletPath(walletName)
      await this.fs.access(walletPath)
      return true
    } catch (err) {
      return false
    }
  }

  // Save wallet data to a JSON file
  async saveWallet (walletName, walletData) {
    try {
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('Wallet name is required and must be a string')
      }

      if (!walletData || typeof walletData !== 'object') {
        throw new Error('Wallet data is required and must be an object')
      }

      // Validate wallet data structure
      this.validateWalletData(walletData)

      const walletPath = this.getWalletPath(walletName)

      // Ensure .wallets directory exists
      const walletsDir = path.dirname(walletPath)
      await this.fs.mkdir(walletsDir, { recursive: true })

      // Add schema version and last updated timestamp
      const enhancedWalletData = {
        ...walletData,
        schemaVersion: '2.0.0',
        lastUpdated: new Date().toISOString()
      }

      // Save wallet data
      await this.fs.writeFile(walletPath, JSON.stringify(enhancedWalletData, null, 2))

      return true
    } catch (err) {
      throw new Error(`Failed to save wallet: ${err.message}`)
    }
  }

  // Load wallet data from JSON file
  async loadWallet (walletName) {
    try {
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('Wallet name is required and must be a string')
      }

      const walletPath = this.getWalletPath(walletName)

      // Check if wallet exists
      if (!(await this.walletExists(walletName))) {
        throw new Error(`Wallet '${walletName}' not found`)
      }

      // Load and parse wallet file
      const walletStr = await readFile(walletPath, 'utf8')
      const walletData = JSON.parse(walletStr)

      return walletData
    } catch (err) {
      if (err.message.includes('not found')) {
        throw err
      }
      throw new Error(`Failed to load wallet: ${err.message}`)
    }
  }

  // List all available wallets
  async listWallets () {
    try {
      const walletsDir = path.join(__dirname, '../../.wallets')

      // Check if .wallets directory exists
      try {
        await this.fs.access(walletsDir)
      } catch (err) {
        // Directory doesn't exist, return empty array
        return []
      }

      // Read directory contents
      const files = await this.fs.readdir(walletsDir)

      // Filter for .json files
      const walletFiles = files.filter(file => file.endsWith('.json'))

      // Load wallet data for each file
      const wallets = []
      for (const file of walletFiles) {
        try {
          const walletName = path.basename(file, '.json')
          const walletData = await this.loadWallet(walletName)

          wallets.push({
            name: walletName,
            description: walletData.description || '',
            xecAddress: walletData.wallet?.xecAddress || 'Unknown',
            created: walletData.created || 'Unknown',
            analyticsEnabled: walletData.analytics?.enabled || false,
            schemaVersion: walletData.schemaVersion || '1.0.0'
          })
        } catch (err) {
          // Skip corrupted wallet files
          console.warn(`Warning: Could not load wallet file ${file}: ${err.message}`)
        }
      }

      return wallets
    } catch (err) {
      throw new Error(`Failed to list wallets: ${err.message}`)
    }
  }

  // Load wallet with analytics configuration applied
  async loadWalletWithAnalytics (walletName) {
    try {
      const walletData = await this.loadWallet(walletName)

      // Migrate older wallet format if needed
      const migratedWalletData = await this.migrateWalletToAnalytics(walletData)

      return migratedWalletData
    } catch (err) {
      throw new Error(`Failed to load wallet with analytics: ${err.message}`)
    }
  }

  // Migrate wallet to support analytics configuration
  async migrateWalletToAnalytics (walletData) {
    try {
      // Check if already migrated
      if (walletData.schemaVersion && walletData.schemaVersion >= '2.0.0') {
        return walletData
      }

      // Add analytics configuration section if missing
      const migratedData = {
        ...walletData,
        analytics: walletData.analytics || {
          enabled: null, // null means use global setting
          classificationConfig: {}
        },
        schemaVersion: '2.0.0',
        lastUpdated: new Date().toISOString(),
        migratedFrom: walletData.schemaVersion || '1.0.0'
      }

      return migratedData
    } catch (err) {
      throw new Error(`Failed to migrate wallet: ${err.message}`)
    }
  }

  // Update wallet analytics configuration
  async updateWalletAnalyticsConfig (walletName, analyticsConfig) {
    try {
      const walletData = await this.loadWallet(walletName)

      // Update analytics configuration
      walletData.analytics = {
        ...walletData.analytics,
        ...analyticsConfig,
        lastConfigUpdate: new Date().toISOString()
      }

      // Save updated wallet
      await this.saveWallet(walletName, walletData)

      return true
    } catch (err) {
      throw new Error(`Failed to update wallet analytics config: ${err.message}`)
    }
  }

  // Validate wallet data structure
  validateWalletData (walletData) {
    try {
      // Check required wallet section
      if (!walletData.wallet || typeof walletData.wallet !== 'object') {
        throw new Error('Wallet data must contain a wallet section')
      }

      // Check required wallet properties
      const requiredProps = ['mnemonic', 'xecAddress']
      for (const prop of requiredProps) {
        if (!walletData.wallet[prop] || typeof walletData.wallet[prop] !== 'string') {
          throw new Error(`Wallet must have a valid ${prop}`)
        }
      }

      // Validate analytics section if present
      if (walletData.analytics) {
        if (typeof walletData.analytics !== 'object') {
          throw new Error('Analytics configuration must be an object')
        }

        // Validate analytics.enabled if set
        if (walletData.analytics.enabled !== null &&
            walletData.analytics.enabled !== undefined &&
            typeof walletData.analytics.enabled !== 'boolean') {
          throw new Error('Analytics enabled flag must be a boolean or null')
        }
      }

      return true
    } catch (err) {
      throw new Error(`Wallet validation failed: ${err.message}`)
    }
  }

  // Get analytics options for minimal-xec-wallet initialization
  async getAnalyticsOptions (walletName) {
    try {
      const walletData = await this.loadWalletWithAnalytics(walletName)
      // Pass the full walletData instead of just analytics config to include hdPath
      const analyticsOptions = await this.configManager.getWalletAnalyticsOptions(walletData)

      return analyticsOptions
    } catch (err) {
      console.warn(`Warning: Could not get analytics options for wallet '${walletName}': ${err.message}`)
      // Try to at least include hdPath if we can load the wallet data
      try {
        const walletData = await this.loadWallet(walletName)
        const baseOptions = {}
        if (walletData.wallet?.hdPath) {
          baseOptions.hdPath = walletData.wallet.hdPath
        }
        return {
          ...baseOptions,
          utxoAnalytics: { enabled: false }
        }
      } catch (loadErr) {
        return { utxoAnalytics: { enabled: false } }
      }
    }
  }

  // Get Avalanche options for MinimalXecWallet constructor
  async getAvalancheOptions (walletName) {
    try {
      const config = await this.configManager.loadGlobalConfig()
      return {
        avalanche: {
          enabled: config.avalanche.enabled,
          defaultAwaitFinality: config.avalanche.defaultAwaitFinality,
          finalityTimeout: config.avalanche.finalityTimeout
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not get Avalanche options: ${err.message}`)
      return {
        avalanche: {
          enabled: true,
          defaultAwaitFinality: false,
          finalityTimeout: 30000
        }
      }
    }
  }

  // Check if analytics is enabled for a specific wallet
  async isWalletAnalyticsEnabled (walletName) {
    try {
      const walletData = await this.loadWallet(walletName)

      // Wallet-specific setting overrides global
      if (walletData.analytics && typeof walletData.analytics.enabled === 'boolean') {
        return walletData.analytics.enabled
      }

      // Fall back to global setting
      return await this.configManager.isAnalyticsEnabled()
    } catch (err) {
      return false // Default to disabled on error
    }
  }

  // Get wallet schema version
  getWalletSchemaVersion (walletData) {
    return walletData.schemaVersion || '1.0.0'
  }
}

export default WalletUtil
