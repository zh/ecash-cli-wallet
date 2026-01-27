/*
  Send eTokens from a wallet to a destination address.
  Supports both SLP and ALP tokens with comprehensive validation.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class SendETokens {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.validateStrategy = this.validateStrategy.bind(this)
    this.loadWallet = this.loadWallet.bind(this)
    this.validateTokenBalance = this.validateTokenBalance.bind(this)
    this.validateDestination = this.validateDestination.bind(this)
    this.validateQuantity = this.validateQuantity.bind(this)
    this.validateETokenTransactionSafety = this.validateETokenTransactionSafety.bind(this)
    this.buildOutputs = this.buildOutputs.bind(this)
    this.sendTransaction = this.sendTransaction.bind(this)
    this.sendETokensWithStrategy = this.sendETokensWithStrategy.bind(this)
    this.displayResults = this.displayResults.bind(this)
    this.handleError = this.handleError.bind(this)
  }

  async run (flags) {
    try {
      // Step 1: Validate all inputs
      this.validateFlags(flags)

      console.log(`Sending ${flags.qty} eTokens from wallet '${flags.name}'...`)
      console.log()

      // Step 2: Load and initialize wallet (with analytics if strategy is provided)
      const wallet = await this.loadWallet(flags.name, flags.strategy)

      // Step 3: Get token information and validate balance
      const tokenInfo = await this.validateTokenBalance(wallet, flags.tokenId, flags.qty)

      // Step 4: Validate destination address
      this.validateDestination(flags.addr)

      // Step 5: Validate quantity with token decimals
      const validatedQty = this.validateQuantity(flags.qty, tokenInfo.decimals)

      // Step 6: Build transaction outputs
      const outputs = this.buildOutputs(flags.addr, validatedQty, tokenInfo.decimals)

      console.log(`Token: ${tokenInfo.ticker} (${tokenInfo.name})`)
      console.log(`From: ${wallet.walletInfo.xecAddress}`)
      console.log(`To: ${flags.addr}`)
      console.log(`Amount: ${validatedQty} ${tokenInfo.ticker}`)
      console.log()

      // Step 7: Perform strategy-specific safety validation if strategy is provided
      if (flags.strategy) {
        await this.validateETokenTransactionSafety(wallet, flags.tokenId, outputs, flags.strategy)
        console.log()
      }

      // Step 8: Send transaction
      const txid = await this.sendTransaction(wallet, flags.tokenId, outputs, flags.strategy, flags)

      // Step 9: Display results
      this.displayResults(txid, flags, tokenInfo)

      return true
    } catch (err) {
      this.handleError(err, flags.strategy)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    if (!flags.name || flags.name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if token ID not specified
    if (!flags.tokenId || flags.tokenId === '') {
      throw new Error('You must specify a token ID with the -t flag.')
    }

    // Validate token ID format (64 character hex string)
    if (typeof flags.tokenId !== 'string' || flags.tokenId.length !== 64) {
      throw new Error('Token ID must be a 64-character hex string.')
    }

    const hexPattern = /^[a-fA-F0-9]+$/
    if (!hexPattern.test(flags.tokenId)) {
      throw new Error('Token ID must contain only hexadecimal characters.')
    }

    // Exit if destination address not specified
    if (!flags.addr || flags.addr === '') {
      throw new Error('You must specify a destination address with the -a flag.')
    }

    // Exit if quantity not specified
    if (!flags.qty || flags.qty === '') {
      throw new Error('You must specify a quantity with the -q flag.')
    }

    // Validate strategy if provided (optional parameter)
    if (flags.strategy) {
      this.validateStrategy(flags.strategy)
    }

    return true
  }

  // Validate strategy parameter
  validateStrategy (strategy) {
    try {
      if (!strategy || typeof strategy !== 'string') {
        throw new Error('Strategy must be a non-empty string')
      }

      const validStrategies = ['efficient', 'privacy', 'security']
      const normalizedStrategy = strategy.toLowerCase().trim()

      if (!validStrategies.includes(normalizedStrategy)) {
        throw new Error(`Invalid strategy '${strategy}'. Valid strategies: ${validStrategies.join(', ')}`)
      }

      return true
    } catch (err) {
      throw new Error(`Invalid strategy: ${err.message}`)
    }
  }

  // Load and initialize wallet (with analytics support for strategy)
  async loadWallet (walletName, strategy = null) {
    try {
      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(walletName)

      // Determine if we should use analytics-enabled wallet
      const useAnalytics = strategy && strategy.trim() !== ''

      let wallet

      if (useAnalytics) {
        // Create wallet instance with analytics for smart coin selection
        try {
          console.log(`Loading wallet with analytics for ${strategy} strategy...`)

          // Get analytics options for this wallet
          const analyticsOptions = await this.walletUtil.getAnalyticsOptions(walletName)

          // Create wallet instance with analytics enabled
          wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic, analyticsOptions)
          await wallet.walletInfoPromise
          await wallet.initialize()

          // Verify analytics are available
          if (!wallet.utxos || !wallet.utxos.hasAnalytics || !wallet.utxos.hasAnalytics()) {
            console.warn('Warning: Analytics not available, creating standard wallet instead')
            // Fallback: recreate wallet without analytics
            wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
            await wallet.walletInfoPromise
            await wallet.initialize()
          }
        } catch (analyticsError) {
          console.warn(`Warning: Could not initialize analytics (${analyticsError.message}), creating standard wallet`)
          // Fallback: create wallet without analytics
          wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
          await wallet.walletInfoPromise
          await wallet.initialize()
        }
      } else {
        // Original behavior: create standard wallet instance
        wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
        await wallet.walletInfoPromise
        await wallet.initialize()
      }

      return wallet
    } catch (err) {
      throw new Error(`Failed to load wallet '${walletName}': ${err.message}`)
    }
  }

  // Validate token balance and get token information
  async validateTokenBalance (wallet, tokenId, requestedQty) {
    try {
      // Get token metadata
      const tokenData = await wallet.getETokenData(tokenId)
      if (!tokenData) {
        throw new Error(`Token ${tokenId} not found or not supported.`)
      }

      // Get current balance from UTXOs (most reliable method)
      const eTokens = await this.getTokenBalanceFromUtxos(wallet, tokenId)
      if (eTokens.length === 0) {
        throw new Error(`No ${tokenData.ticker || 'tokens'} found in wallet.`)
      }

      const balance = eTokens[0].balance

      // Convert requested amount to atoms (considering decimals)
      const decimals = tokenData.decimals || 0
      const requestedAtoms = parseFloat(requestedQty) * Math.pow(10, decimals)
      const availableTokens = balance / Math.pow(10, decimals)

      // Validate sufficient balance
      if (balance < requestedAtoms) {
        throw new Error(
          `Insufficient ${tokenData.ticker || 'token'} balance. ` +
          `Requested: ${requestedQty}, Available: ${availableTokens}`
        )
      }

      return {
        balance,
        decimals,
        ticker: tokenData.ticker || 'Unknown',
        name: tokenData.name || 'Unknown Token',
        protocol: tokenData.protocol || 'SLP'
      }
    } catch (err) {
      if (err.message.includes('Insufficient')) {
        throw err
      }
      throw new Error(`Failed to validate token balance: ${err.message}`)
    }
  }

  // Get token balance from UTXOs as fallback
  async getTokenBalanceFromUtxos (wallet, tokenId) {
    try {
      const tokenUtxos = []

      if (wallet.utxos && wallet.utxos.utxoStore && wallet.utxos.utxoStore.xecUtxos) {
        for (const utxo of wallet.utxos.utxoStore.xecUtxos) {
          if (utxo.token && utxo.token.tokenId === tokenId && !utxo.token.isMintBaton) {
            tokenUtxos.push(utxo.token)
          }
        }
      }

      if (tokenUtxos.length === 0) {
        return []
      }

      // Sum up token balance (handle BigInt values)
      let totalBalance = 0
      for (const token of tokenUtxos) {
        let atoms = 0
        if (typeof token.atoms === 'bigint') {
          atoms = Number(token.atoms)
        } else if (typeof token.atoms === 'string') {
          atoms = parseFloat(token.atoms)
        } else {
          atoms = parseFloat(token.atoms) || 0
        }
        totalBalance += atoms
      }

      return [{ balance: totalBalance }]
    } catch (err) {
      return []
    }
  }

  // Validate destination address
  validateDestination (address) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Address must be a non-empty string')
      }

      // Only allow eCash addresses (ecash: prefix)
      if (!address.startsWith('ecash:')) {
        throw new Error('Address must be an eCash address (ecash: prefix)')
      }

      // Basic format validation - eCash addresses are typically 42-60 characters
      if (address.length < 42 || address.length > 60) {
        throw new Error('Invalid eCash address length')
      }

      // Check for valid base32 characters after prefix
      const addressPart = address.substring(6) // Remove "ecash:" prefix
      if (!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(addressPart)) {
        throw new Error('Invalid eCash address format')
      }

      return true
    } catch (err) {
      throw new Error(`Invalid destination address: ${err.message}`)
    }
  }

  // Validate quantity with decimal precision
  validateQuantity (qty, decimals) {
    try {
      const amount = parseFloat(qty)

      if (isNaN(amount)) {
        throw new Error('Quantity must be a valid number')
      }

      if (amount <= 0) {
        throw new Error('Quantity must be greater than 0')
      }

      // Check decimal precision doesn't exceed token decimals
      const decimalPlaces = (qty.toString().split('.')[1] || '').length
      if (decimalPlaces > decimals) {
        throw new Error(`Too many decimal places. Token supports max ${decimals} decimals`)
      }

      // Minimum unit validation (1 atom)
      const atoms = amount * Math.pow(10, decimals)
      if (atoms < 1) {
        const minAmount = 1 / Math.pow(10, decimals)
        throw new Error(`Amount too small. Minimum: ${minAmount}`)
      }

      return amount
    } catch (err) {
      throw new Error(`Invalid quantity: ${err.message}`)
    }
  }

  // Validate eToken transaction safety based on strategy
  async validateETokenTransactionSafety (wallet, tokenId, outputs, strategy) {
    try {
      console.log(`Performing ${strategy.toLowerCase()} strategy safety validation for eToken transaction...`)

      // Get both XEC and token analytics if available
      let securityThreats = null
      let classifications = null

      try {
        if (wallet.utxos && wallet.utxos.detectSecurityThreats) {
          securityThreats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)
        }
        if (wallet.utxos && wallet.utxos.getUtxoClassifications) {
          classifications = wallet.utxos.getUtxoClassifications()
        }
      } catch (err) {
        console.warn('Warning: Could not get analytics for safety validation')
      }

      // Strategy-specific validation
      switch (strategy.toLowerCase()) {
        case 'security':
          await this.validateETokenSecurityStrategy(wallet, tokenId, outputs, securityThreats)
          break
        case 'privacy':
          await this.validateETokenPrivacyStrategy(wallet, tokenId, outputs, classifications)
          break
        case 'efficient':
          await this.validateETokenEfficiencyStrategy(wallet, tokenId, outputs)
          break
        default:
          console.log('  General eToken safety validation passed')
      }

      // General eToken transaction validation
      const totalTokenAmount = outputs.reduce((sum, output) => sum + output.amount, 0)
      console.log(`  Validated eToken transaction: ${totalTokenAmount} tokens`)

      // Check XEC fee requirements
      const detailedBalance = await wallet.getDetailedBalance()
      if (detailedBalance.total < 0.01) {
        console.log('  ⚠️  WARNING: Very low XEC balance for transaction fees')
        console.log('    eToken transactions require more XEC for fees than regular transactions')
      }

      console.log('  eToken transaction safety validation completed')
      return true
    } catch (err) {
      throw new Error(`eToken transaction safety validation failed: ${err.message}`)
    }
  }

  // Security strategy validation for eTokens
  async validateETokenSecurityStrategy (wallet, tokenId, outputs, securityThreats) {
    console.log('  Validating eToken security strategy requirements...')

    // Check for dust attacks affecting both XEC and token UTXOs
    if (securityThreats && securityThreats.dustAttack && securityThreats.dustAttack.detected) {
      const confidence = securityThreats.dustAttack.confidence || 0
      if (confidence > 0.7) {
        console.log('  [HIGH RISK] Dust attack detected in wallet')
        console.log('    This affects both XEC and token UTXOs - security strategy will avoid risky UTXOs')
      } else if (confidence > 0.3) {
        console.log('  [MEDIUM RISK] Possible dust attack indicators')
        console.log('    Security strategy will prefer safer XEC UTXOs for fees')
      }
    }

    // eToken-specific security concerns with token-aware analysis
    try {
      // Get UTXOs and apply token-aware classification
      const xecUtxos = wallet.utxos?.utxoStore?.xecUtxos || []
      const classifiedUtxos = []

      // Classify UTXOs with token awareness
      for (const utxo of xecUtxos) {
        try {
          const originalClassification = wallet.utxos?.analytics?.classifier?.classifyUtxo?.(utxo) || {}
          const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, originalClassification)
          classifiedUtxos.push({
            utxo,
            enhancedClassification,
            hasToken: enhancedClassification.hasToken,
            isPureDust: enhancedClassification.isPureDust,
            utxoType: enhancedClassification.utxoType
          })
        } catch (err) {
          // Skip UTXOs that can't be classified
          continue
        }
      }

      // Filter for suitable XEC UTXOs (excluding token UTXOs and pure dust)
      const suitableXecUtxos = classifiedUtxos.filter(item => {
        // Exclude token UTXOs (they're locked for token data)
        if (item.hasToken) return false

        // Exclude pure dust
        if (item.isPureDust) return false

        // For security strategy, prefer larger UTXOs for fees
        return item.utxo.value > 1000 // > 10 XEC
      })

      // Also identify token UTXOs for reference
      const tokenUtxos = classifiedUtxos.filter(item => item.hasToken)

      if (suitableXecUtxos.length === 0) {
        console.log('  [WARNING] No suitable pure XEC UTXOs available for secure fee payment')
        console.log('    Security strategy requires clean XEC UTXOs for transaction fees')
        console.log('    (Token UTXOs are excluded as they contain valuable token data)')
        console.log('    Consider receiving more XEC or consolidating pure XEC UTXOs')
      } else {
        console.log(`  [HEALTHY] Found ${suitableXecUtxos.length} suitable pure XEC UTXOs for secure fee payment`)
        if (tokenUtxos.length > 0) {
          console.log(`  [INFO] Note: ${tokenUtxos.length} token UTXOs excluded from fee payment (contain valuable tokens)`)
        }
      }
    } catch (err) {
      console.warn('  Warning: Could not analyze XEC UTXO security with token awareness:', err.message)
    }

    console.log('  [HEALTHY] eToken security strategy validation passed')
  }

  // Privacy strategy validation for eTokens
  async validateETokenPrivacyStrategy (wallet, tokenId, outputs, classifications) {
    console.log('  Validating eToken privacy strategy requirements...')

    try {
      // Token-aware privacy analysis
      const xecUtxos = wallet.utxos?.utxoStore?.xecUtxos || []
      const classifiedUtxos = []

      // Classify UTXOs with token awareness
      for (const utxo of xecUtxos) {
        try {
          const originalClassification = wallet.utxos?.analytics?.classifier?.classifyUtxo?.(utxo) || {}
          const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, originalClassification)
          classifiedUtxos.push({
            utxo,
            enhancedClassification,
            hasToken: enhancedClassification.hasToken,
            isPureDust: enhancedClassification.isPureDust,
            utxoType: enhancedClassification.utxoType
          })
        } catch (err) {
          // Skip UTXOs that can't be classified
          continue
        }
      }

      // Separate analysis for XEC vs token UTXOs
      const pureXecUtxos = classifiedUtxos.filter(item => !item.hasToken)
      const tokenUtxos = classifiedUtxos.filter(item => item.hasToken)
      const pureDustUtxos = classifiedUtxos.filter(item => item.isPureDust)

      if (classifications && classifications.statistics) {
        const stats = classifications.statistics
        if (stats.reusedAddresses && stats.reusedAddresses > 0) {
          console.log('  [WARNING] Privacy Notice: Wallet contains UTXOs from reused addresses')
          console.log('    eToken transactions may link both token and XEC addresses')
        }
      }

      // Token-aware privacy analysis
      console.log('  Token-Aware Privacy Analysis:')
      console.log(`    Pure XEC UTXOs: ${pureXecUtxos.length} (can be used freely for privacy)`)
      console.log(`    Token UTXOs: ${tokenUtxos.length} (linked to token identity)`)
      if (pureDustUtxos.length > 0) {
        console.log(`    Pure Dust UTXOs: ${pureDustUtxos.length} (may compromise privacy)`)
      }

      // Privacy strategy guidance
      if (tokenUtxos.length > 5) {
        console.log('  [INFO] High token UTXO count may compromise privacy through transaction linking')
        console.log('    Privacy strategy will minimize token UTXO usage when possible')
      }

      // eToken-specific privacy considerations
      console.log('  [INFO] Privacy considerations for eToken transactions:')
      console.log('    - Token UTXOs are inherently linked to token identity')
      console.log('    - Pure XEC UTXOs offer better privacy for change outputs')
      console.log('    - Consider fresh receiving addresses for enhanced privacy')
    } catch (err) {
      console.warn('  Warning: Could not perform detailed eToken privacy validation')
    }

    console.log('  [HEALTHY] eToken privacy strategy validation passed')
  }

  // Efficiency strategy validation for eTokens
  async validateETokenEfficiencyStrategy (wallet, tokenId, outputs) {
    console.log('  Validating eToken efficiency strategy requirements...')

    try {
      // Token-aware efficiency analysis
      const xecUtxos = wallet.utxos?.utxoStore?.xecUtxos || []
      const classifiedUtxos = []

      // Classify UTXOs with token awareness
      for (const utxo of xecUtxos) {
        try {
          const originalClassification = wallet.utxos?.analytics?.classifier?.classifyUtxo?.(utxo) || {}
          const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, originalClassification)
          classifiedUtxos.push({
            utxo,
            enhancedClassification,
            hasToken: enhancedClassification.hasToken,
            isPureDust: enhancedClassification.isPureDust,
            utxoType: enhancedClassification.utxoType
          })
        } catch (err) {
          // Skip UTXOs that can't be classified
          continue
        }
      }

      // Separate analysis for different UTXO types
      const pureXecUtxos = classifiedUtxos.filter(item => !item.hasToken)
      const tokenUtxos = classifiedUtxos.filter(item => item.hasToken)
      const pureDustUtxos = classifiedUtxos.filter(item => item.isPureDust)
      const targetTokenUtxos = tokenUtxos.filter(item => {
        try {
          return item.utxo?.token?.tokenId === tokenId
        } catch (err) {
          return false
        }
      })

      console.log('  Token-Aware Efficiency Analysis:')
      console.log(`    Pure XEC UTXOs: ${pureXecUtxos.length} (available for fees and consolidation)`)
      console.log(`    Target Token UTXOs: ${targetTokenUtxos.length} (for this transaction)`)
      console.log(`    Other Token UTXOs: ${tokenUtxos.length - targetTokenUtxos.length} (locked in other tokens)`)
      if (pureDustUtxos.length > 0) {
        console.log(`    Pure Dust UTXOs: ${pureDustUtxos.length} (inefficient - consider consolidation)`)
      }

      // Efficiency recommendations based on token-aware analysis
      if (pureXecUtxos.length > 30) {
        console.log('  [INFO] High pure XEC UTXO count - efficiency strategy will consolidate when possible')
        console.log('    This will improve future transaction efficiency without affecting tokens')
      }

      if (targetTokenUtxos.length > 10) {
        console.log('  [INFO] High target token UTXO count - may increase transaction size and fees')
        console.log('    Consider consolidating token UTXOs in a separate transaction')
      }

      if (pureXecUtxos.length < 3) {
        console.log('  [WARNING] Low pure XEC UTXO count - may limit fee payment options')
        console.log('    Token UTXOs cannot be used for fees - need more pure XEC UTXOs')
        console.log('    Consider receiving pure XEC (not token transactions) to improve efficiency')
      }

      if (pureDustUtxos.length > 5) {
        console.log('  [WARNING] High pure dust UTXO count affects efficiency')
        console.log('    Recommend using wallet-security command to analyze and consolidate dust')
      }

      // Fee efficiency analysis
      const estimatedFeeXec = 0.01 // eToken transactions typically need higher fees
      console.log(`  Estimated transaction fee: ${estimatedFeeXec} XEC (eToken transactions require more fees)`)
    } catch (err) {
      console.warn('  Warning: Could not perform detailed efficiency validation')
    }

    console.log('  [HEALTHY] eToken efficiency strategy validation passed')
  }

  // Build transaction outputs
  buildOutputs (address, quantity, decimals) {
    try {
      // Use quantity directly (not converted to atoms) as shown in minimal-xec-wallet examples
      // The wallet API expects the display amount, not atoms
      const outputs = [{
        address,
        amount: quantity
      }]

      return outputs
    } catch (err) {
      throw new Error(`Failed to build transaction outputs: ${err.message}`)
    }
  }

  // Send the transaction (with optional strategy)
  async sendTransaction (wallet, tokenId, outputs, strategy = null, flags = {}) {
    try {
      console.log('Building and broadcasting transaction...')

      // Check XEC balance first - get detailed balance for better debugging
      const detailedBalance = await wallet.getDetailedBalance()
      const xecBalance = detailedBalance.total

      if (xecBalance < 0.1) {
        throw new Error(`Insufficient XEC for transaction fees. Current balance: ${xecBalance} XEC. Minimum required: ~0.1 XEC`)
      }

      // Build transaction options for finality
      const txOptions = {}
      if (flags.finality) {
        txOptions.awaitFinality = true
      }

      // Use smart eToken selection if strategy is provided and analytics are available
      if (strategy && wallet.utxos && wallet.utxos.hasAnalytics && wallet.utxos.hasAnalytics()) {
        try {
          console.log(`Using ${strategy} strategy for eToken UTXO selection...`)
          return await this.sendETokensWithStrategy(wallet, tokenId, outputs, strategy, txOptions)
        } catch (strategyError) {
          console.warn(`Warning: Smart eToken selection failed (${strategyError.message}), falling back to standard method`)
          // Continue with standard methods below
        }
      }

      // Try multiple approaches for both SLP and ALP tokens

      // Method 1: Try wallet.sendETokens with fee rate (primary method)
      try {
        // Use higher fee rate to help with UTXO selection and change calculation
        const txid = await wallet.sendETokens(tokenId, outputs, 2.0, txOptions)
        return txid
      } catch (err) {
        // Check for specific errors - catch insufficient XEC errors that are deeply nested
        if (err.message.includes('Insufficient XEC') || err.message.includes('Need ') || err.message.includes('have ')) {
          // Extract the actual requirement from the error message
          const needMatch = err.message.match(/Need (\d+) sats/)
          const haveMatch = err.message.match(/have (\d+) from tokens/)

          if (needMatch && haveMatch) {
            const needXec = parseInt(needMatch[1]) / 100
            const haveXec = parseInt(haveMatch[1]) / 100

            throw new Error(`❌ TOKEN SEND FAILED: Insufficient pure XEC for transaction fees.\n\nRequired: ${needXec} XEC for fees\nAvailable: ${haveXec} XEC in pure XEC UTXOs\nLocked: ${(xecBalance - haveXec).toFixed(2)} XEC in token UTXOs\n\n💡 Solutions:\n   1. Send 15+ XEC to wallet: node xec-wallet.js send-xec (from external wallet)\n   2. Or use wallet.optimize() to consolidate UTXOs\n\n⚠️  eToken transactions need pure XEC UTXOs for fees!`)
          } else {
            throw new Error(`❌ TOKEN SEND FAILED: ${err.message}`)
          }
        }

        if (err.message.includes('dust')) {
          // This is likely an ALP dust issue - try to consolidate first
          console.log('Dust error detected, attempting UTXO optimization...')

          try {
            const optimizeResult = await wallet.optimize()
            if (optimizeResult.success && optimizeResult.transactions && optimizeResult.transactions.length > 0) {
              throw new Error('UTXOs were consolidated. Please wait for confirmation and try sending again in a few moments.')
            } else {
              throw new Error('ALP transaction failed due to dust outputs. The wallet needs larger XEC UTXOs. Try sending more XEC to the wallet first.')
            }
          } catch (optimizeErr) {
            throw new Error(`ALP transaction failed due to dust outputs: ${err.message}. Consolidation attempt also failed: ${optimizeErr.message}`)
          }
        }

        console.log('Primary method failed, trying alternative...')

        // Method 2: Fallback to hybridTokens.sendTokens
        // Note: hybridTokens.sendTokens expects different signature: (tokenId, outputs, walletInfo, utxos, satsPerByte)
        try {
          const txid = await wallet.hybridTokens.sendTokens(
            tokenId,
            outputs,
            {
              mnemonic: wallet.walletInfo.mnemonic,
              xecAddress: wallet.walletInfo.xecAddress,
              hdPath: wallet.walletInfo.hdPath,
              privateKey: wallet.walletInfo.privateKey,
              publicKey: wallet.walletInfo.publicKey
            },
            wallet.utxos.utxoStore.xecUtxos,
            2.0
          )
          return txid
        } catch (err2) {
          // Both methods failed, throw the most relevant error
          if (err.message.includes('dust')) {
            throw new Error(`Token transaction failed due to dust outputs. This can happen with ALP tokens when UTXOs are too small. Try sending more XEC to the wallet first: ${err.message}`)
          }
          throw err
        }
      }
    } catch (err) {
      if (err.message.includes('Insufficient XEC')) {
        throw err // Pass through XEC fee errors as-is
      } else if (err.message.includes('Insufficient')) {
        throw new Error(`Insufficient funds: ${err.message}`)
      } else if (err.message.includes('UTXO')) {
        throw new Error(`Transaction building failed: ${err.message}. Try again in a few moments.`)
      } else {
        throw new Error(`Transaction failed: ${err.message}`)
      }
    }
  }

  // Send eTokens using smart UTXO selection strategy
  async sendETokensWithStrategy (wallet, tokenId, outputs, strategy, txOptions = {}) {
    try {
      // PHASE 5.2: Apply token-aware analysis for eToken transactions
      console.log(`Applying token-aware analysis for ${strategy} eToken strategy...`)

      try {
        const xecUtxos = wallet.utxos?.utxoStore?.xecUtxos || []
        const classifiedUtxos = []

        // Classify UTXOs with token awareness
        for (const utxo of xecUtxos) {
          try {
            const originalClassification = wallet.utxos?.analytics?.classifier?.classifyUtxo?.(utxo) || {}
            const enhancedClassification = this.utxoClassifier.enhanceClassification(utxo, originalClassification)
            classifiedUtxos.push({
              utxo,
              enhancedClassification,
              hasToken: enhancedClassification.hasToken,
              isPureDust: enhancedClassification.isPureDust,
              utxoType: enhancedClassification.utxoType
            })
          } catch (err) {
            // Skip UTXOs that can't be classified
            continue
          }
        }

        // Analyze UTXO distribution for eToken transactions
        const pureXecUtxos = classifiedUtxos.filter(item => !item.hasToken)
        const tokenUtxos = classifiedUtxos.filter(item => item.hasToken)
        const targetTokenUtxos = tokenUtxos.filter(item => {
          try {
            return item.utxo?.token?.tokenId === tokenId
          } catch (err) {
            return false
          }
        })
        const pureDustUtxos = classifiedUtxos.filter(item => item.isPureDust)

        // Strategy-specific analysis and recommendations
        const suitableXecForFees = pureXecUtxos.filter(item => {
          if (item.isPureDust) return false

          if (strategy === 'security') {
            return item.utxo.value > 1000 // Require larger UTXOs for security
          } else if (strategy === 'efficient') {
            return item.utxo.value > 546 // Just above dust
          } else if (strategy === 'privacy') {
            return item.utxo.value > 1000 // Prefer larger UTXOs for privacy
          }

          return item.utxo.value > 546
        })

        console.log('  Token-Aware eToken Analysis:')
        console.log(`    Target Token UTXOs: ${targetTokenUtxos.length} (for spending ${tokenId})`)
        console.log(`    Other Token UTXOs: ${tokenUtxos.length - targetTokenUtxos.length} (other tokens - protected)`)
        console.log(`    Pure XEC UTXOs: ${pureXecUtxos.length} (available for fees)`)
        console.log(`    Suitable XEC for Fees: ${suitableXecForFees.length} (strategy-filtered)`)

        if (pureDustUtxos.length > 0) {
          console.log(`    Pure Dust UTXOs: ${pureDustUtxos.length} (excluded from strategy)`)
        }

        // Strategy-specific warnings and guidance
        if (targetTokenUtxos.length === 0) {
          throw new Error(`No token UTXOs found for token ${tokenId}. Cannot send tokens you don't have.`)
        }

        if (suitableXecForFees.length === 0) {
          console.log(`  [WARNING] No suitable pure XEC UTXOs for ${strategy} strategy fee payment`)
          console.log(`    ${strategy} strategy requires clean XEC UTXOs for transaction fees`)
          console.log(`    Available pure XEC UTXOs: ${pureXecUtxos.length} (may be too small or dusty)`)
          console.log('    Consider receiving more XEC or using a different strategy')

          // Still attempt transaction but warn user
        } else {
          console.log(`  [HEALTHY] Found ${suitableXecForFees.length} suitable pure XEC UTXOs for ${strategy} strategy fees`)
        }
      } catch (analysisError) {
        console.warn(`Warning: Token-aware analysis failed (${analysisError.message}), proceeding with standard method`)
      }

      const strategyOptions = {
        strategy: strategy.toLowerCase(),
        feeRate: 2.0, // eTokens typically need higher fee rates
        tokenId,
        tokenAwareAnalyzed: true // Flag to indicate token-aware analysis was performed
      }

      console.log(`Configuring ${strategy} strategy for eToken transaction...`)

      // Check if wallet has native eToken strategy support
      if (wallet.sendETokensWithStrategy && typeof wallet.sendETokensWithStrategy === 'function') {
        console.log(`Using wallet's native ${strategy} strategy for eTokens with token-aware analysis`)
        return await wallet.sendETokensWithStrategy(tokenId, outputs, { ...strategyOptions, ...txOptions })
      }

      // Check if wallet supports strategy configuration for eTokens
      if (wallet.setETokenSelectionStrategy && typeof wallet.setETokenSelectionStrategy === 'function') {
        console.log(`Configuring wallet to use ${strategy} strategy for eTokens with token-aware guidance`)
        await wallet.setETokenSelectionStrategy(strategy)
        return await wallet.sendETokens(tokenId, outputs, 2.0, txOptions)
      }

      // Fallback: Use analytics-influenced selection with token-aware analysis
      console.log(`Using token-aware eToken selection with ${strategy} preference`)

      // Log strategy-specific behavior with token awareness
      if (strategy === 'privacy') {
        console.log('  Strategy focus: Minimizing linking between token and XEC addresses')
        console.log('  Token-aware: Protecting non-target token UTXOs from privacy compromise')
      } else if (strategy === 'security') {
        console.log('  Strategy focus: Using secure pure XEC UTXOs for fees')
        console.log('  Token-aware: Protecting all token UTXOs from security risks')
      } else if (strategy === 'efficient') {
        console.log('  Strategy focus: Optimizing transaction size and fee cost')
        console.log('  Token-aware: Using most efficient pure XEC UTXOs for fees')
      }

      // Try the primary method with enhanced fee rate for token-aware strategy-based transactions
      try {
        const txid = await wallet.sendETokens(tokenId, outputs, 2.5, txOptions) // Higher fee for strategy-based selection
        console.log(`Transaction completed using token-aware ${strategy} strategy`)
        return txid
      } catch (err) {
        // If primary method fails, try the fallback method
        console.log(`Primary method failed, trying hybrid method with token-aware ${strategy} consideration...`)

        const txid = await wallet.hybridTokens.sendTokens(
          tokenId,
          outputs,
          {
            mnemonic: wallet.walletInfo.mnemonic,
            xecAddress: wallet.walletInfo.xecAddress,
            hdPath: wallet.walletInfo.hdPath,
            privateKey: wallet.walletInfo.privateKey,
            publicKey: wallet.walletInfo.publicKey
          },
          wallet.utxos.utxoStore.xecUtxos,
          2.5 // Higher fee rate for strategy-based selection
        )

        console.log(`Transaction completed using hybrid method with ${strategy} strategy`)
        return txid
      }
    } catch (err) {
      throw new Error(`eToken strategy transaction failed: ${err.message}`)
    }
  }

  // Display successful transaction results
  displayResults (txid, flags, tokenInfo) {
    console.log('Transaction sent successfully!')
    console.log()
    console.log('Transaction Details:')
    console.log(`   TXID: ${txid}`)
    console.log(`   From Wallet: ${flags.name}`)
    console.log(`   To Address: ${flags.addr}`)
    console.log(`   Amount: ${flags.qty} ${tokenInfo.ticker}`)
    console.log(`   Token: ${tokenInfo.name} (${tokenInfo.protocol})`)
    if (flags.finality) {
      console.log('   Finality: CONFIRMED (Avalanche)')
    } else {
      console.log('   Finality: Pending (~10 min for block confirmation)')
    }
    console.log()
    console.log('View this transaction on block explorers:')
    console.log(`   https://explorer.e.cash/tx/${txid}`)
    console.log(`   https://3xpl.com/ecash/transaction/${txid}`)
    console.log()
    console.log('Commands:')
    console.log(`   Check balance: node xec-wallet.js wallet-balance -n ${flags.name}`)
    console.log(`   Token info: node xec-wallet.js etoken-info -t ${flags.tokenId}`)
  }

  // Handle and display errors appropriately (with strategy-specific guidance)
  handleError (err, strategy = null) {
    // Display strategy context if applicable
    if (strategy) {
      console.error(`eToken Transaction Failed (${strategy} strategy):`, err.message)
    } else {
      console.error('eToken Transaction Failed:', err.message)
    }

    console.log()

    if (err.message.includes('Insufficient XEC')) {
      console.log('💰 XEC Fee Issue:')
      console.log('   - eToken transactions require XEC for fees')
      console.log('   - Minimum recommended: 1-2 XEC for reliable transactions')
      console.log('   - Send more XEC: node xec-wallet.js send-xec -n <source> -a <this-wallet> -q <amount>')

      if (strategy === 'security') {
        console.log()
        console.log('🔒 Security Strategy Guidance:')
        console.log('   - Security strategy requires clean XEC UTXOs for fees')
        console.log('   - Consider consolidating UTXOs: node xec-wallet.js wallet-optimize -n <wallet>')
        console.log('   - Check for dust attacks: node xec-wallet.js wallet-security -n <wallet>')
      } else if (strategy === 'efficient') {
        console.log()
        console.log('⚡ Efficiency Strategy Guidance:')
        console.log('   - Try optimizing UTXOs first: node xec-wallet.js wallet-optimize -n <wallet>')
        console.log('   - Efficiency strategy needs consolidated XEC UTXOs')
      }
    } else if (err.message.includes('Insufficient')) {
      console.log('🪙 Token Balance Issue:')
      console.log('   - Check token balance: node xec-wallet.js wallet-balance -n <wallet>')
      console.log('   - Verify token ID: node xec-wallet.js etoken-info -t <token-id>')

      if (strategy === 'privacy') {
        console.log()
        console.log('🔒 Privacy Strategy Guidance:')
        console.log('   - Privacy strategy may avoid certain token UTXOs')
        console.log('   - Check UTXO distribution: node xec-wallet.js wallet-classify -n <wallet>')
      }
    } else if (err.message.includes('dust')) {
      console.log('💨 Dust Output Issue:')
      console.log('   - ALP tokens are sensitive to small UTXOs')
      console.log('   - Try consolidating first: node xec-wallet.js wallet-optimize -n <wallet>')
      console.log('   - Send larger XEC amounts to create bigger UTXOs')

      if (strategy === 'efficient') {
        console.log()
        console.log('⚡ Efficiency Strategy Note:')
        console.log('   - Efficiency strategy automatically tries to avoid dust issues')
        console.log('   - This error suggests underlying UTXO structure problems')
      }
    } else if (err.message.includes('strategy') || err.message.includes('analytics')) {
      console.log('📊 Analytics/Strategy Issue:')
      console.log('   - Analytics may not be enabled for this wallet')
      console.log('   - Enable analytics: node xec-wallet.js config analytics-enable --wallet <wallet>')
      console.log('   - Try without strategy: omit --strategy parameter')
      console.log()
      console.log('🔄 Fallback Options:')
      console.log('   - Transaction should fallback to standard method automatically')
      console.log('   - If error persists, run without --strategy parameter')
    } else if (err.message.includes('address')) {
      console.log('📧 Address Format Issue:')
      console.log('   - Use eCash address format: ecash:qr5x...')
      console.log('   - Double-check the destination address')

      if (strategy === 'security') {
        console.log()
        console.log('🔒 Security Strategy Note:')
        console.log('   - Security strategy validates addresses more strictly')
        console.log('   - Ensure address is from a trusted source')
      }
    } else if (err.message.includes('Token ID')) {
      console.log('🏷️  Token ID Issue:')
      console.log('   - Token ID must be 64-character hex string')
      console.log('   - Check available tokens: node xec-wallet.js wallet-balance -n <wallet>')
      console.log('   - Get token info: node xec-wallet.js etoken-info -t <token-id>')
    } else if (err.message.includes('quantity') || err.message.includes('decimal')) {
      console.log('🔢 Quantity Issue:')
      console.log('   - Use positive numbers only')
      console.log('   - Check decimal precision: node xec-wallet.js etoken-info -t <token-id>')
      console.log('   - Respect token\'s decimal places')
    } else {
      console.log('❌ General Transaction Issue:')
      console.log('   - Check wallet health: node xec-wallet.js wallet-health -n <wallet>')
      console.log('   - Verify network connectivity')
      console.log('   - Ensure wallet has sufficient XEC (1-2 XEC minimum)')

      if (strategy) {
        console.log()
        console.log('🔄 Strategy Troubleshooting:')
        console.log('   - Try without strategy: omit --strategy parameter')
        console.log('   - Check analytics status: node xec-wallet.js config analytics-status')
        console.log(`   - Current strategy: ${strategy}`)
        console.log('   - Available strategies: efficient, privacy, security')
      }
    }

    // Always show general help for strategy transactions
    if (strategy) {
      console.log()
      console.log('📚 Strategy Help:')
      console.log('   - Security: Avoids risky UTXOs, uses clean XEC for fees')
      console.log('   - Privacy: Minimizes address linking between token/XEC UTXOs')
      console.log('   - Efficient: Optimizes transaction size and fee costs')
      console.log('   - Remove --strategy to use standard (non-analytics) method')
    }
  }
}

export default SendETokens
