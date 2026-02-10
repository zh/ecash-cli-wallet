/*
  Comprehensive wallet health analysis and monitoring.
*/

// Global npm libraries
import path from 'path'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import ConfigManager from '../lib/config-manager.js'
import { loadWalletWithAnalytics } from '../lib/wallet-loader.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class WalletHealth {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.configManager = new ConfigManager()
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.analyzeWalletHealth = this.analyzeWalletHealth.bind(this)
    this.displayHealthDashboard = this.displayHealthDashboard.bind(this)
    this.displayDetailedHealthAnalysis = this.displayDetailedHealthAnalysis.bind(this)
    this.displayDustAttackAnalysis = this.displayDustAttackAnalysis.bind(this)
    this.displaySecurityThreats = this.displaySecurityThreats.bind(this)
    this.displayActionableRecommendations = this.displayActionableRecommendations.bind(this)
    this.formatHealthScore = this.formatHealthScore.bind(this)
    this.formatRiskLevel = this.formatRiskLevel.bind(this)
    this.exportHealthReport = this.exportHealthReport.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Analyzing health for wallet '${flags.name}'...\n`)

      // Check if analytics are available
      const analyticsEnabled = await this.walletUtil.isWalletAnalyticsEnabled(flags.name)
      if (!analyticsEnabled) {
        console.log('Analytics are disabled for this wallet.')
        console.log('Enable analytics to use health monitoring:')
        console.log('   node xec-wallet.js config-set analytics.enabled true')
        console.log('   Or enable for this wallet only with upcoming config commands.')
        return false
      }

      // Load wallet data and perform health analysis
      const healthData = await this.analyzeWalletHealth(flags.name)

      // Display health dashboard
      await this.displayHealthDashboard(healthData, flags)

      // Display detailed analysis if requested
      if (flags.detailed) {
        await this.displayDetailedHealthAnalysis(healthData, flags)
      }

      // Display dust attack analysis
      if (flags.dustAnalysis || flags.detailed) {
        await this.displayDustAttackAnalysis(healthData, flags)
      }

      // Display security threats
      if (flags.security || flags.detailed) {
        await this.displaySecurityThreats(healthData, flags)
      }

      // Display actionable recommendations
      await this.displayActionableRecommendations(healthData, flags)

      // Export health report if requested
      if (flags.export) {
        await this.exportHealthReport(healthData, flags.name)
      }

      return true
    } catch (err) {
      console.error('Error analyzing wallet health:', err.message)
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

  // Analyze comprehensive wallet health
  async analyzeWalletHealth (walletName) {
    try {
      // Load wallet with analytics
      const xecWallet = await loadWalletWithAnalytics(walletName)

      // Get comprehensive health data with error handling
      let healthReport, classifications, securityThreats, balance

      try {
        healthReport = xecWallet.utxos.getWalletHealthReport()
      } catch (err) {
        console.warn('Warning: Could not get wallet health report:', err.message)
        healthReport = { overallHealth: 'unknown', metrics: {}, alerts: [], recommendations: [], summary: {} }
      }

      try {
        classifications = xecWallet.utxos.getUtxoClassifications()
      } catch (err) {
        console.warn('Warning: Could not get UTXO classifications:', err.message)
        classifications = { byAge: {}, byValue: {}, statistics: {} }
      }

      try {
        securityThreats = xecWallet.utxos.detectSecurityThreats(xecWallet.walletInfo.xecAddress)
      } catch (err) {
        console.warn('Warning: Could not detect security threats:', err.message)
        securityThreats = { dustAttack: { detected: false, confidence: 0 }, riskLevel: 'low' }
      }

      try {
        balance = await xecWallet.getDetailedBalance()
      } catch (err) {
        console.warn('Warning: Could not get detailed balance:', err.message)
        balance = { total: 0, confirmed: 0, unconfirmed: 0 }
      }

      const recommendations = healthReport.recommendations || []

      // Get UTXO-level health data with token-aware classification
      const utxoHealthDetails = []
      const tokenAwareMetrics = {
        totalUtxos: 0,
        healthyUtxos: 0,
        pureDustUtxos: 0,
        tokenUtxos: 0,
        suspiciousUtxos: 0,
        tokenPortfolio: {
          uniqueTokens: 0,
          mintBatons: 0
        }
      }

      try {
        if (xecWallet.utxos.utxoStore && xecWallet.utxos.utxoStore.xecUtxos) {
          const utxos = xecWallet.utxos.utxoStore.xecUtxos

          for (const utxo of utxos.slice(0, 50)) { // Limit to first 50 for performance
            try {
              // Skip analytics calls that might be failing and do direct classification
              let utxoHealth = { status: 'healthy', score: 85, issues: [] }
              let utxoClassification = { category: 'unknown', confidence: 0.5 }

              try {
                utxoHealth = xecWallet.utxos.analytics.healthMonitor.assessUtxoHealth(utxo)
                utxoClassification = xecWallet.utxos.analytics.classifier.classifyUtxo(utxo)
              } catch (analyticsErr) {
                // Analytics not available, use defaults
              }

              // Apply token-aware enhancement - this is our custom logic
              const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, utxoClassification)

              utxoHealthDetails.push({
                ...utxo,
                health: utxoHealth,
                classification: utxoClassification,
                enhancedClassification,
                // Add convenience fields
                utxoType: enhancedClassification.utxoType,
                hasToken: enhancedClassification.hasToken,
                isPureDust: enhancedClassification.isPureDust
              })

              // Update token-aware metrics
              tokenAwareMetrics.totalUtxos++
              if (enhancedClassification.hasToken) {
                tokenAwareMetrics.tokenUtxos++
                if (enhancedClassification.utxoType === 'mint-baton') {
                  tokenAwareMetrics.tokenPortfolio.mintBatons++
                }
              } else if (enhancedClassification.isPureDust) {
                tokenAwareMetrics.pureDustUtxos++
              }

              // Count healthy UTXOs (including token UTXOs as healthy)
              if (enhancedClassification.health?.status === 'healthy' || enhancedClassification.hasToken) {
                tokenAwareMetrics.healthyUtxos++
              } else if (enhancedClassification.health?.status === 'suspicious') {
                tokenAwareMetrics.suspiciousUtxos++
              }
            } catch (err) {
              // Skip UTXOs that can't be analyzed
              continue
            }
          }

          // Calculate unique tokens
          const tokenIds = new Set()
          utxoHealthDetails
            .filter(item => item.hasToken)
            .forEach(item => {
              const tokenId = item.enhancedClassification?.tokenInfo?.tokenId ||
                            item.utxo.token?.tokenId
              if (tokenId) {
                tokenIds.add(tokenId)
              }
            })
          tokenAwareMetrics.tokenPortfolio.uniqueTokens = tokenIds.size
        }
      } catch (err) {
        console.warn(`Warning: Could not get detailed UTXO health data: ${err.message}`)
      }

      return {
        walletName,
        address: xecWallet.walletInfo.xecAddress,
        balance,
        healthReport,
        classifications,
        securityThreats,
        recommendations,
        utxoHealthDetails,
        tokenAwareMetrics,
        analysisTime: new Date().toISOString()
      }
    } catch (err) {
      throw new Error(`Failed to analyze wallet health: ${err.message}`)
    }
  }

  // Display main health dashboard
  async displayHealthDashboard (healthData, flags) {
    try {
      const { walletName, address, balance, healthReport, tokenAwareMetrics } = healthData

      console.log('WALLET HEALTH DASHBOARD')
      console.log('='.repeat(60))
      console.log(`Wallet: ${walletName}`)
      console.log(`Address: ${address}`)
      console.log(`Analysis Time: ${new Date(healthData.analysisTime).toLocaleString()}`)
      console.log()

      // Overall health status - check multiple possible locations
      const overallHealth = healthReport.overallHealth || healthReport.overallHealthScore || healthReport.summary?.overallHealth
      const healthScore = this.formatHealthScore(overallHealth)
      console.log(`Overall Health: ${healthScore}`)

      // Risk level may be in different locations
      const riskLevel = healthReport.riskLevel || healthReport.summary?.riskLevel || 'low'
      if (riskLevel && riskLevel !== 'low') {
        console.log(`Risk Level: ${this.formatRiskLevel(riskLevel)}`)
      }

      console.log()

      // Key metrics - use token-aware metrics instead of potentially misleading old metrics
      console.log('Key Health Metrics:')
      console.log('-'.repeat(30))
      console.log(`   Total UTXOs: ${tokenAwareMetrics?.totalUtxos || healthReport.metrics?.totalUtxos || 'N/A'}`)
      console.log(`   Healthy UTXOs: ${tokenAwareMetrics?.healthyUtxos || healthReport.metrics?.healthyUtxos || 0} [HEALTHY]`)

      // Show token UTXOs as valuable, not problematic
      if (tokenAwareMetrics?.tokenUtxos > 0) {
        console.log(`   Token UTXOs: ${tokenAwareMetrics.tokenUtxos} [TOKEN]`)
      }

      // Only show pure dust (excluding token UTXOs)
      if (tokenAwareMetrics?.pureDustUtxos > 0) {
        console.log(`   Pure Dust UTXOs: ${tokenAwareMetrics.pureDustUtxos} [DUST-WARNING]`)
      }

      if (tokenAwareMetrics?.suspiciousUtxos > 0) {
        console.log(`   Suspicious UTXOs: ${tokenAwareMetrics.suspiciousUtxos} [SUSPICIOUS-ALERT]`)
      }

      if ((healthReport.metrics?.unconfirmedUtxos || healthReport.summary?.unconfirmed || 0) > 0) {
        const unconfirmed = healthReport.metrics?.unconfirmedUtxos || healthReport.summary?.unconfirmed || 0
        console.log(`   Unconfirmed UTXOs: ${unconfirmed}`)
      }

      // Token portfolio summary if tokens present
      if (tokenAwareMetrics?.tokenPortfolio?.uniqueTokens > 0) {
        console.log()
        console.log('Token Portfolio Health:')
        console.log('-'.repeat(30))
        console.log(`   Unique Tokens: ${tokenAwareMetrics.tokenPortfolio.uniqueTokens}`)
        if (tokenAwareMetrics.tokenPortfolio.mintBatons > 0) {
          console.log(`   Mint Batons: ${tokenAwareMetrics.tokenPortfolio.mintBatons} [MINT-BATON]`)
        }
      }

      // Balance health
      console.log()
      console.log('Balance Health:')
      console.log('-'.repeat(30))
      console.log(`   Total Balance: ${balance.total.toLocaleString()} XEC`)

      // Calculate available balance for fees (token UTXOs are locked at 546 satoshis each)
      const tokenXecLocked = (tokenAwareMetrics?.tokenUtxos || 0) * 5.46 // 546 sats = 5.46 XEC
      const availableForFees = balance.confirmed - tokenXecLocked
      console.log(`   Available for Fees: ${Math.max(0, availableForFees).toLocaleString()} XEC`)

      if (tokenXecLocked > 0) {
        console.log(`   XEC in Token UTXOs: ${tokenXecLocked.toLocaleString()} XEC (${tokenAwareMetrics.tokenUtxos} UTXOs)`)
      }

      // Display liquidity ratio from summary if available
      if (healthReport.summary?.spendablePercentage !== undefined) {
        console.log(`   Spendable Ratio: ${healthReport.summary.spendablePercentage.toFixed(1)}%`)
      }

      // Critical alerts
      if (healthReport.alerts && healthReport.alerts.length > 0) {
        const criticalAlerts = healthReport.alerts.filter(alert =>
          alert.severity === 'critical' || alert.severity === 'high'
        )

        if (criticalAlerts.length > 0) {
          console.log()
          console.log('CRITICAL ALERTS:')
          console.log('-'.repeat(30))
          criticalAlerts.slice(0, 3).forEach((alert, i) => {
            console.log(`   ${i + 1}. ${alert.severity.toUpperCase()}: ${alert.message}`)
          })
        }
      }

      return true
    } catch (err) {
      console.error('Error displaying health dashboard:', err.message)
      return false
    }
  }

  // Display detailed health analysis
  async displayDetailedHealthAnalysis (healthData, flags) {
    try {
      const { healthReport, classifications, utxoHealthDetails } = healthData

      console.log()
      console.log('DETAILED HEALTH ANALYSIS')
      console.log('='.repeat(60))

      // UTXO Classification Health
      if (classifications) {
        console.log()
        console.log('UTXO Health by Classification:')
        console.log('-'.repeat(40))

        // Age distribution health
        if (classifications.byAge) {
          console.log('   Age Distribution:')
          Object.entries(classifications.byAge).forEach(([age, count]) => {
            if (count > 0) {
              const healthIndicator = this.getAgeHealthIndicator(age)
              console.log(`     ${age}: ${count} ${healthIndicator}`)
            }
          })
        }

        // Value distribution health - Use token-aware classification
        console.log('   Value Distribution:')

        // Get token-aware value distribution from healthData
        const valueDistribution = this.getTokenAwareValueDistribution(healthData)

        Object.entries(valueDistribution).forEach(([value, count]) => {
          if (count > 0) {
            const healthIndicator = this.getValueHealthIndicator(value)
            console.log(`     ${value}: ${count} ${healthIndicator}`)
          }
        })
      }

      // Individual UTXO health (top issues)
      if (utxoHealthDetails && utxoHealthDetails.length > 0) {
        console.log()
        console.log('Individual UTXO Health Issues:')
        console.log('-'.repeat(40))

        const problematicUtxos = utxoHealthDetails
          .filter(utxo => utxo.health && utxo.health.status !== 'healthy')
          .sort((a, b) => (a.health.score || 0) - (b.health.score || 0))
          .slice(0, 10)

        if (problematicUtxos.length > 0) {
          problematicUtxos.forEach((utxo, i) => {
            const txid = utxo.outpoint?.txid || utxo.txid || 'unknown'
            const amount = (utxo.sats || utxo.value || 0) / 100
            console.log(`   ${i + 1}. ${txid.slice(0, 8)}... - ${amount} XEC - ${utxo.health.status.toUpperCase()}`)
            if (utxo.health.issues && utxo.health.issues.length > 0) {
              console.log(`      Issues: ${utxo.health.issues.join(', ')}`)
            }
          })
        } else {
          console.log('   No significant UTXO health issues detected')
        }
      }

      // Health trends (if available)
      if (healthReport.healthHistory && healthReport.healthHistory.length > 0) {
        console.log()
        console.log('Health Trends:')
        console.log('-'.repeat(40))

        const recentHistory = healthReport.healthHistory.slice(-5)
        recentHistory.forEach((entry, i) => {
          const date = new Date(entry.timestamp).toLocaleDateString()
          console.log(`   ${date}: ${this.formatHealthScore(entry.overallHealth)}`)
        })
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display detailed health analysis:', err.message)
      return false
    }
  }

  // Display dust attack analysis
  async displayDustAttackAnalysis (healthData, flags) {
    try {
      const { securityThreats } = healthData

      console.log()
      console.log('DUST ATTACK ANALYSIS')
      console.log('='.repeat(60))

      // Check for dust attack data in multiple possible locations
      const dustAttack = securityThreats.dustAttack || securityThreats.dustAttackRisk

      if (dustAttack !== undefined) {
        let riskScore = 0
        let detected = false

        if (typeof dustAttack === 'object') {
          detected = dustAttack.detected || false
          riskScore = dustAttack.confidence || 0
        } else if (typeof dustAttack === 'number') {
          riskScore = dustAttack * 100
          detected = riskScore > 30
        }

        const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW'

        console.log(`Dust Attack Risk Level: ${riskLevel}`)
        console.log(`Risk Score: ${riskScore.toFixed(1)}%`)
        console.log(`Detection Status: ${detected ? 'DETECTED' : 'None detected'}`)
        console.log()

        if (riskScore > 50) {
          console.log('WARNING: High dust attack risk detected!')
          console.log('This wallet may be under attack or have been targeted.')
          console.log()
        }

        // Dust attack indicators
        if (securityThreats.dustAttackIndicators) {
          console.log('Dust Attack Indicators:')
          console.log('-'.repeat(30))

          const indicators = securityThreats.dustAttackIndicators
          if (indicators.suspiciousDustUtxos > 0) {
            console.log(`   Suspicious dust UTXOs: ${indicators.suspiciousDustUtxos}`)
          }
          if (indicators.rapidSmallDeposits > 0) {
            console.log(`   Rapid small deposits: ${indicators.rapidSmallDeposits}`)
          }
          if (indicators.roundNumberAmounts > 0) {
            console.log(`   Round number amounts: ${indicators.roundNumberAmounts}`)
          }
          if (indicators.identicalAmounts > 0) {
            console.log(`   Identical amounts: ${indicators.identicalAmounts}`)
          }
        }

        // Defense recommendations
        if (securityThreats.dustAttackRisk > 0.3) {
          console.log()
          console.log('Dust Attack Defense Recommendations:')
          console.log('-'.repeat(45))
          console.log('   1. DO NOT spend dust UTXOs (< 1000 satoshis)')
          console.log('   2. Use coin control to avoid suspicious UTXOs')
          console.log('   3. Consider using a new address for future receives')
          console.log('   4. Enable privacy-focused coin selection')
          console.log('   5. Monitor wallet for unusual small deposits')
        }
      } else {
        console.log('Dust attack analysis not available')
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display dust attack analysis:', err.message)
      return false
    }
  }

  // Display security threats
  async displaySecurityThreats (healthData, flags) {
    try {
      const { securityThreats, classifications } = healthData

      console.log()
      console.log('SECURITY THREAT ANALYSIS')
      console.log('='.repeat(60))

      // Privacy analysis - check multiple locations for privacy data
      let privacyScore = securityThreats.privacyScore
      if (privacyScore === undefined && classifications?.statistics) {
        privacyScore = classifications.statistics.averagePrivacyScore
      }

      if (privacyScore !== undefined) {
        console.log(`Privacy Score: ${privacyScore.toFixed(1)}/100`)

        if (privacyScore < 30) {
          console.log('   STATUS: POOR PRIVACY - High linkability risk')
        } else if (privacyScore < 60) {
          console.log('   STATUS: MODERATE PRIVACY - Some privacy concerns')
        } else {
          console.log('   STATUS: GOOD PRIVACY - Well protected')
        }
        console.log()
      }

      // Suspicious patterns
      if (securityThreats.suspiciousPatterns && securityThreats.suspiciousPatterns.length > 0) {
        console.log('Suspicious Patterns Detected:')
        console.log('-'.repeat(35))

        securityThreats.suspiciousPatterns.forEach((pattern, i) => {
          console.log(`   ${i + 1}. ${pattern.type.toUpperCase()}: ${pattern.description}`)
          if (pattern.confidence) {
            console.log(`      Confidence: ${(pattern.confidence * 100).toFixed(1)}%`)
          }
          if (pattern.recommendation) {
            console.log(`      Recommendation: ${pattern.recommendation}`)
          }
        })
        console.log()
      }

      // Tracking risks
      if (securityThreats.trackingRisks) {
        console.log('Address Tracking Risks:')
        console.log('-'.repeat(25))

        const risks = securityThreats.trackingRisks
        if (risks.addressReuse > 0) {
          console.log(`   Address reuse detected: ${risks.addressReuse} times`)
        }
        if (risks.transactionLinking > 0.3) {
          console.log(`   Transaction linking risk: ${(risks.transactionLinking * 100).toFixed(1)}%`)
        }
        if (risks.behavioralFingerprints && risks.behavioralFingerprints.length > 0) {
          console.log(`   Behavioral fingerprints: ${risks.behavioralFingerprints.join(', ')}`)
        }
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display security threats:', err.message)
      return false
    }
  }

  // Display actionable recommendations
  async displayActionableRecommendations (healthData, flags) {
    try {
      const { recommendations } = healthData

      console.log()
      console.log('ACTIONABLE RECOMMENDATIONS')
      console.log('='.repeat(60))

      if (!recommendations || recommendations.length === 0) {
        console.log('No specific recommendations at this time.')
        console.log('Your wallet appears to be in good health!')
        return true
      }

      // Prioritize recommendations
      const prioritizedRecs = recommendations
        .sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
        })

      console.log('Recommended Actions (by priority):')
      console.log('-'.repeat(40))

      prioritizedRecs.slice(0, 10).forEach((rec, i) => {
        const priorityIndicator = this.getPriorityIndicator(rec.priority)
        console.log(`   ${i + 1}. ${priorityIndicator} ${rec.message}`)

        if (rec.potentialSavings) {
          console.log(`      Potential savings: ${rec.potentialSavings} satoshis`)
        }

        if (rec.action) {
          console.log(`      Action: ${rec.action}`)
        }

        if (rec.command) {
          console.log(`      Command: ${rec.command}`)
        }

        console.log()
      })

      if (recommendations.length > 10) {
        console.log(`   ... and ${recommendations.length - 10} more recommendations`)
        console.log('   Use --detailed flag to see all recommendations')
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display recommendations:', err.message)
      return false
    }
  }

  // Format health score for display
  formatHealthScore (health) {
    if (typeof health === 'number') {
      if (health >= 80) return `EXCELLENT (${health})`
      if (health >= 60) return `GOOD (${health})`
      if (health >= 40) return `FAIR (${health})`
      if (health >= 20) return `POOR (${health})`
      return `CRITICAL (${health})`
    }

    if (typeof health === 'string') {
      switch (health.toLowerCase()) {
        case 'healthy': return 'HEALTHY'
        case 'at-risk':
        case 'at_risk': return 'AT RISK'
        case 'unhealthy': return 'UNHEALTHY'
        case 'critical': return 'CRITICAL'
        default: return health.toUpperCase()
      }
    }

    return 'UNKNOWN'
  }

  // Format risk level for display
  formatRiskLevel (riskLevel) {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'LOW'
      case 'medium': return 'MEDIUM'
      case 'high': return 'HIGH'
      case 'critical': return 'CRITICAL'
      default: return riskLevel.toUpperCase()
    }
  }

  // Get health indicator for age classification
  getAgeHealthIndicator (age) {
    switch (age.toLowerCase()) {
      case 'unconfirmed': return '(WATCH)'
      case 'fresh': return '(NORMAL)'
      case 'recent': return '(GOOD)'
      case 'mature': return '(EXCELLENT)'
      case 'aged': return '(EXCELLENT)'
      case 'ancient': return '(STABLE)'
      default: return ''
    }
  }

  // Get health indicator for value classification
  getValueHealthIndicator (value) {
    switch (value.toLowerCase()) {
      case 'token-utxos': return '(TOKEN VALUE - Contains tokens)'
      case 'pure-dust': return '(WARNING - Uneconomical dust)'
      case 'dust': return '(WARNING - Uneconomical)' // Fallback for legacy
      case 'micro': return '(CAUTION - Low value)'
      case 'small': return '(NORMAL)'
      case 'medium': return '(GOOD)'
      case 'large': return '(EXCELLENT)'
      case 'whale': return '(HIGH VALUE)'
      default: return ''
    }
  }

  // Get priority indicator
  getPriorityIndicator (priority) {
    switch (priority?.toLowerCase()) {
      case 'critical': return '[CRITICAL]'
      case 'high': return '[HIGH]'
      case 'medium': return '[MEDIUM]'
      case 'low': return '[LOW]'
      default: return '[INFO]'
    }
  }

  // Get token-aware value distribution
  getTokenAwareValueDistribution (healthData) {
    const { tokenAwareMetrics, utxoHealthDetails } = healthData
    const distribution = {}

    // Count token UTXOs separately from pure dust
    if (tokenAwareMetrics?.tokenUtxos > 0) {
      distribution['token-utxos'] = tokenAwareMetrics.tokenUtxos
    }

    // Count pure dust (non-token dust)
    if (tokenAwareMetrics?.pureDustUtxos > 0) {
      distribution['pure-dust'] = tokenAwareMetrics.pureDustUtxos
    }

    // Count other value categories by examining individual UTXOs
    if (utxoHealthDetails && utxoHealthDetails.length > 0) {
      const valueCounts = {}

      for (const utxo of utxoHealthDetails) {
        // Skip if it's already classified as token or pure dust
        if (utxo.hasToken || utxo.isPureDust) {
          continue
        }

        // Classify by XEC value
        const xecValue = (utxo.sats || utxo.value || 0) / 100
        let valueCategory

        if (xecValue < 0.1) {
          valueCategory = 'micro'
        } else if (xecValue < 10) {
          valueCategory = 'small'
        } else if (xecValue < 1000) {
          valueCategory = 'medium'
        } else if (xecValue < 100000) {
          valueCategory = 'large'
        } else {
          valueCategory = 'whale'
        }

        valueCounts[valueCategory] = (valueCounts[valueCategory] || 0) + 1
      }

      // Add non-zero value categories to distribution
      Object.entries(valueCounts).forEach(([category, count]) => {
        if (count > 0) {
          distribution[category] = count
        }
      })
    }

    return distribution
  }

  // Export health report to file
  async exportHealthReport (healthData, walletName) {
    try {
      const reportData = {
        wallet: walletName,
        generatedAt: new Date().toISOString(),
        healthSummary: {
          overallHealth: healthData.healthReport.overallHealth,
          riskLevel: healthData.healthReport.riskLevel,
          totalUtxos: healthData.healthReport.totalUtxos,
          healthyUtxos: healthData.healthReport.healthyUtxos,
          dustUtxos: healthData.healthReport.dustUtxos,
          suspiciousUtxos: healthData.healthReport.suspiciousUtxos
        },
        detailedAnalysis: {
          healthReport: healthData.healthReport,
          classifications: healthData.classifications,
          securityThreats: healthData.securityThreats,
          recommendations: healthData.recommendations
        }
      }

      const fileName = `${walletName}-health-report-${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(process.cwd(), fileName)

      await this.walletUtil.fs.writeFile(filePath, JSON.stringify(reportData, null, 2))

      console.log()
      console.log(`Health report exported to: ${fileName}`)

      return true
    } catch (err) {
      console.error('Warning: Could not export health report:', err.message)
      return false
    }
  }
}

export default WalletHealth
