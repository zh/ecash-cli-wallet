/*
  Check the XEC balance of a wallet with optional analytics display.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'
import path from 'path'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import ConfigManager from '../lib/config-manager.js'

class WalletBalance {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()
    this.configManager = new ConfigManager()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getBalance = this.getBalance.bind(this)
    this.displayBalance = this.displayBalance.bind(this)
    this.getETokenData = this.getETokenData.bind(this)
    this.categorizeTokens = this.categorizeTokens.bind(this)
    this.displayETokenBalances = this.displayETokenBalances.bind(this)
    this.displayUtxoBreakdown = this.displayUtxoBreakdown.bind(this)
    this.displayAnalytics = this.displayAnalytics.bind(this)
    this.displayWalletHealth = this.displayWalletHealth.bind(this)
    this.displayUtxoClassifications = this.displayUtxoClassifications.bind(this)
    this.displaySecurityStatus = this.displaySecurityStatus.bind(this)
    this.displayOptimizationRecommendations = this.displayOptimizationRecommendations.bind(this)
    this.formatHealthStatus = this.formatHealthStatus.bind(this)
    this.exportAnalyticsData = this.exportAnalyticsData.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Checking balance for wallet '${flags.name}'...\n`)

      // Load wallet data with analytics support
      const walletData = await this.walletUtil.loadWalletWithAnalytics(flags.name)

      // Get balance information
      const balanceData = await this.getBalance(walletData, flags.name)

      // Display balance information
      await this.displayBalance(balanceData, flags)

      // Display analytics if enabled and requested
      if (balanceData.analyticsEnabled && (flags.detailed || flags.analytics)) {
        await this.displayAnalytics(balanceData, flags)
      }

      // Export analytics data if requested
      if (flags.exportAnalytics && balanceData.analyticsEnabled) {
        await this.exportAnalyticsData(balanceData, flags.name)
      }

      return true
    } catch (err) {
      console.error('Error checking balance:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    return true
  }

  // Get balance information for the wallet
  async getBalance (walletData, walletName) {
    try {
      // Get analytics options for this wallet
      const analyticsOptions = await this.walletUtil.getAnalyticsOptions(walletName)

      // Create wallet instance with analytics support
      const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic, analyticsOptions)
      await xecWallet.walletInfoPromise

      // Initialize to get UTXOs and balance
      await xecWallet.initialize()

      // Get detailed balance information
      const balance = await xecWallet.getDetailedBalance()
      const xecUsdPrice = await xecWallet.getXecUsd().catch(() => null)

      // Get eToken balances
      const eTokenData = await this.getETokenData(xecWallet)

      // Check if analytics are enabled in configuration
      const analyticsEnabled = await this.walletUtil.isWalletAnalyticsEnabled(walletName)

      // Get analytics data if both enabled and available in the library
      let analyticsData = null
      if (analyticsEnabled && xecWallet.utxos && xecWallet.utxos.hasAnalytics && xecWallet.utxos.hasAnalytics()) {
        try {
          analyticsData = {
            classifications: xecWallet.utxos.getUtxoClassifications(),
            healthReport: xecWallet.utxos.getWalletHealthReport(),
            securityThreats: xecWallet.utxos.detectSecurityThreats(xecWallet.walletInfo.xecAddress),
            recommendations: xecWallet.utxos.getOptimizationRecommendations(),
            performance: xecWallet.utxos.getPerformanceMetrics()
          }
        } catch (err) {
          console.warn(`Warning: Could not get analytics data: ${err.message}`)
          analyticsData = null
        }
      }

      return {
        balance,
        xecUsdPrice,
        address: xecWallet.walletInfo.xecAddress,
        wallet: xecWallet,
        eTokens: eTokenData,
        analyticsEnabled,
        analyticsData,
        walletName
      }
    } catch (err) {
      throw new Error(`Failed to get balance: ${err.message}`)
    }
  }

  // Display balance information on screen
  async displayBalance (balanceData, flags) {
    try {
      const { balance, xecUsdPrice, address, eTokens, analyticsEnabled, analyticsData, walletName } = balanceData

      console.log(`Wallet: ${flags.name}`)
      console.log(`Address: ${address}`)

      // Show analytics status
      if (analyticsEnabled) {
        console.log('Analytics: ENABLED')
        if (analyticsData && analyticsData.healthReport) {
          const healthStatus = this.formatHealthStatus(analyticsData.healthReport.overallHealth)
          console.log(`Health Status: ${healthStatus}`)
        }
      } else {
        console.log('Analytics: DISABLED (use --detailed or config to enable)')
      }

      // Show Avalanche finality status
      const avalancheConfig = await this.configManager.getConfig('avalanche')
      if (avalancheConfig) {
        console.log(`Avalanche Finality: ${avalancheConfig.enabled ? 'ENABLED' : 'DISABLED'}`)
        if (avalancheConfig.enabled && avalancheConfig.defaultAwaitFinality) {
          console.log('Default Finality: ON (all transactions wait for ~3 sec confirmation)')
        }
      }
      console.log()

      // Display XEC balance
      console.log('XEC Balance:')
      console.log(`   Confirmed: ${balance.confirmed.toLocaleString()} XEC`)
      console.log(`   Unconfirmed: ${balance.unconfirmed.toLocaleString()} XEC`)
      console.log(`   Total: ${balance.total.toLocaleString()} XEC`)

      // Display satoshi amounts
      console.log()
      console.log('Satoshi Balance:')
      console.log(`   Total: ${balance.satoshis.total.toLocaleString()} sats`)

      // Display USD value if price is available
      if (xecUsdPrice && balance.total > 0) {
        const usdValue = (balance.total * xecUsdPrice).toFixed(2)
        console.log()
        console.log('USD Value:')
        console.log(`   ~$${usdValue} USD (at $${xecUsdPrice}/XEC)`)
      }

      // Display eToken balances
      await this.displayETokenBalances(eTokens)

      // Display UTXO breakdown for debugging fee issues
      await this.displayUtxoBreakdown(balanceData.wallet)

      console.log()
      console.log('Commands:')
      console.log(`   Send XEC: node xec-wallet.js send-xec -n ${walletName} -a <address> -q <amount>`)
      console.log(`   View QR: node xec-wallet.js wallet-addrs -n ${walletName} -q`)

      return true
    } catch (err) {
      throw new Error(`Failed to display balance: ${err.message}`)
    }
  }

  // Get eToken data for the wallet
  async getETokenData (wallet) {
    try {
      // Extract token UTXOs from the wallet's XEC UTXOs
      const tokenUtxos = []

      if (wallet.utxos && wallet.utxos.utxoStore && wallet.utxos.utxoStore.xecUtxos) {
        // Look for UTXOs that have token data
        for (const utxo of wallet.utxos.utxoStore.xecUtxos) {
          if (utxo.token && utxo.token.tokenId && !utxo.token.isMintBaton) {
            tokenUtxos.push(utxo.token)
          }
        }
      }

      if (tokenUtxos.length === 0) {
        return { slp: [], alp: [] }
      }

      // Group UTXOs by token ID and sum balances
      const tokenBalances = {}
      for (const token of tokenUtxos) {
        const tokenId = token.tokenId
        if (!tokenId) continue

        if (!tokenBalances[tokenId]) {
          tokenBalances[tokenId] = {
            tokenId,
            balance: 0,
            protocol: token.tokenType?.protocol || 'SLP'
          }
        }

        // Add balance from atoms
        const atoms = token.atoms || 0
        let balance = 0
        if (typeof atoms === 'bigint') {
          balance = Number(atoms)
        } else if (typeof atoms === 'string') {
          balance = parseFloat(atoms)
        } else {
          balance = parseFloat(atoms) || 0
        }

        tokenBalances[tokenId].balance += balance
      }

      // Convert to array and get metadata for each token
      const tokenList = Object.values(tokenBalances)

      // Get detailed data for each token
      const tokenDataPromises = tokenList.map(async (token) => {
        try {
          let ticker = 'Unknown'
          let name = 'Unknown Token'
          let decimals = 0
          let protocol = token.protocol || 'SLP'

          // Try multiple methods to get token metadata
          try {
            // Method 1: Try wallet.getETokenData (most reliable for metadata)
            const eTokenData = await wallet.getETokenData(token.tokenId)
            if (eTokenData) {
              ticker = eTokenData.ticker || ticker
              name = eTokenData.name || name
              decimals = eTokenData.decimals || decimals
              protocol = eTokenData.protocol || protocol
            }
          } catch (err) {
            // Method 1 failed, try fallback
          }

          // Method 2: Try hybridTokens.getTokenData as fallback
          if (ticker === 'Unknown') {
            try {
              const tokenData = await wallet.hybridTokens.getTokenData(token.tokenId)
              protocol = tokenData.protocol || protocol

              if (tokenData.genesisData) {
                ticker = tokenData.genesisData.ticker || ticker
                name = tokenData.genesisData.name || name
                decimals = tokenData.genesisData.decimals || decimals
              }
            } catch (err) {
              // Method 2 failed, continue to final fallback
            }
          }

          // Final fallback: Use shortened token ID as ticker if still unknown
          if (ticker === 'Unknown') {
            ticker = token.tokenId.slice(0, 8).toUpperCase()
            name = `Token ${ticker}`
          }

          // Calculate display amount
          const displayBalance = token.balance / Math.pow(10, decimals)

          return {
            tokenId: token.tokenId,
            balance: token.balance,
            balanceStr: displayBalance.toString(),
            ticker,
            name,
            decimals,
            protocol
          }
        } catch (err) {
          console.error(`Warning: Could not process token ${token.tokenId}:`, err.message)
          // Ultimate fallback
          const fallbackTicker = token.tokenId.slice(0, 8).toUpperCase()
          return {
            tokenId: token.tokenId,
            balance: token.balance,
            balanceStr: (token.balance || 0).toString(),
            ticker: fallbackTicker,
            name: `Token ${fallbackTicker}`,
            decimals: 0,
            protocol: token.protocol || 'SLP'
          }
        }
      })

      const allTokenData = await Promise.all(tokenDataPromises)

      // Filter out any tokens with 0 balance
      const filteredTokenData = allTokenData.filter(token =>
        parseFloat(token.balanceStr) > 0
      )

      // Categorize tokens by protocol
      return this.categorizeTokens(filteredTokenData)
    } catch (err) {
      console.error('Warning: Could not fetch eToken data:', err.message)
      return { slp: [], alp: [] }
    }
  }

  // Categorize tokens into SLP and ALP groups
  categorizeTokens (tokenData) {
    const slp = []
    const alp = []

    for (const token of tokenData) {
      if (token.protocol && token.protocol.toUpperCase() === 'ALP') {
        alp.push(token)
      } else {
        slp.push(token)
      }
    }

    return { slp, alp }
  }

  // Display eToken balances grouped by protocol
  async displayETokenBalances (eTokens) {
    try {
      const { slp, alp } = eTokens

      if (slp.length === 0 && alp.length === 0) {
        return
      }

      console.log()

      // Display SLP tokens
      if (slp.length > 0) {
        console.log('SLP Tokens:')
        for (const token of slp) {
          const amount = parseFloat(token.balanceStr).toLocaleString()
          console.log(`   ${token.ticker} ${token.name}  ${token.tokenId}  ${amount}`)
        }
      }

      // Display ALP tokens
      if (alp.length > 0) {
        console.log()
        console.log('ALP Tokens:')
        for (const token of alp) {
          const amount = parseFloat(token.balanceStr).toLocaleString()
          console.log(`   ${token.ticker} ${token.name}  ${token.tokenId}  ${amount}`)
        }
      }

      return true
    } catch (err) {
      console.error('Warning: Could not display eToken balances:', err.message)
      return false
    }
  }

  // Display UTXO breakdown for debugging fee calculation issues
  async displayUtxoBreakdown (wallet) {
    try {
      console.log()
      console.log('UTXO Breakdown (for fee calculation debugging):')
      console.log('-'.repeat(60))

      if (!wallet.utxos || !wallet.utxos.utxoStore || !wallet.utxos.utxoStore.xecUtxos) {
        console.log('   No UTXO data available')
        return false
      }

      const utxos = wallet.utxos.utxoStore.xecUtxos
      const pureXecUtxos = []
      const tokenUtxos = []
      let pureXecTotal = 0
      let tokenXecTotal = 0

      // Categorize UTXOs
      for (const utxo of utxos) {
        // Safely get XEC amount - use sats property which is the correct one
        let xecAmount = 0
        if (utxo.sats !== undefined) {
          const satoshis = parseInt(utxo.sats) || 0
          xecAmount = satoshis / 100 // Convert from satoshis to XEC
        } else if (utxo.value) {
          const satoshis = parseInt(utxo.value) || 0
          xecAmount = satoshis / 100 // Convert from satoshis to XEC
        }

        // Safely get TXID from outpoint
        const txid = utxo.outpoint?.txid || utxo.txid || 'unknown'
        const outIdx = utxo.outpoint?.outIdx !== undefined ? utxo.outpoint.outIdx : (utxo.outIdx !== undefined ? utxo.outIdx : 0)

        if (utxo.token && utxo.token.tokenId) {
          // This UTXO is locked with tokens
          tokenUtxos.push({
            txid,
            outIdx,
            xecAmount,
            tokenId: utxo.token.tokenId,
            atoms: utxo.token.atoms
          })
          tokenXecTotal += xecAmount
        } else {
          // This is pure XEC UTXO
          pureXecUtxos.push({
            txid,
            outIdx,
            xecAmount
          })
          pureXecTotal += xecAmount
        }
      }

      console.log(`Pure XEC UTXOs (available for fees): ${pureXecUtxos.length}`)
      console.log(`   Total: ${pureXecTotal.toLocaleString()} XEC`)

      if (pureXecUtxos.length > 0) {
        console.log('   UTXOs:')
        pureXecUtxos.slice(0, 5).forEach((utxo, i) => {
          console.log(`     ${i + 1}. ${utxo.txid.slice(0, 8)}...${utxo.txid.slice(-4)}:${utxo.outIdx} - ${utxo.xecAmount.toLocaleString()} XEC`)
        })
        if (pureXecUtxos.length > 5) {
          console.log(`     ... and ${pureXecUtxos.length - 5} more`)
        }
      }

      console.log()
      console.log(`Token UTXOs (XEC locked with tokens): ${tokenUtxos.length}`)
      console.log(`   Total: ${tokenXecTotal.toLocaleString()} XEC`)

      if (tokenUtxos.length > 0) {
        console.log('   UTXOs:')
        tokenUtxos.slice(0, 5).forEach((utxo, i) => {
          console.log(`     ${i + 1}. ${utxo.txid.slice(0, 8)}...${utxo.txid.slice(-4)}:${utxo.outIdx} - ${utxo.xecAmount.toLocaleString()} XEC (Token: ${utxo.tokenId.slice(0, 8)}...)`)
        })
        if (tokenUtxos.length > 5) {
          console.log(`     ... and ${tokenUtxos.length - 5} more`)
        }
      }

      console.log()
      console.log('Fee Calculation Analysis:')
      console.log(`   Available for fees: ${pureXecTotal.toLocaleString()} XEC`)
      console.log(`   Locked in tokens: ${tokenXecTotal.toLocaleString()} XEC`)
      console.log(`   Total wallet: ${(pureXecTotal + tokenXecTotal).toLocaleString()} XEC`)

      if (pureXecTotal < 0.1) {
        console.log('   WARNING: Very low pure XEC available for fees!')
        console.log('   This may cause "Insufficient XEC for transaction fees" errors.')
        console.log('   Consider adding more pure XEC to your wallet.')
      }

      return true
    } catch (err) {
      console.error('Warning: Could not display UTXO breakdown:', err.message)
      return false
    }
  }

  // Display comprehensive analytics information
  async displayAnalytics (balanceData, flags) {
    try {
      const { analyticsData } = balanceData

      if (!analyticsData) {
        console.log('Analytics data not available')
        return false
      }

      console.log()
      console.log('WALLET ANALYTICS')
      console.log('='.repeat(60))

      // Display wallet health
      await this.displayWalletHealth(analyticsData.healthReport)

      // Display UTXO classifications
      await this.displayUtxoClassifications(analyticsData.classifications)

      // Display security status
      if (analyticsData.securityThreats) {
        await this.displaySecurityStatus(analyticsData.securityThreats)
      }

      // Display optimization recommendations
      if (analyticsData.recommendations) {
        await this.displayOptimizationRecommendations(analyticsData.recommendations)
      }

      // Display performance metrics if detailed mode
      if (flags.detailed && analyticsData.performance) {
        console.log()
        console.log('Performance Metrics:')
        console.log('-'.repeat(30))
        console.log(`   Cache Hit Rate: ${(analyticsData.performance.cacheHitRate * 100).toFixed(1)}%`)
        console.log(`   Analysis Time: ${analyticsData.performance.lastAnalysisTime || 'N/A'}ms`)
        console.log(`   Cached UTXOs: ${analyticsData.performance.cachedUtxoCount || 0}`)
      }

      return true
    } catch (err) {
      console.error('Warning: Could not display analytics:', err.message)
      return false
    }
  }

  // Display wallet health summary
  async displayWalletHealth (healthReport) {
    try {
      console.log()
      console.log('Wallet Health Summary:')
      console.log('-'.repeat(30))

      const healthStatus = this.formatHealthStatus(healthReport.overallHealth)
      console.log(`   Overall Health: ${healthStatus}`)

      if (healthReport.riskLevel) {
        console.log(`   Risk Level: ${healthReport.riskLevel.toUpperCase()}`)
      }

      if (healthReport.healthyUtxos !== undefined) {
        console.log(`   Healthy UTXOs: ${healthReport.healthyUtxos}`)
      }

      if (healthReport.dustUtxos !== undefined && healthReport.dustUtxos > 0) {
        console.log(`   Dust UTXOs: ${healthReport.dustUtxos} (WARNING)`)
      }

      if (healthReport.suspiciousUtxos !== undefined && healthReport.suspiciousUtxos > 0) {
        console.log(`   Suspicious UTXOs: ${healthReport.suspiciousUtxos} (ALERT)`)
      }

      if (healthReport.unconfirmedUtxos !== undefined && healthReport.unconfirmedUtxos > 0) {
        console.log(`   Unconfirmed UTXOs: ${healthReport.unconfirmedUtxos}`)
      }

      // Display key alerts
      if (healthReport.alerts && healthReport.alerts.length > 0) {
        console.log()
        console.log('   Alerts:')
        healthReport.alerts.slice(0, 3).forEach((alert, i) => {
          console.log(`     ${i + 1}. ${alert.severity.toUpperCase()}: ${alert.message}`)
        })
        if (healthReport.alerts.length > 3) {
          console.log(`     ... and ${healthReport.alerts.length - 3} more alerts`)
        }
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display wallet health:', err.message)
      return false
    }
  }

  // Display UTXO classifications
  async displayUtxoClassifications (classifications) {
    try {
      if (!classifications) return false

      console.log()
      console.log('UTXO Classifications:')
      console.log('-'.repeat(30))

      // Age classifications
      if (classifications.byAge) {
        console.log('   By Age:')
        Object.entries(classifications.byAge).forEach(([age, count]) => {
          if (count > 0) {
            console.log(`     ${age}: ${count}`)
          }
        })
      }

      // Value classifications
      if (classifications.byValue) {
        console.log('   By Value:')
        Object.entries(classifications.byValue).forEach(([value, count]) => {
          if (count > 0) {
            console.log(`     ${value}: ${count}`)
          }
        })
      }

      // Privacy classifications
      if (classifications.byPrivacy) {
        console.log('   By Privacy Score:')
        Object.entries(classifications.byPrivacy).forEach(([privacy, count]) => {
          if (count > 0) {
            console.log(`     ${privacy}: ${count}`)
          }
        })
      }

      // Statistics summary
      if (classifications.statistics) {
        const stats = classifications.statistics
        console.log()
        console.log('   Summary Statistics:')
        console.log(`     Total UTXOs: ${stats.totalUtxos}`)
        console.log(`     Total Value: ${(stats.totalValue / 100).toLocaleString()} XEC`)
        if (stats.averagePrivacyScore !== undefined) {
          console.log(`     Average Privacy Score: ${stats.averagePrivacyScore.toFixed(1)}/100`)
        }
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display UTXO classifications:', err.message)
      return false
    }
  }

  // Display security status and threats
  async displaySecurityStatus (securityThreats) {
    try {
      if (!securityThreats) return false

      console.log()
      console.log('Security Analysis:')
      console.log('-'.repeat(30))

      if (securityThreats.dustAttackRisk !== undefined) {
        const riskLevel = securityThreats.dustAttackRisk > 0.7
          ? 'HIGH'
          : securityThreats.dustAttackRisk > 0.3 ? 'MEDIUM' : 'LOW'
        console.log(`   Dust Attack Risk: ${riskLevel}`)

        if (securityThreats.dustAttackRisk > 0.5) {
          console.log('     WARNING: Potential dust attack pattern detected')
        }
      }

      if (securityThreats.privacyScore !== undefined) {
        console.log(`   Privacy Score: ${securityThreats.privacyScore.toFixed(1)}/100`)

        if (securityThreats.privacyScore < 30) {
          console.log('     WARNING: Low privacy score - transactions may be easily linkable')
        }
      }

      if (securityThreats.suspiciousPatterns && securityThreats.suspiciousPatterns.length > 0) {
        console.log('   Suspicious Patterns Detected:')
        securityThreats.suspiciousPatterns.slice(0, 3).forEach((pattern, i) => {
          console.log(`     ${i + 1}. ${pattern.type}: ${pattern.description}`)
        })
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display security status:', err.message)
      return false
    }
  }

  // Display optimization recommendations
  async displayOptimizationRecommendations (recommendations) {
    try {
      if (!recommendations || !recommendations.length) return false

      console.log()
      console.log('Optimization Recommendations:')
      console.log('-'.repeat(30))

      recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.type.toUpperCase()}: ${rec.message}`)
        if (rec.potentialSavings) {
          console.log(`      Potential savings: ${rec.potentialSavings} satoshis`)
        }
        if (rec.priority) {
          console.log(`      Priority: ${rec.priority}`)
        }
      })

      if (recommendations.length > 5) {
        console.log(`   ... and ${recommendations.length - 5} more recommendations`)
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display recommendations:', err.message)
      return false
    }
  }

  // Format health status for display
  formatHealthStatus (health) {
    if (!health) return 'UNKNOWN'

    const status = health.toLowerCase()
    switch (status) {
      case 'healthy':
        return 'HEALTHY'
      case 'at-risk':
      case 'at_risk':
        return 'AT RISK'
      case 'unhealthy':
        return 'UNHEALTHY'
      case 'critical':
        return 'CRITICAL'
      default:
        return status.toUpperCase()
    }
  }

  // Export analytics data to JSON file
  async exportAnalyticsData (balanceData, walletName) {
    try {
      const { analyticsData, balance, address } = balanceData

      const exportData = {
        wallet: walletName,
        address,
        exportTime: new Date().toISOString(),
        balance: {
          confirmed: balance.confirmed,
          unconfirmed: balance.unconfirmed,
          total: balance.total
        },
        analytics: analyticsData
      }

      const fileName = `${walletName}-analytics-${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(process.cwd(), fileName)

      await this.walletUtil.fs.writeFile(filePath, JSON.stringify(exportData, null, 2))

      console.log()
      console.log(`Analytics data exported to: ${fileName}`)

      return true
    } catch (err) {
      console.error('Warning: Could not export analytics data:', err.message)
      return false
    }
  }
}

export default WalletBalance
