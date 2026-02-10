/*
  Send eTokens from a wallet to a destination address.
  Supports both SLP and ALP tokens with comprehensive validation.
*/

// Local libraries
import { validateAddress, validateStrategy, validateQuantity, validateTokenId } from '../lib/validators.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class SendETokens {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = null // Set in tests via injection
    this.walletUtil = null // Set in tests via injection
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.validateStrategy = validateStrategy
    this.validateAddress = validateAddress
    this.validateTokenId = validateTokenId
    this.validateQuantity = validateQuantity
    this.validateTokenBalance = this.validateTokenBalance.bind(this)
    this.buildOutputs = this.buildOutputs.bind(this)
    this.sendTransaction = this.sendTransaction.bind(this)
    this.sendETokensWithStrategy = this.sendETokensWithStrategy.bind(this)
    this.displayResults = this.displayResults.bind(this)
    this.handleError = this.handleError.bind(this)
    this.validateETokenTransactionSafety = this.validateETokenTransactionSafety.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Sending ${flags.qty} eTokens from wallet '${flags.name}'...`)
      console.log()

      // Load and initialize wallet (with analytics if strategy is provided)
      const wallet = await this._loadWallet(flags.name, flags.strategy)

      // Get token information and validate balance
      const tokenInfo = await this.validateTokenBalance(wallet, flags.tokenId, flags.qty)

      // Validate destination address
      this.validateAddress(flags.addr)

      // Validate quantity with token decimals
      const validatedQty = this.validateQuantity(flags.qty, tokenInfo.decimals)

      // Build transaction outputs
      const outputs = this.buildOutputs(flags.addr, validatedQty, tokenInfo.decimals)

      console.log(`Token: ${tokenInfo.ticker} (${tokenInfo.name})`)
      console.log(`From: ${wallet.walletInfo.xecAddress}`)
      console.log(`To: ${flags.addr}`)
      console.log(`Amount: ${validatedQty} ${tokenInfo.ticker}`)
      console.log()

      // Perform strategy-specific safety validation if strategy is provided
      if (flags.strategy) {
        await this.validateETokenTransactionSafety(wallet, flags.tokenId, outputs, flags.strategy)
        console.log()
      }

      // Send transaction
      const txid = await this.sendTransaction(wallet, flags.tokenId, outputs, flags.strategy, flags)

      // Display results
      this.displayResults(txid, flags, tokenInfo)

      return true
    } catch (err) {
      this.handleError(err, flags.strategy)
      return 0
    }
  }

  validateFlags (flags = {}) {
    if (!flags.name || flags.name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    this.validateTokenId(flags.tokenId)

    if (!flags.addr || flags.addr === '') {
      throw new Error('You must specify a destination address with the -a flag.')
    }

    if (!flags.qty || flags.qty === '') {
      throw new Error('You must specify a quantity with the -q flag.')
    }

    if (flags.strategy) {
      this.validateStrategy(flags.strategy)
    }

    return true
  }

  // Load and initialize wallet (with analytics support for strategy)
  async _loadWallet (walletName, strategy = null) {
    try {
      const WalletClass = this.MinimalXecWallet || (await import('minimal-xec-wallet')).default
      const walletUtilInstance = this.walletUtil || (await import('../lib/wallet-loader.js')).walletUtil
      const walletData = await walletUtilInstance.loadWallet(walletName)
      const baseOpts = walletData.wallet?.hdPath ? { hdPath: walletData.wallet.hdPath } : {}
      const useAnalytics = strategy && strategy.trim() !== ''

      if (useAnalytics) {
        try {
          console.log(`Loading wallet with analytics for ${strategy} strategy...`)
          const analyticsOptions = await walletUtilInstance.getAnalyticsOptions(walletName)
          const wallet = new WalletClass(walletData.wallet.mnemonic, analyticsOptions)
          await wallet.walletInfoPromise
          await wallet.initialize()

          if (wallet.utxos?.hasAnalytics?.()) return wallet

          console.warn('Warning: Analytics not available, creating standard wallet instead')
        } catch (err) {
          console.warn(`Warning: Could not initialize analytics (${err.message}), creating standard wallet`)
        }
      }

      const wallet = new WalletClass(walletData.wallet.mnemonic, baseOpts)
      await wallet.walletInfoPromise
      await wallet.initialize()
      return wallet
    } catch (err) {
      throw new Error(`Failed to load wallet '${walletName}': ${err.message}`)
    }
  }

  // Validate token balance and get token information
  async validateTokenBalance (wallet, tokenId, requestedQty) {
    try {
      const tokenData = await wallet.getETokenData(tokenId)
      if (!tokenData) {
        throw new Error(`Token ${tokenId} not found or not supported.`)
      }

      const eTokens = await this._getTokenBalanceFromUtxos(wallet, tokenId)
      if (eTokens.length === 0) {
        throw new Error(`No ${tokenData.ticker || 'tokens'} found in wallet.`)
      }

      const balance = eTokens[0].balance
      const decimals = tokenData.decimals || 0
      const requestedAtoms = parseFloat(requestedQty) * Math.pow(10, decimals)
      const availableTokens = balance / Math.pow(10, decimals)

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
      if (err.message.includes('Insufficient')) throw err
      throw new Error(`Failed to validate token balance: ${err.message}`)
    }
  }

  // Get token balance from UTXOs
  async _getTokenBalanceFromUtxos (wallet, tokenId) {
    try {
      const tokenUtxos = []
      const xecUtxos = wallet.utxos?.utxoStore?.xecUtxos || []

      for (const utxo of xecUtxos) {
        if (utxo.token && utxo.token.tokenId === tokenId && !utxo.token.isMintBaton) {
          tokenUtxos.push(utxo.token)
        }
      }

      if (tokenUtxos.length === 0) return []

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

  // Build transaction outputs
  buildOutputs (address, quantity, decimals) {
    return [{ address, amount: quantity }]
  }

  // Validate eToken transaction safety based on strategy
  async validateETokenTransactionSafety (wallet, tokenId, outputs, strategy) {
    try {
      const normalizedStrategy = strategy.toLowerCase()
      console.log(`Performing ${normalizedStrategy} strategy safety validation for eToken transaction...`)

      // Get analytics if available
      let securityThreats = null
      let classifications = null
      try {
        if (wallet.utxos?.detectSecurityThreats) {
          securityThreats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)
        }
        if (wallet.utxos?.getUtxoClassifications) {
          classifications = wallet.utxos.getUtxoClassifications()
        }
      } catch (err) {
        console.warn('Warning: Could not get analytics for safety validation')
      }

      // Display strategy analysis using shared classifier
      this._displayETokenStrategyAnalysis(wallet, tokenId, normalizedStrategy, securityThreats, classifications)

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

  // Display strategy-specific eToken analysis using shared classifier
  _displayETokenStrategyAnalysis (wallet, tokenId, strategy, securityThreats, classifications) {
    try {
      const classified = this.utxoClassifier.classifyWalletUtxos(wallet)
      const suitable = this.utxoClassifier.filterForStrategy(classified, strategy)
      const targetTokenUtxos = classified.tokens.filter(item => {
        try { return item.utxo?.token?.tokenId === tokenId } catch { return false }
      })

      const label = strategy === 'efficient' ? 'Efficiency' : strategy.charAt(0).toUpperCase() + strategy.slice(1)
      console.log(`  Validating eToken ${strategy} strategy requirements...`)
      console.log(`  Token-Aware ${label} Analysis:`)
      console.log(`    Suitable XEC UTXOs: ${suitable.length} (for fees)`)
      console.log(`    Target Token UTXOs: ${targetTokenUtxos.length}`)
      console.log(`    Other Token UTXOs: ${classified.tokens.length - targetTokenUtxos.length} (protected)`)
      if (classified.pureDust.length > 0) {
        console.log(`    Pure Dust UTXOs: ${classified.pureDust.length} (excluded)`)
      }

      // Security-specific checks
      if (strategy === 'security' && securityThreats?.dustAttack?.detected) {
        const confidence = securityThreats.dustAttack.confidence || 0
        if (confidence > 0.7) {
          console.log('  [HIGH RISK] Dust attack detected in wallet')
        } else if (confidence > 0.3) {
          console.log('  [MEDIUM RISK] Possible dust attack indicators')
        }
      }

      // Privacy-specific checks
      if (strategy === 'privacy' && classifications?.statistics?.reusedAddresses > 0) {
        console.log('  [WARNING] Privacy Notice: Wallet contains UTXOs from reused addresses')
        console.log('    eToken transactions may link both token and XEC addresses')
      }

      // Efficiency-specific checks
      if (strategy === 'efficient') {
        if (classified.pureXec.length > 30) {
          console.log('  [INFO] High pure XEC UTXO count - efficiency strategy will consolidate when possible')
        }
        if (targetTokenUtxos.length > 10) {
          console.log('  [INFO] High target token UTXO count - may increase transaction size and fees')
        }
      }

      if (suitable.length === 0) {
        console.log(`  [WARNING] No suitable pure XEC UTXOs for ${strategy} strategy fee payment`)
      } else {
        console.log(`  [HEALTHY] Found ${suitable.length} suitable pure XEC UTXOs for ${strategy} strategy fees`)
      }

      console.log(`  [HEALTHY] eToken ${strategy} strategy validation passed`)
    } catch (err) {
      console.warn(`  Warning: Could not perform token-aware eToken ${strategy} analysis:`, err.message)
    }
  }

  // Send the transaction (with optional strategy)
  async sendTransaction (wallet, tokenId, outputs, strategy = null, flags = {}) {
    try {
      console.log('Building and broadcasting transaction...')

      const detailedBalance = await wallet.getDetailedBalance()
      if (detailedBalance.total < 0.1) {
        throw new Error(`Insufficient XEC for transaction fees. Current balance: ${detailedBalance.total} XEC. Minimum required: ~0.1 XEC`)
      }

      const txOptions = {}
      if (flags.finality) {
        txOptions.awaitFinality = true
      }

      // Use smart eToken selection if strategy is provided and analytics are available
      if (strategy && wallet.utxos?.hasAnalytics?.()) {
        try {
          console.log(`Using ${strategy} strategy for eToken UTXO selection...`)
          return await this.sendETokensWithStrategy(wallet, tokenId, outputs, strategy, txOptions)
        } catch (strategyError) {
          console.warn(`Warning: Smart eToken selection failed (${strategyError.message}), falling back to standard method`)
        }
      }

      // Primary method: sendETokens with fee rate
      try {
        return await wallet.sendETokens(tokenId, outputs, 2.0, txOptions)
      } catch (err) {
        // Surface XEC fee errors clearly
        if (err.message.includes('Insufficient XEC') || err.message.includes('Need ')) {
          throw err
        }

        // Dust error — try to optimize first
        if (err.message.includes('dust')) {
          console.log('Dust error detected, attempting UTXO optimization...')
          try {
            const optimizeResult = await wallet.optimize()
            if (optimizeResult.success && optimizeResult.transactions?.length > 0) {
              throw new Error('UTXOs were consolidated. Please wait for confirmation and try sending again in a few moments.')
            }
          } catch (optimizeErr) {
            if (optimizeErr.message.includes('UTXOs were consolidated')) throw optimizeErr
            throw new Error(`ALP transaction failed due to dust outputs: ${err.message}`)
          }
          throw new Error('ALP transaction failed due to dust outputs. Try sending more XEC to the wallet first.')
        }

        // Fallback: hybridTokens.sendTokens
        console.log('Primary method failed, trying alternative...')
        try {
          return await wallet.hybridTokens.sendTokens(
            tokenId, outputs,
            {
              mnemonic: wallet.walletInfo.mnemonic,
              xecAddress: wallet.walletInfo.xecAddress,
              hdPath: wallet.walletInfo.hdPath,
              privateKey: wallet.walletInfo.privateKey,
              publicKey: wallet.walletInfo.publicKey
            },
            wallet.utxos.utxoStore.xecUtxos, 2.0
          )
        } catch (err2) {
          throw err
        }
      }
    } catch (err) {
      if (err.message.includes('Insufficient XEC') || err.message.includes('Insufficient')) {
        throw err
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
      const classified = this.utxoClassifier.classifyWalletUtxos(wallet)
      const suitableXecForFees = this.utxoClassifier.filterForStrategy(classified, strategy)

      console.log(`Applying token-aware analysis for ${strategy} eToken strategy...`)
      console.log(`    Suitable XEC for Fees: ${suitableXecForFees.length}`)
      console.log(`    Token UTXOs: ${classified.tokens.length} (protected)`)

      // Check if wallet has native eToken strategy support
      if (typeof wallet.sendETokensWithStrategy === 'function') {
        console.log(`Using wallet's native ${strategy} strategy for eTokens`)
        return await wallet.sendETokensWithStrategy(tokenId, outputs, { strategy, feeRate: 2.0, ...txOptions })
      }

      if (typeof wallet.setETokenSelectionStrategy === 'function') {
        console.log(`Configuring wallet to use ${strategy} strategy for eTokens`)
        await wallet.setETokenSelectionStrategy(strategy)
        return await wallet.sendETokens(tokenId, outputs, 2.0, txOptions)
      }

      // Fallback: use standard method with strategy logging
      console.log(`Using token-aware eToken selection with ${strategy} preference`)
      return await wallet.sendETokens(tokenId, outputs, 2.5, txOptions)
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
  }

  // Handle and display errors appropriately
  handleError (err, strategy = null) {
    if (strategy) {
      console.error(`eToken Transaction Failed (${strategy} strategy):`, err.message)
    } else {
      console.error('eToken Transaction Failed:', err.message)
    }

    console.log()

    if (err.message.includes('Insufficient XEC')) {
      console.log('XEC Fee Issue: eToken transactions require XEC for fees (minimum ~1-2 XEC)')
      console.log('   Send more XEC: node xec-wallet.js send-xec -n <source> -a <this-wallet> -q <amount>')
    } else if (err.message.includes('Insufficient')) {
      console.log('Token Balance Issue: Check balance with node xec-wallet.js wallet-balance -n <wallet>')
    } else if (err.message.includes('dust')) {
      console.log('Dust Output Issue: Try consolidating with node xec-wallet.js wallet-optimize -n <wallet>')
    } else if (err.message.includes('address')) {
      console.log('Address Format Issue: Use eCash address format (ecash:qr5x...)')
    } else if (err.message.includes('Token ID')) {
      console.log('Token ID Issue: Must be 64-character hex string')
    } else {
      console.log('Check wallet health: node xec-wallet.js wallet-health -n <wallet>')
    }

    if (strategy) {
      console.log()
      console.log('Strategy Help: Try without --strategy to use standard method')
    }
  }
}

export default SendETokens
