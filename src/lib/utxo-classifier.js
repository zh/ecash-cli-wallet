/*
  Enhanced UTXO Classification Utilities
  Provides token-aware UTXO categorization to distinguish between
  pure dust, token UTXOs, and other UTXO types.
*/

class UtxoClassifier {
  constructor () {
    // Standard dust threshold for BCH (546 satoshis)
    this.DUST_THRESHOLD = 546

    // XEC conversion (1 XEC = 100 satoshis)
    this.SATS_PER_XEC = 100

    // Bind methods
    this.enhanceClassification = this.enhanceClassification.bind(this)
    this.detectUtxoType = this.detectUtxoType.bind(this)
    this.isTokenUtxo = this.isTokenUtxo.bind(this)
    this.isPureDust = this.isPureDust.bind(this)
    this.isMintBaton = this.isMintBaton.bind(this)
    this.getTokenInfo = this.getTokenInfo.bind(this)
    this.calculateTokenAwareHealth = this.calculateTokenAwareHealth.bind(this)
    this.getUtxoDisplayInfo = this.getUtxoDisplayInfo.bind(this)
  }

  /**
   * Enhance existing UTXO classification with token awareness
   * @param {Object} utxo - Raw UTXO object
   * @param {Object} originalClassification - Original classification from analytics
   * @returns {Object} Enhanced classification
   */
  enhanceClassification (utxo, originalClassification = {}) {
    try {
      // Detect UTXO type first
      const utxoType = this.detectUtxoType(utxo)

      // Get token information if present
      const tokenInfo = this.getTokenInfo(utxo)

      // Calculate token-aware health status
      const tokenAwareHealth = this.calculateTokenAwareHealth(utxo, utxoType, originalClassification)

      // Get display information
      const displayInfo = this.getUtxoDisplayInfo(utxo, utxoType, tokenInfo)

      // Enhanced classification object
      const enhanced = {
        // Original classification preserved
        ...originalClassification,

        // Enhanced token-aware fields
        utxoType,
        hasToken: this.isTokenUtxo(utxo),
        isPureDust: this.isPureDust(utxo),

        // Token information
        tokenInfo,

        // Corrected health status
        health: {
          ...originalClassification.health,
          status: tokenAwareHealth.status,
          reasoning: tokenAwareHealth.reasoning,
          tokenAware: true
        },

        // Display helpers
        display: displayInfo,

        // Value assessment
        value: {
          xecAmount: utxo.value / this.SATS_PER_XEC,
          satsValue: utxo.value,
          actualValue: utxoType === 'token-utxo'
            ? 'token-valuable'
            : utxoType === 'pure-dust'
              ? 'dust'
              : utxo.value >= 1000 ? 'valuable' : 'small',
          classification: utxoType === 'token-utxo'
            ? 'valuable-token'
            : utxoType === 'pure-dust'
              ? 'dust'
              : originalClassification.value || 'standard'
        }
      }

      return enhanced
    } catch (err) {
      console.warn('Warning: Could not enhance UTXO classification:', err.message)
      return originalClassification
    }
  }

  /**
   * Detect the type of UTXO based on content and value
   * @param {Object} utxo - UTXO object
   * @returns {String} UTXO type classification
   */
  detectUtxoType (utxo) {
    try {
      // Check for token data presence
      if (this.isTokenUtxo(utxo)) {
        if (this.isMintBaton(utxo)) {
          return 'mint-baton'
        } else {
          // Token UTXO - contains valuable token data
          return 'token-utxo'
        }
      }

      // Pure XEC UTXOs
      if (utxo.value <= this.DUST_THRESHOLD) {
        return 'pure-dust' // Actual dust/spam
      } else if (utxo.value <= this.DUST_THRESHOLD * 2) {
        return 'token-change' // Likely change from token transaction
      } else if (utxo.value >= 10000) { // >= 100 XEC
        return 'large-utxo'
      } else {
        return 'standard-utxo'
      }
    } catch (err) {
      return 'unknown'
    }
  }

  /**
   * Check if UTXO contains token data
   * @param {Object} utxo - UTXO object
   * @returns {Boolean}
   */
  isTokenUtxo (utxo) {
    try {
      return !!(utxo.token && utxo.token.tokenId && utxo.token.tokenId.length === 64)
    } catch (err) {
      return false
    }
  }

  /**
   * Check if UTXO is pure dust (no token data, small amount)
   * @param {Object} utxo - UTXO object
   * @returns {Boolean}
   */
  isPureDust (utxo) {
    try {
      return !this.isTokenUtxo(utxo) && utxo.value <= this.DUST_THRESHOLD
    } catch (err) {
      return false
    }
  }

  /**
   * Check if token UTXO is a mint baton
   * @param {Object} utxo - UTXO object
   * @returns {Boolean}
   */
  isMintBaton (utxo) {
    try {
      return !!(utxo.token && utxo.token.isMintBaton === true)
    } catch (err) {
      return false
    }
  }

  /**
   * Extract token information from UTXO
   * @param {Object} utxo - UTXO object
   * @returns {Object|null} Token information
   */
  getTokenInfo (utxo) {
    try {
      if (!this.isTokenUtxo(utxo)) {
        return null
      }

      const token = utxo.token
      return {
        tokenId: token.tokenId,
        amount: token.atoms || token.amount || '0',
        isMintBaton: token.isMintBaton || false,
        protocol: token.protocol || 'SLP',
        decimals: token.decimals || 0,
        ticker: token.ticker || null,
        name: token.name || null
      }
    } catch (err) {
      return null
    }
  }

  /**
   * Calculate token-aware health status
   * @param {Object} utxo - UTXO object
   * @param {String} utxoType - UTXO type from detectUtxoType()
   * @param {Object} originalClassification - Original classification
   * @returns {Object} Health status and reasoning
   */
  calculateTokenAwareHealth (utxo, utxoType, originalClassification) {
    try {
      switch (utxoType) {
        case 'token-utxo':
          return {
            status: 'healthy',
            reasoning: 'Token UTXO with valuable token data (small XEC amount is normal)'
          }

        case 'mint-baton':
          return {
            status: 'healthy',
            reasoning: 'Mint baton UTXO - enables future token minting'
          }

        case 'pure-dust':
          return {
            status: 'dust',
            reasoning: 'Pure dust UTXO with no token data - potential spam'
          }

        case 'token-change':
          return {
            status: 'healthy',
            reasoning: 'Small XEC amount likely from token transaction change'
          }

        case 'large-utxo':
          return {
            status: 'healthy',
            reasoning: 'Large UTXO good for transaction fees and flexibility'
          }

        case 'standard-utxo':
          return originalClassification.health || {
            status: 'healthy',
            reasoning: 'Standard XEC UTXO'
          }

        default:
          return originalClassification.health || {
            status: 'unknown',
            reasoning: 'Could not determine UTXO health status'
          }
      }
    } catch (err) {
      return {
        status: 'unknown',
        reasoning: `Health assessment failed: ${err.message}`
      }
    }
  }

  /**
   * Get display information for UTXO
   * @param {Object} utxo - UTXO object
   * @param {String} utxoType - UTXO type
   * @param {Object} tokenInfo - Token information
   * @returns {Object} Display information
   */
  getUtxoDisplayInfo (utxo, utxoType, tokenInfo) {
    try {
      const baseInfo = {
        type: utxoType,
        icon: this.getUtxoIcon(utxoType),
        color: this.getUtxoColor(utxoType),
        shortDescription: this.getUtxoShortDescription(utxoType, tokenInfo),
        category: this.getUtxoCategory(utxoType)
      }

      if (tokenInfo) {
        baseInfo.tokenDisplay = {
          shortId: `${tokenInfo.tokenId.slice(0, 8)}...${tokenInfo.tokenId.slice(-4)}`,
          amount: tokenInfo.amount,
          ticker: tokenInfo.ticker || 'Unknown Token'
        }
      }

      return baseInfo
    } catch (err) {
      return {
        type: utxoType || 'unknown',
        icon: '❓',
        color: 'gray',
        shortDescription: 'Unknown UTXO type',
        category: 'unknown'
      }
    }
  }

  /**
   * Get icon for UTXO type
   * @param {String} utxoType - UTXO type
   * @returns {String} Unicode icon
   */
  getUtxoIcon (utxoType) {
    const icons = {
      'token-utxo': '🪙',
      'mint-baton': '🏭',
      'pure-dust': '💸',
      'token-change': '🔄',
      'large-utxo': '💰',
      'standard-utxo': '💵'
    }
    return icons[utxoType] || '❓'
  }

  /**
   * Get color coding for UTXO type
   * @param {String} utxoType - UTXO type
   * @returns {String} Color name
   */
  getUtxoColor (utxoType) {
    const colors = {
      'token-utxo': 'green',
      'mint-baton': 'blue',
      'pure-dust': 'yellow',
      'token-change': 'cyan',
      'large-utxo': 'green',
      'standard-utxo': 'white'
    }
    return colors[utxoType] || 'gray'
  }

  /**
   * Get short description for UTXO type
   * @param {String} utxoType - UTXO type
   * @param {Object} tokenInfo - Token information
   * @returns {String} Short description
   */
  getUtxoShortDescription (utxoType, tokenInfo) {
    const descriptions = {
      'token-utxo': tokenInfo ? `${tokenInfo.ticker || 'Token'} UTXO` : 'Token UTXO',
      'mint-baton': 'Mint Baton',
      'pure-dust': 'Pure Dust',
      'token-change': 'Token Change',
      'large-utxo': 'Large UTXO',
      'standard-utxo': 'Standard UTXO'
    }
    return descriptions[utxoType] || 'Unknown'
  }

  /**
   * Get category for grouping UTXOs
   * @param {String} utxoType - UTXO type
   * @returns {String} Category name
   */
  getUtxoCategory (utxoType) {
    const categories = {
      'token-utxo': 'tokens',
      'mint-baton': 'tokens',
      'pure-dust': 'dust',
      'token-change': 'xec',
      'large-utxo': 'xec',
      'standard-utxo': 'xec'
    }
    return categories[utxoType] || 'unknown'
  }

  /**
   * Get summary statistics for a collection of UTXOs
   * @param {Array} utxos - Array of classified UTXOs
   * @returns {Object} Summary statistics
   */
  getUtxoSummary (utxos) {
    try {
      const summary = {
        total: utxos.length,
        byType: {},
        byCategory: {},
        health: {
          healthy: 0,
          dust: 0,
          suspicious: 0,
          unknown: 0
        },
        xec: {
          total: 0,
          pure: 0,
          lockedInTokens: 0
        },
        tokens: {
          utxoCount: 0,
          uniqueTokens: new Set(),
          mintBatons: 0
        }
      }

      for (const utxo of utxos) {
        const type = utxo.utxoType || 'unknown'
        const category = utxo.display?.category || 'unknown'
        const healthStatus = utxo.health?.status || 'unknown'

        // Count by type
        summary.byType[type] = (summary.byType[type] || 0) + 1

        // Count by category
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1

        // Count by health
        summary.health[healthStatus] = (summary.health[healthStatus] || 0) + 1

        // XEC amounts
        const xecAmount = utxo.value?.xecAmount || (utxo.value / this.SATS_PER_XEC) || 0
        summary.xec.total += xecAmount

        if (category === 'tokens') {
          summary.xec.lockedInTokens += xecAmount
          summary.tokens.utxoCount += 1

          if (utxo.tokenInfo?.tokenId) {
            summary.tokens.uniqueTokens.add(utxo.tokenInfo.tokenId)
          }

          if (utxo.tokenInfo?.isMintBaton) {
            summary.tokens.mintBatons += 1
          }
        } else {
          summary.xec.pure += xecAmount
        }
      }

      // Convert Set to count
      summary.tokens.uniqueTokens = summary.tokens.uniqueTokens.size

      return summary
    } catch (err) {
      console.warn('Warning: Could not generate UTXO summary:', err.message)
      return {
        total: utxos.length,
        error: err.message
      }
    }
  }
}

export default UtxoClassifier
