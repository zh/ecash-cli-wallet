/*
  Comprehensive security analysis for wallet UTXOs and transactions.

  Provides dedicated security threat assessment including:
  - Dust attack detection and analysis
  - Privacy leak identification
  - Suspicious transaction pattern detection
  - Address reuse analysis
  - Security recommendations and remediation steps
*/

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import ConfigManager from '../lib/config-manager.js'
import { loadWalletWithAnalytics } from '../lib/wallet-loader.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class WalletSecurity {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.configManager = new ConfigManager()
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.analyzeWalletSecurity = this.analyzeWalletSecurity.bind(this)
    this.performSecurityAnalysis = this.performSecurityAnalysis.bind(this)
    this.detectDustAttacks = this.detectDustAttacks.bind(this)
    this.analyzePrivacyLeaks = this.analyzePrivacyLeaks.bind(this)
    this.detectSuspiciousPatterns = this.detectSuspiciousPatterns.bind(this)
    this.analyzeAddressReuse = this.analyzeAddressReuse.bind(this)
    this.generateSecurityRecommendations = this.generateSecurityRecommendations.bind(this)
    this.displaySecurityDashboard = this.displaySecurityDashboard.bind(this)
    this.displayDetailedThreats = this.displayDetailedThreats.bind(this)
    this.displaySecurityRecommendations = this.displaySecurityRecommendations.bind(this)
    this.exportSecurityReport = this.exportSecurityReport.bind(this)
    this.formatThreatSeverity = this.formatThreatSeverity.bind(this)
    this.formatSecurityScore = this.formatSecurityScore.bind(this)
    this.getPriorityIndicator = this.getPriorityIndicator.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Analyzing security for wallet '${flags.name}'...\n`)

      // Check if analytics are available
      const analyticsEnabled = await this.walletUtil.isWalletAnalyticsEnabled(flags.name)
      if (!analyticsEnabled) {
        console.log('Analytics are disabled for this wallet.')
        console.log('Enable analytics to use security analysis:')
        console.log('   node xec-wallet.js config analytics-enable')
        console.log('   Or enable for this wallet only with upcoming config commands.')
        return false
      }

      // Perform comprehensive security analysis
      const securityData = await this.analyzeWalletSecurity(flags.name)

      // Display security dashboard
      await this.displaySecurityDashboard(securityData, flags)

      // Display detailed threat analysis if requested
      if (flags.detailed || flags.threats) {
        await this.displayDetailedThreats(securityData, flags)
      }

      // Display security recommendations
      await this.displaySecurityRecommendations(securityData, flags)

      // Export security report if requested
      if (flags.export) {
        await this.exportSecurityReport(securityData, flags.name)
      }

      return true
    } catch (err) {
      console.error('Error analyzing wallet security:', err.message)
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
        'dust', 'privacy', 'suspicious', 'address-reuse', 'critical', 'high', 'medium', 'low'
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

  // Main security analysis orchestration
  async analyzeWalletSecurity (walletName) {
    try {
      // Load wallet with analytics
      const xecWallet = await loadWalletWithAnalytics(walletName)

      // Perform comprehensive security analysis
      const securityAnalysis = await this.performSecurityAnalysis(xecWallet)

      return {
        walletName,
        address: xecWallet.walletInfo.xecAddress,
        analysisTime: new Date().toISOString(),
        balance: await xecWallet.getDetailedBalance(),
        ...securityAnalysis
      }
    } catch (err) {
      throw new Error(`Failed to analyze wallet security: ${err.message}`)
    }
  }

  // Perform comprehensive security analysis
  async performSecurityAnalysis (wallet) {
    try {
      // Get comprehensive health and security data using existing wallet analytics
      let healthReport, securityThreats

      try {
        healthReport = wallet.utxos.getWalletHealthReport()
      } catch (err) {
        console.warn('Warning: Could not get wallet health report:', err.message)
        healthReport = { overallHealth: 'unknown', metrics: {}, alerts: [], recommendations: [], summary: {} }
      }

      try {
        wallet.utxos.getUtxoClassifications()
      } catch (err) {
        console.warn('Warning: Could not get UTXO classifications:', err.message)
      }

      try {
        securityThreats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)
      } catch (err) {
        console.warn('Warning: Could not detect security threats:', err.message)
        securityThreats = { dustAttack: { detected: false, confidence: 0 }, riskLevel: 'low' }
      }

      try {
        await wallet.getDetailedBalance()
      } catch (err) {
        console.warn('Warning: Could not get detailed balance:', err.message)
      }

      // Get UTXO-level health and classification data with token awareness
      const classifiedUtxos = []
      try {
        if (wallet.utxos.utxoStore && wallet.utxos.utxoStore.xecUtxos) {
          const utxos = wallet.utxos.utxoStore.xecUtxos
          for (const utxo of utxos.slice(0, 100)) { // Limit for performance
            try {
              const utxoHealth = wallet.utxos.analytics.healthMonitor.assessUtxoHealth(utxo)
              const utxoClassification = wallet.utxos.analytics.classifier.classifyUtxo(utxo)

              // Enhance classification with token awareness
              const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, utxoClassification)

              classifiedUtxos.push({
                utxo,
                classification: utxoClassification, // Keep original for compatibility
                enhancedClassification, // Add token-aware classification
                health: utxoHealth,
                // Add convenience fields
                utxoType: enhancedClassification.utxoType,
                hasToken: enhancedClassification.hasToken,
                isPureDust: enhancedClassification.isPureDust
              })
            } catch (err) {
              // Skip UTXOs that can't be analyzed
              continue
            }
          }
        }
      } catch (err) {
        console.warn('Warning: Could not get detailed UTXO analysis data')
      }

      // Perform specific security analyses using the properly classified data
      const dustAttackAnalysis = this.detectDustAttacks(classifiedUtxos, securityThreats)
      const privacyAnalysis = this.analyzePrivacyLeaks(classifiedUtxos, wallet.walletInfo.xecAddress)
      const suspiciousPatterns = this.detectSuspiciousPatterns(classifiedUtxos, securityThreats)
      const addressReuseAnalysis = this.analyzeAddressReuse(wallet, classifiedUtxos)

      // Calculate overall security metrics (token-aware)
      const totalUtxos = classifiedUtxos.length || healthReport.metrics?.totalUtxos || 0

      // CRITICAL FIX: Only count pure dust, not token UTXOs
      const dustUtxos = classifiedUtxos.filter(item =>
        item.isPureDust === true ||
        (!item.hasToken && item.health.status === 'dust')
      ).length || 0

      const tokenUtxos = classifiedUtxos.filter(item => item.hasToken === true).length || 0
      const suspiciousUtxos = classifiedUtxos.filter(item => item.health.status === 'suspicious').length || 0
      const healthyUtxos = classifiedUtxos.filter(item =>
        item.health.status === 'healthy' || item.hasToken === true // Token UTXOs are healthy
      ).length || healthReport.metrics?.healthyUtxos || 0

      // Calculate security scores
      const privacyScore = privacyAnalysis.averagePrivacyScore
      const dustRatio = totalUtxos > 0 ? (dustUtxos / totalUtxos) * 100 : 0
      const suspiciousRatio = totalUtxos > 0 ? (suspiciousUtxos / totalUtxos) * 100 : 0
      const healthyRatio = totalUtxos > 0 ? (healthyUtxos / totalUtxos) * 100 : 0

      // Overall security score (0-100)
      const overallSecurityScore = Math.max(0, Math.min(100,
        (privacyScore * 0.4) +
        (healthyRatio * 0.3) +
        (Math.max(0, 100 - dustRatio * 2) * 0.2) +
        (Math.max(0, 100 - suspiciousRatio * 4) * 0.1)
      ))

      // Determine security status
      let securityStatus = 'secure'
      if (overallSecurityScore < 30) securityStatus = 'critical'
      else if (overallSecurityScore < 50) securityStatus = 'at-risk'
      else if (overallSecurityScore < 70) securityStatus = 'moderate'
      else if (overallSecurityScore < 85) securityStatus = 'good'

      // Compile all threats
      const allThreats = [
        ...dustAttackAnalysis.threats,
        ...privacyAnalysis.threats,
        ...suspiciousPatterns.threats,
        ...addressReuseAnalysis.threats
      ]

      // Generate recommendations
      // Token portfolio analysis
      const tokenPortfolioAnalysis = this.analyzeTokenPortfolio(classifiedUtxos)

      const recommendations = this.generateSecurityRecommendations({
        dustAttackAnalysis,
        privacyAnalysis,
        suspiciousPatterns,
        addressReuseAnalysis,
        overallSecurityScore,
        securityStatus,
        tokenPortfolioAnalysis
      })

      return {
        securityReport: {
          overallSecurity: securityStatus,
          securityScore: Math.round(overallSecurityScore) || 0,
          tokenPortfolioAnalysis,
          metrics: {
            totalUtxos,
            healthyUtxos,
            dustUtxos, // Now excludes token UTXOs
            tokenUtxos, // New: separate token count
            suspiciousUtxos,
            privacyScore: Math.round(privacyScore) || 0,
            dustRatio: Math.round(dustRatio * 100) / 100,
            suspiciousRatio: Math.round(suspiciousRatio * 100) / 100,
            tokenRatio: Math.round((tokenUtxos / totalUtxos) * 10000) / 100
          },
          threats: allThreats.sort((a, b) => this._getSeverityWeight(b.severity) - this._getSeverityWeight(a.severity)),
          analysis: {
            dustAttacks: dustAttackAnalysis,
            privacy: privacyAnalysis,
            suspicious: suspiciousPatterns,
            addressReuse: addressReuseAnalysis
          }
        },
        recommendations: recommendations.sort((a, b) => this._getPriorityWeight(b.priority) - this._getPriorityWeight(a.priority)),
        classifiedUtxos,
        healthReport,
        securityThreats
      }
    } catch (err) {
      throw new Error(`Security analysis failed: ${err.message}`)
    }
  }

  // Detect dust attacks
  detectDustAttacks (classifiedUtxos, securityThreats) {
    const threats = []

    // CRITICAL FIX: Only consider pure dust UTXOs, exclude token UTXOs
    const dustUtxos = classifiedUtxos.filter(item =>
      item.isPureDust === true || // Use new token-aware classification
      (!item.hasToken && (item.health.status === 'dust' || item.classification.value === 'dust'))
    )

    const analysis = {
      detected: false,
      dustCount: dustUtxos.length,
      totalValue: dustUtxos.reduce((sum, item) => sum + item.classification.satsValue, 0),
      patterns: []
    }

    if (dustUtxos.length >= 5) {
      analysis.detected = true
      threats.push({
        type: 'dust-attack',
        severity: 'high',
        title: 'Dust Attack Detected',
        description: `${dustUtxos.length} dust UTXOs detected, indicating possible dust attack`,
        impact: 'Privacy degradation and potential surveillance',
        affectedUtxos: dustUtxos.length,
        details: {
          dustCount: dustUtxos.length,
          totalDustValue: analysis.totalValue,
          averageDustValue: Math.round(analysis.totalValue / dustUtxos.length)
        }
      })
    }

    // Analyze for systematic patterns
    const valueCounts = {}
    dustUtxos.forEach(item => {
      const value = item.classification.satsValue
      valueCounts[value] = (valueCounts[value] || 0) + 1
    })

    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 3) {
        analysis.patterns.push({
          value: parseInt(value),
          count,
          suspicious: count >= 5
        })

        if (count >= 5) {
          threats.push({
            type: 'systematic-dust',
            severity: 'critical',
            title: 'Systematic Dust Pattern',
            description: `${count} UTXOs with identical value ${value} satoshis`,
            impact: 'Strong indication of targeted dust attack',
            affectedUtxos: count
          })
        }
      }
    }

    return { analysis, threats }
  }

  // Analyze privacy leaks
  analyzePrivacyLeaks (classifiedUtxos, walletAddress) {
    const threats = []
    let totalPrivacyScore = 0
    let utxosWithPrivacyData = 0
    const privacyIssues = []

    // Analyze individual UTXO privacy scores
    classifiedUtxos.forEach(item => {
      if (item.classification.privacy !== undefined) {
        totalPrivacyScore += item.classification.privacy
        utxosWithPrivacyData++

        if (item.classification.privacy < 30) {
          privacyIssues.push({
            utxo: `${item.utxo.txid}:${item.utxo.outIdx}`,
            privacyScore: item.classification.privacy,
            issues: item.classification.privacyFactors
          })
        }
      }
    })

    const averagePrivacyScore = utxosWithPrivacyData > 0 ? totalPrivacyScore / utxosWithPrivacyData : 50

    // Generate privacy threats
    if (averagePrivacyScore < 40) {
      threats.push({
        type: 'low-privacy',
        severity: 'medium',
        title: 'Low Privacy Score',
        description: `Average privacy score is ${Math.round(averagePrivacyScore)}/100`,
        impact: 'Transactions may be easily linked and analyzed',
        affectedUtxos: privacyIssues.length
      })
    }

    // Check for round number concentrations
    const roundNumbers = classifiedUtxos.filter(item => {
      const value = item.classification.satsValue
      return value % 100000 === 0 || value % 50000 === 0 || value % 10000 === 0
    })

    if (roundNumbers.length >= 3) {
      threats.push({
        type: 'round-numbers',
        severity: 'low',
        title: 'Round Number Pattern',
        description: `${roundNumbers.length} UTXOs with round values detected`,
        impact: 'May indicate non-random transaction patterns',
        affectedUtxos: roundNumbers.length
      })
    }

    return {
      analysis: {
        averagePrivacyScore,
        lowPrivacyUtxos: privacyIssues.length,
        roundNumberUtxos: roundNumbers.length
      },
      threats,
      issues: privacyIssues
    }
  }

  // Detect suspicious patterns
  detectSuspiciousPatterns (classifiedUtxos, securityThreats) {
    const threats = []
    const suspiciousUtxos = classifiedUtxos.filter(item =>
      item.health.status === 'suspicious' ||
      item.classification.health === 'unhealthy'
    )

    const analysis = {
      suspiciousCount: suspiciousUtxos.length,
      patterns: []
    }

    if (suspiciousUtxos.length > 0) {
      threats.push({
        type: 'suspicious-utxos',
        severity: suspiciousUtxos.length >= 5 ? 'high' : 'medium',
        title: 'Suspicious UTXOs Detected',
        description: `${suspiciousUtxos.length} UTXOs flagged as suspicious`,
        impact: 'May indicate compromise or malicious activity',
        affectedUtxos: suspiciousUtxos.length
      })
    }

    // Check for unconfirmed UTXO accumulation
    const unconfirmedUtxos = classifiedUtxos.filter(item =>
      item.utxo.blockHeight === -1 || item.utxo.blockHeight === 0
    )

    if (unconfirmedUtxos.length >= 10) {
      threats.push({
        type: 'unconfirmed-accumulation',
        severity: 'medium',
        title: 'High Unconfirmed UTXO Count',
        description: `${unconfirmedUtxos.length} unconfirmed UTXOs detected`,
        impact: 'May indicate rapid transaction activity or potential issues',
        affectedUtxos: unconfirmedUtxos.length
      })
    }

    return { analysis, threats }
  }

  // Analyze address reuse (simplified for single-address wallet)
  analyzeAddressReuse (wallet, classifiedUtxos) {
    const threats = []

    // For HD wallets, check if multiple addresses are being used properly
    const analysis = {
      primaryAddress: wallet.walletInfo.xecAddress,
      utxoCount: classifiedUtxos.length,
      addressDiversity: 1 // Single address for now
    }

    // Check for excessive UTXO concentration on single address
    if (classifiedUtxos.length >= 50) {
      threats.push({
        type: 'address-concentration',
        severity: 'low',
        title: 'High UTXO Concentration',
        description: `${classifiedUtxos.length} UTXOs concentrated on single address`,
        impact: 'May indicate suboptimal privacy practices',
        affectedUtxos: classifiedUtxos.length,
        recommendation: 'Consider using HD address rotation for better privacy'
      })
    }

    return { analysis, threats }
  }

  // Generate security recommendations
  generateSecurityRecommendations (analysisData) {
    const recommendations = []

    // Dust attack recommendations
    if (analysisData.dustAttackAnalysis.detected) {
      recommendations.push({
        priority: 'high',
        category: 'dust-attack',
        title: 'Mitigate Dust Attack',
        description: 'Dust attack detected - consider consolidation',
        action: 'Use wallet-optimize to consolidate dust UTXOs',
        command: 'node xec-wallet.js wallet-optimize --name [wallet] --strategy consolidate',
        impact: 'Improves privacy and reduces attack surface'
      })
    }

    // Privacy recommendations
    if (analysisData.privacyAnalysis.analysis.averagePrivacyScore < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'privacy',
        title: 'Improve Privacy Score',
        description: 'Privacy score below recommended threshold',
        action: 'Use privacy-focused coin selection in transactions',
        command: 'node xec-wallet.js send-xec --strategy privacy',
        impact: 'Enhances transaction privacy and reduces fingerprinting'
      })
    }

    // Suspicious UTXO recommendations
    if (analysisData.suspiciousPatterns.analysis.suspiciousCount > 0) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        title: 'Review Suspicious UTXOs',
        description: 'Suspicious UTXOs detected requiring review',
        action: 'Analyze suspicious UTXOs with detailed classification',
        command: 'node xec-wallet.js wallet-classify --name [wallet] --filter suspicious --detailed',
        impact: 'Identifies potential security threats'
      })
    }

    // Overall security recommendations
    if (analysisData.overallSecurityScore < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'general',
        title: 'Improve Overall Security',
        description: `Security score (${Math.round(analysisData.overallSecurityScore)}/100) below recommended level`,
        action: 'Follow security best practices and consolidate problematic UTXOs',
        impact: 'Enhances overall wallet security posture'
      })
    }

    return recommendations
  }

  // Display main security dashboard
  async displaySecurityDashboard (securityData, flags) {
    try {
      const { securityReport } = securityData

      console.log('WALLET SECURITY ANALYSIS')
      console.log('='.repeat(50))
      console.log(`Wallet: ${securityData.walletName}`)
      console.log(`Address: ${securityData.address}`)
      console.log(`Analysis Time: ${new Date(securityData.analysisTime).toLocaleString()}`)
      console.log()

      // Security Overview
      console.log('SECURITY OVERVIEW')
      console.log('-'.repeat(30))
      console.log(`Security Status: ${this.formatSecurityScore(securityReport.overallSecurity)}`)
      console.log(`Security Score: ${securityReport.securityScore}/100`)
      console.log(`Privacy Score: ${securityReport.metrics.privacyScore}/100`)
      console.log()

      // Key Metrics
      console.log('KEY SECURITY METRICS')
      console.log('-'.repeat(30))
      console.log(`Total UTXOs: ${securityReport.metrics.totalUtxos}`)
      console.log(`Healthy UTXOs: ${securityReport.metrics.healthyUtxos} [HEALTHY]`)
      console.log(`Pure Dust UTXOs: ${securityReport.metrics.dustUtxos} [DUST]`)
      console.log(`Token UTXOs: ${securityReport.metrics.tokenUtxos} [TOKEN]`)
      console.log(`Suspicious UTXOs: ${securityReport.metrics.suspiciousUtxos} [SUSPICIOUS]`)
      console.log(`Dust Ratio: ${securityReport.metrics.dustRatio}%`)
      if (securityReport.metrics.tokenRatio > 0) {
        console.log(`Token Ratio: ${securityReport.metrics.tokenRatio}%`)
      }
      console.log()

      // Token Portfolio Summary (if tokens present)
      if (securityReport.tokenPortfolioAnalysis && securityReport.tokenPortfolioAnalysis.hasTokens) {
        const tokenAnalysis = securityReport.tokenPortfolioAnalysis
        console.log('TOKEN PORTFOLIO SUMMARY')
        console.log('-'.repeat(30))
        console.log(`Summary: ${tokenAnalysis.summary}`)
        console.log(`Token Diversity: ${tokenAnalysis.metrics.tokenDiversification.toUpperCase()}`)
        if (tokenAnalysis.metrics.mintBatons > 0) {
          console.log(`Mint Batons: ${tokenAnalysis.metrics.mintBatons} [MINT-BATON]`)
        }
        if (tokenAnalysis.risks.length > 0) {
          console.log(`Token Risks: ${tokenAnalysis.risks.length} identified`)
        }
        console.log()
      }

      // Critical Threats Summary
      const criticalThreats = securityReport.threats.filter(threat => threat.severity === 'critical')
      const highThreats = securityReport.threats.filter(threat => threat.severity === 'high')

      if (criticalThreats.length > 0 || highThreats.length > 0) {
        console.log('CRITICAL SECURITY ALERTS')
        console.log('-'.repeat(30))

        // Show critical threats
        criticalThreats.slice(0, 3).forEach(threat => {
          console.log(`${this.getPriorityIndicator('critical')} ${threat.title}`)
          console.log(`   ${threat.description}`)
          console.log(`   Impact: ${threat.impact}`)
          console.log()
        })

        // Show high priority threats
        highThreats.slice(0, 2).forEach(threat => {
          console.log(`${this.getPriorityIndicator('high')} ${threat.title}`)
          console.log(`   ${threat.description}`)
          console.log()
        })

        if (criticalThreats.length + highThreats.length > 5) {
          console.log(`   ... and ${(criticalThreats.length + highThreats.length) - 5} more threats`)
          console.log('   Use --detailed flag to see all threats')
          console.log()
        }
      } else {
        console.log('[OK] NO CRITICAL THREATS DETECTED')
        console.log()
      }

      return true
    } catch (err) {
      console.error('Error displaying security dashboard:', err.message)
      return false
    }
  }

  // Display detailed threat analysis
  async displayDetailedThreats (securityData, flags) {
    try {
      const { securityReport } = securityData

      console.log('DETAILED THREAT ANALYSIS')
      console.log('='.repeat(50))

      if (securityReport.threats.length === 0) {
        console.log('[OK] No security threats detected.')
        console.log()
        return true
      }

      // Filter threats if requested
      let threatsToShow = securityReport.threats
      if (flags.filter) {
        const filters = flags.filter.split(',').map(f => f.trim().toLowerCase())
        threatsToShow = securityReport.threats.filter(threat => {
          return filters.some(filter =>
            threat.type.includes(filter) ||
            threat.severity === filter ||
            threat.category === filter
          )
        })
      }

      // Group threats by severity
      const threatsBySeverity = {
        critical: threatsToShow.filter(t => t.severity === 'critical'),
        high: threatsToShow.filter(t => t.severity === 'high'),
        medium: threatsToShow.filter(t => t.severity === 'medium'),
        low: threatsToShow.filter(t => t.severity === 'low')
      }

      // Display threats by severity
      for (const [severity, threats] of Object.entries(threatsBySeverity)) {
        if (threats.length === 0) continue

        console.log(`${this.formatThreatSeverity(severity)} SEVERITY THREATS`)
        console.log('-'.repeat(30))

        threats.forEach((threat, index) => {
          const threatIcon = this.getThreatIcon(threat.type)
          console.log(`${index + 1}. ${threatIcon} ${threat.title}`)
          console.log(`   Type: ${threat.type}`)
          console.log(`   Description: ${threat.description}`)
          console.log(`   Impact: ${threat.impact}`)
          if (threat.affectedUtxos) {
            console.log(`   Affected UTXOs: ${threat.affectedUtxos}`)
          }
          if (threat.details) {
            console.log(`   Details: ${JSON.stringify(threat.details, null, 2)}`)
          }
          if (threat.recommendation) {
            console.log(`   [RECOMMENDATION]: ${threat.recommendation}`)
          }
          console.log()
        })
      }

      return true
    } catch (err) {
      console.error('Error displaying detailed threats:', err.message)
      return false
    }
  }

  // Display security recommendations
  async displaySecurityRecommendations (securityData, flags) {
    try {
      console.log('SECURITY RECOMMENDATIONS')
      console.log('='.repeat(50))

      if (!securityData.recommendations || securityData.recommendations.length === 0) {
        console.log('[OK] No specific security recommendations at this time.')
        console.log('   Your wallet security posture appears good.')
        console.log()
        return true
      }

      // Show prioritized recommendations with enhanced visuals
      securityData.recommendations.forEach((rec, index) => {
        const categoryIcon = this.getCategoryIcon(rec.category)
        console.log(`${this.getPriorityIndicator(rec.priority)} ${categoryIcon} ${rec.title}`)
        console.log(`   Category: ${rec.category.toUpperCase()}`)
        console.log(`   Description: ${rec.description}`)
        console.log(`   [ACTION]: ${rec.action}`)
        if (rec.command) {
          console.log(`   [COMMAND]: ${rec.command}`)
        }
        console.log(`   [IMPACT]: ${rec.impact}`)
        console.log()
      })

      return true
    } catch (err) {
      console.error('Error displaying recommendations:', err.message)
      return false
    }
  }

  // Export security report to JSON file
  async exportSecurityReport (securityData, walletName) {
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${walletName}-security-report-${timestamp}.json`

      const exportData = {
        ...securityData,
        exportTime: new Date().toISOString(),
        version: '1.0.0'
      }

      await import('fs').then(fs => fs.promises.writeFile(filename, JSON.stringify(exportData, null, 2)))

      console.log(`Security report exported to: ${filename}`)
      console.log()

      return true
    } catch (err) {
      console.error('Error exporting security report:', err.message)
      return false
    }
  }

  // Helper functions for formatting
  formatThreatSeverity (severity) {
    const severityMap = {
      critical: '[CRITICAL]',
      high: '[HIGH]',
      medium: '[MEDIUM]',
      low: '[LOW]'
    }
    return severityMap[severity] || '[UNKNOWN]'
  }

  formatSecurityScore (status) {
    const statusMap = {
      secure: '[SECURE]',
      good: '[GOOD]',
      moderate: '[MODERATE]',
      'at-risk': '[AT RISK]',
      critical: '[CRITICAL]'
    }
    return statusMap[status] || '[UNKNOWN]'
  }

  getPriorityIndicator (priority) {
    const priorityMap = {
      critical: '[CRITICAL]',
      high: '[HIGH]',
      medium: '[MEDIUM]',
      low: '[LOW]'
    }
    return priorityMap[priority] || '[INFO]'
  }

  getThreatIcon (threatType) {
    const threatIcons = {
      'dust-attack': '[DUST]',
      'systematic-dust': '[PATTERN]',
      'low-privacy': '[PRIVACY]',
      'round-numbers': '[ROUND]',
      'suspicious-utxos': '[SUSPICIOUS]',
      'unconfirmed-accumulation': '[UNCONFIRMED]',
      'address-concentration': '[ADDRESS]',
      'token-concentration': '[TOKEN]',
      'mint-baton-custody': '[MINT-BATON]',
      'token-fragmentation': '[FRAGMENT]'
    }
    return threatIcons[threatType] || '[THREAT]'
  }

  getCategoryIcon (category) {
    const categoryIcons = {
      'dust-attack': '[DUST]',
      privacy: '[PRIVACY]',
      security: '[SECURITY]',
      general: '[GENERAL]',
      'token-security': '[TOKEN-SEC]',
      optimization: '[OPTIMIZE]',
      portfolio: '[PORTFOLIO]'
    }
    return categoryIcons[category] || '[INFO]'
  }

  // Analyze token portfolio for security implications
  analyzeTokenPortfolio (classifiedUtxos) {
    try {
      const tokenUtxos = classifiedUtxos.filter(item => item.hasToken === true)
      const mintBatonUtxos = classifiedUtxos.filter(item => item.utxoType === 'mint-baton')

      if (tokenUtxos.length === 0) {
        return {
          hasTokens: false,
          summary: 'No tokens detected in wallet',
          metrics: {
            tokenUtxoCount: 0,
            uniqueTokens: 0,
            mintBatons: 0,
            totalTokenValue: 0
          },
          risks: [],
          recommendations: []
        }
      }

      // Analyze token diversity and concentration
      const tokenIds = new Map()
      let totalTokenXecValue = 0

      tokenUtxos.forEach(item => {
        const tokenId = item.enhancedClassification?.tokenInfo?.tokenId ||
                       item.tokenInfo?.tokenId ||
                       item.utxo.token?.tokenId

        if (tokenId) {
          if (!tokenIds.has(tokenId)) {
            tokenIds.set(tokenId, {
              tokenId,
              utxoCount: 0,
              totalAmount: '0',
              ticker: item.enhancedClassification?.tokenInfo?.ticker || 'Unknown',
              protocol: item.enhancedClassification?.tokenInfo?.protocol || 'SLP'
            })
          }

          const tokenData = tokenIds.get(tokenId)
          tokenData.utxoCount++
          totalTokenXecValue += (item.utxo.value || 0)
        }
      })

      // Calculate portfolio metrics
      const portfolioMetrics = {
        tokenUtxoCount: tokenUtxos.length,
        uniqueTokens: tokenIds.size,
        mintBatons: mintBatonUtxos.length,
        totalTokenValue: totalTokenXecValue,
        averageUtxosPerToken: tokenIds.size > 0 ? Math.round(tokenUtxos.length / tokenIds.size) : 0,
        tokenDiversification: tokenIds.size >= 5 ? 'high' : tokenIds.size >= 3 ? 'medium' : 'low'
      }

      // Identify potential risks
      const risks = []
      const recommendations = []

      // Check for token concentration risks
      const maxUtxosPerToken = Math.max(...Array.from(tokenIds.values()).map(t => t.utxoCount))
      if (maxUtxosPerToken >= 10) {
        risks.push({
          type: 'token-concentration',
          severity: 'medium',
          description: `High concentration of UTXOs for single token (${maxUtxosPerToken} UTXOs)`,
          impact: 'May indicate token accumulation strategy or potential liquidity issues'
        })
      }

      // Check for mint baton security
      if (mintBatonUtxos.length > 0) {
        risks.push({
          type: 'mint-baton-custody',
          severity: 'high',
          description: `${mintBatonUtxos.length} mint baton(s) detected`,
          impact: 'Mint batons provide token creation authority - secure storage critical'
        })

        recommendations.push({
          priority: 'high',
          category: 'token-security',
          title: 'Secure Mint Baton Storage',
          description: 'Mint batons detected - ensure secure storage practices',
          action: 'Consider moving mint batons to cold storage or multisig',
          impact: 'Prevents unauthorized token minting'
        })
      }

      // Check for excessive token fragmentation
      if (portfolioMetrics.averageUtxosPerToken >= 5) {
        risks.push({
          type: 'token-fragmentation',
          severity: 'low',
          description: `High token UTXO fragmentation (avg ${portfolioMetrics.averageUtxosPerToken} UTXOs per token)`,
          impact: 'May increase transaction fees and complexity'
        })

        recommendations.push({
          priority: 'low',
          category: 'optimization',
          title: 'Consider Token Consolidation',
          description: 'Multiple UTXOs per token detected',
          action: 'Consolidate token UTXOs to reduce fragmentation',
          impact: 'Reduces transaction complexity and fees'
        })
      }

      // Portfolio diversity recommendations
      if (portfolioMetrics.tokenDiversification === 'low' && tokenIds.size >= 2) {
        recommendations.push({
          priority: 'low',
          category: 'portfolio',
          title: 'Token Portfolio Diversification',
          description: `Portfolio contains ${tokenIds.size} unique tokens`,
          action: 'Monitor token portfolio balance and risk exposure',
          impact: 'Helps manage portfolio risk and exposure'
        })
      }

      return {
        hasTokens: true,
        summary: `${tokenIds.size} unique tokens across ${tokenUtxos.length} UTXOs`,
        metrics: portfolioMetrics,
        tokenBreakdown: Array.from(tokenIds.values()),
        risks,
        recommendations
      }
    } catch (err) {
      console.warn('Warning: Could not analyze token portfolio:', err.message)
      return {
        hasTokens: false,
        summary: 'Token portfolio analysis failed',
        error: err.message,
        metrics: {
          tokenUtxoCount: 0,
          uniqueTokens: 0,
          mintBatons: 0,
          totalTokenValue: 0
        },
        risks: [],
        recommendations: []
      }
    }
  }

  // Helper functions for internal calculations
  _getSeverityWeight (severity) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 }
    return weights[severity] || 0
  }

  _getPriorityWeight (priority) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 }
    return weights[priority] || 0
  }
}

export default WalletSecurity
