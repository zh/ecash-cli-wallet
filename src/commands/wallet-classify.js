/*
  Detailed UTXO classification analysis and filtering.
*/

// Global npm libraries
import path from 'path'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import ConfigManager from '../lib/config-manager.js'
import { loadWalletWithAnalytics } from '../lib/wallet-loader.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class WalletClassify {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.configManager = new ConfigManager()
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.analyzeClassifications = this.analyzeClassifications.bind(this)
    this.displayClassificationOverview = this.displayClassificationOverview.bind(this)
    this.displayDetailedClassifications = this.displayDetailedClassifications.bind(this)
    this.displayFilteredView = this.displayFilteredView.bind(this)
    this.displayUtxoDetails = this.displayUtxoDetails.bind(this)
    this.filterUtxosByClassification = this.filterUtxosByClassification.bind(this)
    this.formatUtxoInfo = this.formatUtxoInfo.bind(this)
    this.exportClassificationData = this.exportClassificationData.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Analyzing UTXO classifications for wallet '${flags.name}'...\n`)

      // Check if analytics are available
      const analyticsEnabled = await this.walletUtil.isWalletAnalyticsEnabled(flags.name)
      if (!analyticsEnabled) {
        console.log('Analytics are disabled for this wallet.')
        console.log('Enable analytics to use UTXO classification:')
        console.log('   node xec-wallet.js config-set analytics.enabled true')
        return false
      }

      // Analyze classifications
      const classificationData = await this.analyzeClassifications(flags.name)

      // Display classification overview
      await this.displayClassificationOverview(classificationData, flags)

      // Display detailed classifications if requested
      if (flags.detailed) {
        await this.displayDetailedClassifications(classificationData, flags)
      }

      // Display filtered view if filter specified
      if (flags.filter) {
        await this.displayFilteredView(classificationData, flags)
      }

      // Display individual UTXO details if requested
      if (flags.utxos) {
        await this.displayUtxoDetails(classificationData, flags)
      }

      // Export classification data if requested
      if (flags.export) {
        await this.exportClassificationData(classificationData, flags.name)
      }

      return true
    } catch (err) {
      console.error('Error analyzing classifications:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Validate filter options if provided
    if (flags.filter) {
      const validFilters = [
        'dust', 'micro', 'small', 'medium', 'large', 'whale',
        'fresh', 'recent', 'mature', 'aged', 'ancient', 'unconfirmed',
        'healthy', 'at-risk', 'suspicious', 'stuck'
      ]

      const filterTerms = flags.filter.split(',').map(term => term.trim().toLowerCase())
      for (const term of filterTerms) {
        if (!validFilters.includes(term)) {
          throw new Error(`Invalid filter term '${term}'. Valid filters: ${validFilters.join(', ')}`)
        }
      }
    }

    return true
  }

  // Analyze wallet UTXO classifications
  async analyzeClassifications (walletName) {
    try {
      // Load wallet with analytics
      const xecWallet = await loadWalletWithAnalytics(walletName)

      // Get classification data
      const classifications = xecWallet.utxos.getUtxoClassifications()
      const classificationStats = xecWallet.utxos.getClassificationStats()
      const healthReport = xecWallet.utxos.getWalletHealthReport()
      const balance = await xecWallet.getDetailedBalance()

      // Get individual UTXO classifications with token-aware enhancement
      const utxoDetails = []
      const tokenAwareClassificationStats = {
        totalUtxos: 0,
        byType: {},
        byCategory: {},
        tokenPortfolio: {
          uniqueTokens: 0,
          mintBatons: 0,
          tokenUtxos: 0
        },
        dustAnalysis: {
          pureDust: 0,
          tokenDust: 0 // Token UTXOs that would be classified as dust without token awareness
        }
      }

      try {
        if (xecWallet.utxos.utxoStore && xecWallet.utxos.utxoStore.xecUtxos) {
          const utxos = xecWallet.utxos.utxoStore.xecUtxos
          for (const utxo of utxos) {
            try {
              // Get original classification for individual UTXO
              const utxoClassification = xecWallet.utxos.analytics.classifier.classifyUtxo(utxo)

              // Apply token-aware enhancement
              const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, utxoClassification)

              utxoDetails.push({
                ...utxo,
                classification: utxoClassification, // Keep original for compatibility
                enhancedClassification, // Add token-aware version
                // Convenience fields
                utxoType: enhancedClassification.utxoType,
                hasToken: enhancedClassification.hasToken,
                isPureDust: enhancedClassification.isPureDust
              })

              // Update token-aware statistics
              tokenAwareClassificationStats.totalUtxos++

              // Count by UTXO type
              const utxoType = enhancedClassification.utxoType
              tokenAwareClassificationStats.byType[utxoType] =
                (tokenAwareClassificationStats.byType[utxoType] || 0) + 1

              // Count by category
              const category = enhancedClassification.display?.category || 'unknown'
              tokenAwareClassificationStats.byCategory[category] =
                (tokenAwareClassificationStats.byCategory[category] || 0) + 1

              // Token portfolio analysis
              if (enhancedClassification.hasToken) {
                tokenAwareClassificationStats.tokenPortfolio.tokenUtxos++
                if (enhancedClassification.utxoType === 'mint-baton') {
                  tokenAwareClassificationStats.tokenPortfolio.mintBatons++
                }
              }

              // Dust analysis - distinguish pure dust vs token UTXOs
              if (enhancedClassification.isPureDust) {
                tokenAwareClassificationStats.dustAnalysis.pureDust++
              } else if (enhancedClassification.hasToken && utxo.value <= 546) {
                // Token UTXOs that would be misclassified as dust without token awareness
                tokenAwareClassificationStats.dustAnalysis.tokenDust++
              }
            } catch (err) {
              // Skip UTXOs that can't be classified
              continue
            }
          }

          // Calculate unique tokens
          const tokenIds = new Set()
          utxoDetails
            .filter(item => item.hasToken)
            .forEach(item => {
              const tokenId = item.enhancedClassification?.tokenInfo?.tokenId ||
                            item.utxo.token?.tokenId
              if (tokenId) {
                tokenIds.add(tokenId)
              }
            })
          tokenAwareClassificationStats.tokenPortfolio.uniqueTokens = tokenIds.size
        }
      } catch (err) {
        console.warn('Warning: Could not get detailed UTXO classifications')
      }

      return {
        walletName,
        address: xecWallet.walletInfo.xecAddress,
        balance,
        classifications,
        classificationStats,
        healthReport,
        utxoDetails,
        tokenAwareClassificationStats,
        analysisTime: new Date().toISOString()
      }
    } catch (err) {
      throw new Error(`Failed to analyze classifications: ${err.message}`)
    }
  }

  // Display classification overview
  async displayClassificationOverview (classificationData, flags) {
    try {
      const { walletName, address, balance, classifications, classificationStats, tokenAwareClassificationStats } = classificationData

      console.log('UTXO CLASSIFICATION OVERVIEW')
      console.log('='.repeat(60))
      console.log(`Wallet: ${walletName}`)
      console.log(`Address: ${address}`)
      console.log(`Total Balance: ${balance.total.toLocaleString()} XEC`)
      console.log(`Analysis Time: ${new Date(classificationData.analysisTime).toLocaleString()}`)
      console.log()

      // Classification summary
      if (classificationStats && classificationStats.total > 0) {
        console.log('Classification Summary:')
        console.log('-'.repeat(30))
        console.log(`   Total UTXOs Analyzed: ${classificationStats.total}`)
        console.log(`   Total Value: ${(classificationStats.totalValue / 100).toLocaleString()} XEC`)
        console.log(`   Average Age Score: ${classificationStats.averageAgeScore?.toFixed(1) || 'N/A'}`)
        console.log(`   Average Value Score: ${classificationStats.averageValueScore?.toFixed(1) || 'N/A'}`)
        console.log(`   Average Privacy Score: ${classificationStats.averagePrivacyScore?.toFixed(1) || 'N/A'}/100`)
        console.log()
      }

      // Age classifications
      if (classifications.byAge) {
        console.log('Classification by Age:')
        console.log('-'.repeat(25))
        Object.entries(classifications.byAge).forEach(([age, count]) => {
          if (count > 0) {
            const percentage = classificationStats.total > 0 ? (count / classificationStats.total * 100).toFixed(1) : '0.0'
            console.log(`   ${age.padEnd(12)}: ${count.toString().padStart(3)} (${percentage}%)`)
          }
        })
        console.log()
      }

      // Value classifications
      if (classifications.byValue) {
        console.log('Classification by Value:')
        console.log('-'.repeat(26))
        Object.entries(classifications.byValue).forEach(([value, count]) => {
          if (count > 0) {
            const percentage = classificationStats.total > 0 ? (count / classificationStats.total * 100).toFixed(1) : '0.0'
            const valueRange = this.getValueRange(value)
            console.log(`   ${value.padEnd(12)}: ${count.toString().padStart(3)} (${percentage}%) ${valueRange}`)
          }
        })
        console.log()
      }

      // Privacy classifications
      if (classifications.byPrivacy) {
        console.log('Classification by Privacy:')
        console.log('-'.repeat(28))
        Object.entries(classifications.byPrivacy).forEach(([privacy, count]) => {
          if (count > 0) {
            const percentage = classificationStats.total > 0 ? (count / classificationStats.total * 100).toFixed(1) : '0.0'
            console.log(`   ${privacy.padEnd(12)}: ${count.toString().padStart(3)} (${percentage}%)`)
          }
        })
        console.log()
      }

      // Token-Aware Classification (Enhanced Analysis)
      if (tokenAwareClassificationStats && tokenAwareClassificationStats.totalUtxos > 0) {
        console.log('TOKEN-AWARE CLASSIFICATION')
        console.log('-'.repeat(40))

        // UTXO Type classification
        console.log('Classification by UTXO Type:')
        console.log('-'.repeat(30))
        Object.entries(tokenAwareClassificationStats.byType).forEach(([type, count]) => {
          if (count > 0) {
            const percentage = (count / tokenAwareClassificationStats.totalUtxos * 100).toFixed(1)
            const icon = this.getUtxoTypeIcon(type)
            console.log(`   ${type.padEnd(15)}: ${count.toString().padStart(3)} (${percentage}%) ${icon}`)
          }
        })
        console.log()

        // Category classification
        console.log('Classification by Category:')
        console.log('-'.repeat(29))
        Object.entries(tokenAwareClassificationStats.byCategory).forEach(([category, count]) => {
          if (count > 0) {
            const percentage = (count / tokenAwareClassificationStats.totalUtxos * 100).toFixed(1)
            console.log(`   ${category.padEnd(12)}: ${count.toString().padStart(3)} (${percentage}%)`)
          }
        })
        console.log()

        // Token Portfolio Analysis (if tokens present)
        if (tokenAwareClassificationStats.tokenPortfolio.tokenUtxos > 0) {
          console.log('Token Portfolio Analysis:')
          console.log('-'.repeat(29))
          console.log(`   Token UTXOs     : ${tokenAwareClassificationStats.tokenPortfolio.tokenUtxos} [TOKEN]`)
          console.log(`   Unique Tokens   : ${tokenAwareClassificationStats.tokenPortfolio.uniqueTokens}`)
          if (tokenAwareClassificationStats.tokenPortfolio.mintBatons > 0) {
            console.log(`   Mint Batons     : ${tokenAwareClassificationStats.tokenPortfolio.mintBatons} [MINT-BATON]`)
          }
          console.log()
        }

        // Dust Analysis (Critical Fix)
        console.log('Enhanced Dust Analysis:')
        console.log('-'.repeat(27))
        console.log(`   Pure Dust UTXOs: ${tokenAwareClassificationStats.dustAnalysis.pureDust} [DUST]`)
        if (tokenAwareClassificationStats.dustAnalysis.tokenDust > 0) {
          console.log(`   Token UTXOs     : ${tokenAwareClassificationStats.dustAnalysis.tokenDust} [VALUABLE - Previously misclassified as dust]`)
        }
        console.log(`   
   NOTE: Token UTXOs contain 546 satoshis + valuable token data.
         They are NOT dust, but valuable assets!`)
        console.log()
      }

      return true
    } catch (err) {
      console.error('Error displaying classification overview:', err.message)
      return false
    }
  }

  // Helper method to get icons for UTXO types
  getUtxoTypeIcon (utxoType) {
    const typeIcons = {
      'token-utxo': '[TOKEN]',
      'mint-baton': '[MINT-BATON]',
      'pure-dust': '[DUST]',
      'token-change': '[CHANGE]',
      'large-utxo': '[LARGE]',
      'standard-utxo': '[STANDARD]'
    }
    return typeIcons[utxoType] || '[UNKNOWN]'
  }

  // Display detailed classifications with insights
  async displayDetailedClassifications (classificationData, flags) {
    try {
      const { utxoDetails } = classificationData

      console.log('DETAILED CLASSIFICATION ANALYSIS')
      console.log('='.repeat(60))

      // Cross-classification analysis
      console.log()
      console.log('Cross-Classification Insights:')
      console.log('-'.repeat(35))

      // Find interesting patterns
      const patterns = this.analyzeClassificationPatterns(utxoDetails)

      if (patterns.oldDustUtxos > 0) {
        console.log(`   Old dust UTXOs: ${patterns.oldDustUtxos} (likely unspendable)`)
      }

      if (patterns.freshLargeUtxos > 0) {
        console.log(`   Fresh large UTXOs: ${patterns.freshLargeUtxos} (recent significant deposits)`)
      }

      if (patterns.ancientSmallUtxos > 0) {
        console.log(`   Ancient small UTXOs: ${patterns.ancientSmallUtxos} (potential change outputs)`)
      }

      if (patterns.unconfirmedUtxos > 0) {
        console.log(`   Unconfirmed UTXOs: ${patterns.unconfirmedUtxos} (pending transactions)`)
      }

      if (patterns.roundNumberUtxos > 0) {
        console.log(`   Round number amounts: ${patterns.roundNumberUtxos} (privacy concern)`)
      }

      if (patterns.suspiciousUtxos > 0) {
        console.log(`   Suspicious UTXOs: ${patterns.suspiciousUtxos} (requires attention)`)
      }

      // Value distribution analysis
      console.log()
      console.log('Value Distribution Analysis:')
      console.log('-'.repeat(32))

      const valueStats = this.calculateValueDistributionStats(utxoDetails)
      console.log(`   Economic UTXOs: ${valueStats.economical} (worth spending)`)
      console.log(`   Marginal UTXOs: ${valueStats.marginal} (borderline economical)`)
      console.log(`   Dust UTXOs: ${valueStats.dust} (uneconomical to spend)`)
      console.log(`   Total Value in Dust: ${(valueStats.dustValue / 100).toLocaleString()} XEC`)

      // Age distribution analysis
      console.log()
      console.log('Age Distribution Analysis:')
      console.log('-'.repeat(30))

      const ageStats = this.calculateAgeDistributionStats(utxoDetails)
      console.log(`   Mature UTXOs (>1 week): ${ageStats.mature}`)
      console.log(`   Recent UTXOs (<1 day): ${ageStats.recent}`)
      console.log(`   Stability Score: ${(ageStats.stabilityScore * 100).toFixed(1)}%`)

      return true
    } catch (err) {
      console.warn('Warning: Could not display detailed classifications:', err.message)
      return false
    }
  }

  // Display filtered view based on user criteria
  async displayFilteredView (classificationData, flags) {
    try {
      const { utxoDetails } = classificationData
      const filterTerms = flags.filter.split(',').map(term => term.trim().toLowerCase())

      console.log()
      console.log(`FILTERED VIEW: ${filterTerms.join(', ').toUpperCase()}`)
      console.log('='.repeat(60))

      const filteredUtxos = this.filterUtxosByClassification(utxoDetails, filterTerms)

      if (filteredUtxos.length === 0) {
        console.log('No UTXOs match the specified filter criteria.')
        return true
      }

      console.log(`Found ${filteredUtxos.length} UTXOs matching filter criteria:`)
      console.log()

      // Display filtered UTXOs
      filteredUtxos.slice(0, 20).forEach((utxo, i) => {
        const info = this.formatUtxoInfo(utxo)
        console.log(`   ${i + 1}. ${info}`)
      })

      if (filteredUtxos.length > 20) {
        console.log(`   ... and ${filteredUtxos.length - 20} more`)
        console.log('   Use --export flag to get complete list')
      }

      // Summary of filtered results
      const totalValue = filteredUtxos.reduce((sum, utxo) => sum + (utxo.sats || utxo.value || 0), 0)
      console.log()
      console.log('Filtered Results Summary:')
      console.log('-'.repeat(25))
      console.log(`   Count: ${filteredUtxos.length}`)
      console.log(`   Total Value: ${(totalValue / 100).toLocaleString()} XEC`)
      console.log(`   Average Value: ${(totalValue / filteredUtxos.length / 100).toFixed(2)} XEC`)

      return true
    } catch (err) {
      console.warn('Warning: Could not display filtered view:', err.message)
      return false
    }
  }

  // Display individual UTXO details
  async displayUtxoDetails (classificationData, flags) {
    try {
      const { utxoDetails } = classificationData

      console.log()
      console.log('INDIVIDUAL UTXO DETAILS')
      console.log('='.repeat(60))

      if (utxoDetails.length === 0) {
        console.log('No UTXO details available.')
        return true
      }

      // Sort by value (largest first) for display
      const sortedUtxos = utxoDetails
        .sort((a, b) => (b.sats || b.value || 0) - (a.sats || a.value || 0))
        .slice(0, 10) // Limit to top 10 for readability

      sortedUtxos.forEach((utxo, i) => {
        const txid = utxo.outpoint?.txid || utxo.txid || 'unknown'
        const outIdx = utxo.outpoint?.outIdx !== undefined ? utxo.outpoint.outIdx : (utxo.outIdx !== undefined ? utxo.outIdx : 0)
        const amount = (utxo.sats || utxo.value || 0) / 100

        console.log(`   ${i + 1}. UTXO: ${txid.slice(0, 16)}...${txid.slice(-8)}:${outIdx}`)
        console.log(`      Value: ${amount.toLocaleString()} XEC`)

        if (utxo.classification) {
          console.log(`      Age: ${utxo.classification.age}`)
          console.log(`      Value Class: ${utxo.classification.value}`)
          console.log(`      Health: ${utxo.classification.health}`)
          console.log(`      Privacy Score: ${utxo.classification.privacyScore?.toFixed(1) || 'N/A'}/100`)

          if (utxo.classification.isRoundNumber) {
            console.log('      WARNING: Round number amount (privacy concern)')
          }

          if (utxo.classification.issues && utxo.classification.issues.length > 0) {
            console.log(`      Issues: ${utxo.classification.issues.join(', ')}`)
          }
        }

        // Enhanced Token-Aware Classification
        if (utxo.enhancedClassification) {
          console.log(`      UTXO Type: ${utxo.enhancedClassification.utxoType} ${this.getUtxoTypeIcon(utxo.enhancedClassification.utxoType)}`)
          console.log(`      Category: ${utxo.enhancedClassification.display?.category || 'unknown'}`)
          console.log(`      Token-Aware Health: ${utxo.enhancedClassification.health?.status || 'unknown'}`)

          if (utxo.enhancedClassification.hasToken && utxo.enhancedClassification.tokenInfo) {
            const token = utxo.enhancedClassification.tokenInfo
            console.log('      TOKEN DATA:')
            console.log(`        Token ID: ${token.tokenId?.slice(0, 16)}...${token.tokenId?.slice(-8)}`)
            console.log(`        Amount: ${token.amount}`)
            if (token.ticker) {
              console.log(`        Ticker: ${token.ticker}`)
            }
            if (token.name) {
              console.log(`        Name: ${token.name}`)
            }
            if (token.isMintBaton) {
              console.log('        Type: MINT BATON [MINT-BATON]')
            }
          }

          if (utxo.enhancedClassification.isPureDust) {
            console.log('      WARNING: This is pure dust (no token data)')
          } else if (utxo.enhancedClassification.hasToken && utxo.value <= 546) {
            console.log('      NOTE: Small XEC amount is normal for token UTXOs')
          }
        }

        console.log()
      })

      if (utxoDetails.length > 10) {
        console.log(`   ... and ${utxoDetails.length - 10} more UTXOs`)
        console.log('   Use --export flag to get complete details')
      }

      return true
    } catch (err) {
      console.warn('Warning: Could not display UTXO details:', err.message)
      return false
    }
  }

  // Filter UTXOs by classification criteria
  filterUtxosByClassification (utxoDetails, filterTerms) {
    return utxoDetails.filter(utxo => {
      if (!utxo.classification) return false

      const classification = utxo.classification

      return filterTerms.some(term => {
        // Check age classifications
        if (classification.age && classification.age.toLowerCase() === term) return true

        // Check value classifications
        if (classification.value && classification.value.toLowerCase() === term) return true

        // Check health classifications
        if (classification.health && classification.health.toLowerCase() === term) return true

        return false
      })
    })
  }

  // Analyze patterns in classifications
  analyzeClassificationPatterns (utxoDetails) {
    const patterns = {
      oldDustUtxos: 0,
      freshLargeUtxos: 0,
      ancientSmallUtxos: 0,
      unconfirmedUtxos: 0,
      roundNumberUtxos: 0,
      suspiciousUtxos: 0
    }

    for (const utxo of utxoDetails) {
      if (!utxo.classification) continue

      const c = utxo.classification

      // Old dust UTXOs
      if ((c.age === 'aged' || c.age === 'ancient') && c.value === 'dust') {
        patterns.oldDustUtxos++
      }

      // Fresh large UTXOs
      if (c.age === 'fresh' && (c.value === 'large' || c.value === 'whale')) {
        patterns.freshLargeUtxos++
      }

      // Ancient small UTXOs
      if (c.age === 'ancient' && (c.value === 'micro' || c.value === 'small')) {
        patterns.ancientSmallUtxos++
      }

      // Unconfirmed UTXOs
      if (c.age === 'unconfirmed') {
        patterns.unconfirmedUtxos++
      }

      // Round number UTXOs
      if (c.isRoundNumber) {
        patterns.roundNumberUtxos++
      }

      // Suspicious UTXOs
      if (c.health === 'suspicious') {
        patterns.suspiciousUtxos++
      }
    }

    return patterns
  }

  // Calculate value distribution statistics
  calculateValueDistributionStats (utxoDetails) {
    const stats = {
      economical: 0,
      marginal: 0,
      dust: 0,
      dustValue: 0
    }

    for (const utxo of utxoDetails) {
      const value = utxo.sats || utxo.value || 0

      if (value < 546) { // Dust limit
        stats.dust++
        stats.dustValue += value
      } else if (value < 2000) { // Marginal (higher than dust but still small)
        stats.marginal++
      } else {
        stats.economical++
      }
    }

    return stats
  }

  // Calculate age distribution statistics
  calculateAgeDistributionStats (utxoDetails) {
    const stats = {
      mature: 0,
      recent: 0,
      stabilityScore: 0
    }

    let totalUtxos = 0
    let weightedAge = 0

    for (const utxo of utxoDetails) {
      if (!utxo.classification) continue

      const age = utxo.classification.age
      totalUtxos++

      // Count mature vs recent
      if (age === 'mature' || age === 'aged' || age === 'ancient') {
        stats.mature++
        weightedAge += 3 // Higher weight for stable UTXOs
      } else if (age === 'fresh' || age === 'recent') {
        stats.recent++
        weightedAge += 1
      } else if (age === 'unconfirmed') {
        // Don't count unconfirmed towards stability
        totalUtxos--
      } else {
        weightedAge += 2 // Default weight
      }
    }

    // Calculate stability score (higher = more stable)
    if (totalUtxos > 0) {
      stats.stabilityScore = Math.min(weightedAge / (totalUtxos * 3), 1.0)
    }

    return stats
  }

  // Format UTXO information for display
  formatUtxoInfo (utxo) {
    const txid = utxo.outpoint?.txid || utxo.txid || 'unknown'
    const outIdx = utxo.outpoint?.outIdx !== undefined ? utxo.outpoint.outIdx : (utxo.outIdx !== undefined ? utxo.outIdx : 0)
    const amount = (utxo.sats || utxo.value || 0) / 100

    let info = `${txid.slice(0, 8)}...${txid.slice(-4)}:${outIdx} - ${amount.toLocaleString()} XEC`

    if (utxo.classification) {
      info += ` [${utxo.classification.age}/${utxo.classification.value}/${utxo.classification.health}]`
    }

    return info
  }

  // Get value range description
  getValueRange (valueClass) {
    switch (valueClass.toLowerCase()) {
      case 'dust': return '(< 10 XEC)'
      case 'micro': return '(10-50 XEC)'
      case 'small': return '(50-500 XEC)'
      case 'medium': return '(500-5K XEC)'
      case 'large': return '(5K-50K XEC)'
      case 'whale': return '(> 50K XEC)'
      default: return ''
    }
  }

  // Export classification data to file
  async exportClassificationData (classificationData, walletName) {
    try {
      const exportData = {
        wallet: walletName,
        address: classificationData.address,
        exportTime: new Date().toISOString(),
        summary: {
          totalUtxos: classificationData.classificationStats?.total || 0,
          totalValue: classificationData.classificationStats?.totalValue || 0,
          averagePrivacyScore: classificationData.classificationStats?.averagePrivacyScore || 0
        },
        classifications: classificationData.classifications,
        statistics: classificationData.classificationStats,
        detailedUtxos: classificationData.utxoDetails.map(utxo => ({
          txid: utxo.outpoint?.txid || utxo.txid,
          outIdx: utxo.outpoint?.outIdx !== undefined ? utxo.outpoint.outIdx : utxo.outIdx,
          value: utxo.sats || utxo.value,
          classification: utxo.classification
        }))
      }

      const fileName = `${walletName}-classifications-${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(process.cwd(), fileName)

      await this.walletUtil.fs.writeFile(filePath, JSON.stringify(exportData, null, 2))

      console.log()
      console.log(`Classification data exported to: ${fileName}`)

      return true
    } catch (err) {
      console.error('Warning: Could not export classification data:', err.message)
      return false
    }
  }
}

export default WalletClassify
