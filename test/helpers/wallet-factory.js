/*
  Test Wallet Factory
  Creates and manages test wallet fixtures with various states
*/

import { promises as fs } from 'fs'
import path from 'path'

/**
 * Factory for creating test wallet fixtures
 */
export class WalletFactory {
  constructor (fixturesDir) {
    this.fixturesDir = fixturesDir
    this.walletsDir = path.join(fixturesDir, 'wallets')
    this.createdWallets = new Set()
  }

  /**
   * Create a basic empty wallet fixture
   */
  async createEmptyWallet (name = 'empty-wallet') {
    const walletData = {
      name,
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      hdPath: "m/44'/145'/0'/0/0",
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      cashAddress: 'bitcoincash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      slpAddress: 'simpleledger:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      publicKey: '03d503ecf28ce1c6b38beb80b67ba653e8a5e51a9c6da99f9ad3b3f6a70de37cca',
      balance: {
        xec: 0,
        usd: 0
      },
      tokens: [],
      utxos: [],
      analytics: {
        enabled: false
      }
    }

    return this.saveWallet(name, walletData)
  }

  /**
   * Create a wallet with UTXOs for testing analytics
   */
  async createWalletWithUtxos (name = 'wallet-with-utxos') {
    const walletData = {
      name,
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
      hdPath: "m/44'/145'/0'/0/0",
      address: 'ecash:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q',
      cashAddress: 'bitcoincash:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q',
      slpAddress: 'simpleledger:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q',
      publicKey: '03a503ecf28ce1c6b38beb80b67ba653e8a5e51a9c6da99f9ad3b3f6a70de37ccb',
      balance: {
        xec: 54.79,
        usd: 0.0027
      },
      tokens: [],
      utxos: [
        {
          txid: '63836510e27466ed8e2a629db5334839f7daec0792171127fb6da61cdc9581c8',
          outIdx: 1,
          value: 2737,
          address: 'ecash:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q'
        },
        {
          txid: '818b7ba249dc8c289b913cb8b96c13ae84317a3751ffc44c3ac0bcaa690960bb',
          outIdx: 3,
          value: 558,
          address: 'ecash:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q'
        },
        {
          txid: 'e7fdfb4df259f488c6575a2d03e6a455c48c80ab01dcd57a8c7d21f3742bb0ba',
          outIdx: 1,
          value: 546,
          address: 'ecash:qz8fqz8lhudzsqq5v8z5vv8z5z5q5z5q5z5z5q5z5q'
        }
      ],
      analytics: {
        enabled: true,
        classifications: {
          byAge: {
            fresh: 3,
            recent: 0,
            mature: 0,
            aged: 0,
            ancient: 0
          },
          byValue: {
            dust: 2,
            micro: 1,
            small: 0,
            medium: 0,
            large: 0,
            whale: 0
          },
          statistics: {
            totalUtxos: 3,
            totalValue: 3841,
            averageAge: 10,
            averageValue: 1,
            averagePrivacyScore: 68
          }
        }
      }
    }

    return this.saveWallet(name, walletData)
  }

  /**
   * Create a wallet with tokens
   */
  async createWalletWithTokens (name = 'wallet-with-tokens') {
    const walletData = {
      name,
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      hdPath: "m/44'/145'/0'/0/0",
      address: 'ecash:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q',
      cashAddress: 'bitcoincash:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q',
      slpAddress: 'simpleledger:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q',
      publicKey: '03b503ecf28ce1c6b38beb80b67ba653e8a5e51a9c6da99f9ad3b3f6a70de37ccc',
      balance: {
        xec: 1000.0,
        usd: 0.05
      },
      tokens: [
        {
          tokenId: 'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2',
          ticker: 'HELLO',
          name: 'Hello World Token',
          decimals: 0,
          balance: '1000000'
        },
        {
          tokenId: 'b39fdb53e21d67fa5fd3a11122f1452f15884047f2b80e8efe633c3b520b46a9',
          ticker: 'TEST',
          name: 'Test Token',
          decimals: 2,
          balance: '500.00'
        }
      ],
      utxos: [
        {
          txid: 'token_utxo_1',
          outIdx: 1,
          value: 546,
          address: 'ecash:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q',
          token: {
            tokenId: 'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2',
            amount: '1000000'
          }
        }
      ],
      analytics: {
        enabled: true
      }
    }

    return this.saveWallet(name, walletData)
  }

  /**
   * Create a wallet with security issues for testing
   */
  async createInsecureWallet (name = 'insecure-wallet') {
    const walletData = {
      name,
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      hdPath: "m/44'/145'/0'/0/0",
      address: 'ecash:qz1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z',
      balance: {
        xec: 100.0,
        usd: 0.005
      },
      utxos: [
        // Many dust UTXOs to simulate dust attack
        ...Array.from({ length: 20 }, (_, i) => ({
          txid: `dust_attack_${i}`,
          outIdx: 0,
          value: 546, // Minimum dust amount
          address: 'ecash:qz1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z1z'
        }))
      ],
      analytics: {
        enabled: true,
        securityThreats: {
          dustAttack: {
            detected: true,
            suspiciousUtxos: 20,
            confidence: 85
          },
          riskLevel: 'high'
        }
      }
    }

    return this.saveWallet(name, walletData)
  }

  /**
   * Create mock analytics data
   */
  createMockAnalytics (options = {}) {
    return {
      classifications: {
        byAge: {
          unconfirmed: options.unconfirmed || 0,
          fresh: options.fresh || 5,
          recent: options.recent || 3,
          mature: options.mature || 2,
          aged: options.aged || 1,
          ancient: options.ancient || 0
        },
        byValue: {
          dust: options.dust || 3,
          micro: options.micro || 4,
          small: options.small || 3,
          medium: options.medium || 1,
          large: options.large || 0,
          whale: options.whale || 0
        },
        statistics: {
          totalUtxos: options.totalUtxos || 11,
          totalValue: options.totalValue || 50000,
          averageAge: options.averageAge || 25,
          averageValue: options.averageValue || 4545,
          averagePrivacyScore: options.averagePrivacyScore || 65
        }
      },
      healthReport: {
        overallHealth: options.overallHealth || 'healthy',
        metrics: {
          totalUtxos: options.totalUtxos || 11,
          healthyUtxos: options.healthyUtxos || 10,
          unhealthyUtxos: options.unhealthyUtxos || 1,
          dustUtxos: options.dustUtxos || 3,
          suspiciousUtxos: options.suspiciousUtxos || 0
        },
        recommendations: options.recommendations || []
      }
    }
  }

  /**
   * Save wallet data to fixture file
   */
  async saveWallet (name, walletData) {
    await fs.mkdir(this.walletsDir, { recursive: true })
    const walletPath = path.join(this.walletsDir, `${name}.json`)
    await fs.writeFile(walletPath, JSON.stringify(walletData, null, 2))
    this.createdWallets.add(name)
    return walletPath
  }

  /**
   * Clean up all created wallet fixtures
   */
  async cleanup () {
    for (const walletName of this.createdWallets) {
      try {
        const walletPath = path.join(this.walletsDir, `${walletName}.json`)
        await fs.unlink(walletPath)
      } catch (err) {
        // Ignore if file doesn't exist
        if (err.code !== 'ENOENT') {
          console.warn(`Warning: Could not clean up wallet fixture ${walletName}:`, err.message)
        }
      }
    }
    this.createdWallets.clear()
  }

  /**
   * Get path to wallet fixture
   */
  getWalletPath (name) {
    return path.join(this.walletsDir, `${name}.json`)
  }

  /**
   * Check if wallet fixture exists
   */
  async walletExists (name) {
    try {
      const walletPath = this.getWalletPath(name)
      await fs.access(walletPath)
      return true
    } catch (err) {
      return false
    }
  }
}

// Create default factory instance
export const walletFactory = new WalletFactory(global.TEST_CONFIG?.fixturesDir || path.join(__dirname, '../fixtures'))
