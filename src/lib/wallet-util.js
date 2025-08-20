/*
  Wallet utility functions for managing XEC wallet files
*/

// Global npm libraries
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WalletUtil {
  constructor () {
    // Encapsulate dependencies
    this.fs = fs

    // Bind 'this' object to all subfunctions
    this.saveWallet = this.saveWallet.bind(this)
    this.loadWallet = this.loadWallet.bind(this)
    this.getWalletPath = this.getWalletPath.bind(this)
    this.walletExists = this.walletExists.bind(this)
    this.listWallets = this.listWallets.bind(this)
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

      const walletPath = this.getWalletPath(walletName)
      
      // Ensure .wallets directory exists
      const walletsDir = path.dirname(walletPath)
      await this.fs.mkdir(walletsDir, { recursive: true })

      // Save wallet data
      await this.fs.writeFile(walletPath, JSON.stringify(walletData, null, 2))
      
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
            created: walletData.created || 'Unknown'
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
}

export default WalletUtil