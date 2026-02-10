/*
  Send XEC to a given address.
*/

// Local libraries
import { validateAddress, validateAmount, validateStrategy } from '../lib/validators.js'
import UtxoClassifier from '../lib/utxo-classifier.js'

class SendXec {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = null // Set in tests via injection
    this.walletUtil = null // Set in tests via injection
    this.utxoClassifier = new UtxoClassifier()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.sendXec = this.sendXec.bind(this)
    this.validateAddress = validateAddress
    this.validateAmount = validateAmount
    this.validateStrategy = validateStrategy
    this.validateTransactionSafety = this.validateTransactionSafety.bind(this)
    this.sendXecWithStrategy = this.sendXecWithStrategy.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Sending ${flags.qty} XEC from wallet '${flags.name}' to ${flags.addr}...\n`)

      // Load wallet data
      const walletData = this.walletUtil
        ? await this.walletUtil.loadWallet(flags.name)
        : await (await import('../lib/wallet-loader.js')).walletUtil.loadWallet(flags.name)

      // Send XEC
      const txid = await this.sendXec(walletData, flags)

      console.log('Transaction sent successfully!')
      console.log(`TXID: ${txid}`)
      if (flags.finality) {
        console.log('Finality: CONFIRMED (Avalanche)')
      } else {
        console.log('Finality: Pending (~10 min for block confirmation)')
      }
      console.log()
      console.log('View this transaction on block explorers:')
      console.log(`https://explorer.e.cash/tx/${txid}`)
      console.log(`https://3xpl.com/ecash/transaction/${txid}`)

      return true
    } catch (err) {
      console.error('Error sending XEC:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    const addr = flags.addr
    if (!addr || addr === '') {
      throw new Error('You must specify a recipient address with the -a flag.')
    }

    const qty = flags.qty
    if (!qty || qty === '') {
      throw new Error('You must specify a quantity in XEC with the -q flag.')
    }

    this.validateAddress(addr)
    this.validateAmount(qty)

    if (flags.strategy) {
      this.validateStrategy(flags.strategy)
    }

    return true
  }

  // Send XEC using the wallet
  async sendXec (walletData, flags) {
    try {
      const useSmartSelection = flags.strategy && flags.strategy.trim() !== ''
      const WalletClass = this.MinimalXecWallet || (await import('minimal-xec-wallet')).default
      const walletUtilInstance = this.walletUtil || (await import('../lib/wallet-loader.js')).walletUtil
      const baseOpts = walletData.wallet?.hdPath ? { hdPath: walletData.wallet.hdPath } : {}

      let xecWallet

      if (useSmartSelection) {
        try {
          console.log(`Using ${flags.strategy} strategy for UTXO selection...`)
          const analyticsOptions = await walletUtilInstance.getAnalyticsOptions(flags.name)
          xecWallet = new WalletClass(walletData.wallet.mnemonic, analyticsOptions)
          await xecWallet.walletInfoPromise
          await xecWallet.initialize()

          if (!xecWallet.utxos?.hasAnalytics?.()) {
            console.warn('Warning: Analytics not available, falling back to standard UTXO selection')
            xecWallet = new WalletClass(walletData.wallet.mnemonic, baseOpts)
            await xecWallet.walletInfoPromise
            await xecWallet.initialize()
          }
        } catch (analyticsError) {
          console.warn(`Warning: Could not initialize analytics (${analyticsError.message}), falling back to standard selection`)
          xecWallet = new WalletClass(walletData.wallet.mnemonic, baseOpts)
          await xecWallet.walletInfoPromise
          await xecWallet.initialize()
        }
      } else {
        xecWallet = new WalletClass(walletData.wallet.mnemonic, baseOpts)
        await xecWallet.walletInfoPromise
        await xecWallet.initialize()
      }

      // Check wallet balance
      const balance = await xecWallet.getXecBalance()
      const amountToSend = parseFloat(flags.qty)

      if (balance < amountToSend) {
        throw new Error(
          `Insufficient funds. You are trying to send ${amountToSend} XEC, but the wallet only has ${balance} XEC`
        )
      }

      const satoshis = Math.floor(amountToSend * 100)
      const outputs = [{ address: flags.addr, amount: satoshis }]

      if (useSmartSelection) {
        await this.validateTransactionSafety(xecWallet, outputs, flags)
      }

      const txOptions = {}
      if (flags.finality) {
        txOptions.awaitFinality = true
        if (flags.finalityTimeout) {
          txOptions.finalityTimeout = parseInt(flags.finalityTimeout)
        }
      }

      let txid

      if (useSmartSelection && xecWallet.utxos?.hasAnalytics?.()) {
        try {
          const strategyOptions = {
            strategy: flags.strategy.toLowerCase(),
            feeRate: 1.0
          }
          console.log(`Selecting UTXOs using ${flags.strategy} strategy...`)
          txid = await this.sendXecWithStrategy(xecWallet, outputs, strategyOptions, txOptions)
          console.log(`Transaction built using ${flags.strategy} strategy`)
        } catch (smartSelectionError) {
          console.warn(`Warning: Smart selection failed (${smartSelectionError.message}), falling back to standard method`)
          txid = await xecWallet.sendXec(outputs, txOptions)
        }
      } else {
        txid = await xecWallet.sendXec(outputs, txOptions)
      }

      return txid
    } catch (err) {
      throw new Error(`Failed to send XEC: ${err.message}`)
    }
  }

  // Validate transaction safety based on strategy
  async validateTransactionSafety (wallet, outputs, flags) {
    try {
      const strategy = flags.strategy.toLowerCase()
      const totalAmount = outputs.reduce((sum, output) => sum + output.amount, 0)

      console.log(`Performing ${strategy} strategy safety validation...`)

      // Get security threat analysis if available
      let securityThreats = null
      try {
        if (wallet.utxos?.detectSecurityThreats) {
          securityThreats = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress)
        }
      } catch (err) {
        console.warn('Warning: Could not get security threat analysis')
      }

      // Display strategy analysis using shared classifier
      this.displayStrategyAnalysis(wallet, strategy)

      // Security-specific: check for dust attacks
      if (strategy === 'security' && securityThreats?.dustAttack?.detected) {
        const confidence = securityThreats.dustAttack.confidence || 0
        if (confidence > 0.7) {
          console.log('  [HIGH RISK] Potential dust attack detected')
          console.log('    Recommendation: Consider using wallet-security command for detailed analysis')
        } else if (confidence > 0.3) {
          console.log('  [MEDIUM RISK] Possible dust attack indicators detected')
        }
      }

      // Privacy-specific: check for address reuse
      if (strategy === 'privacy') {
        try {
          const classifications = wallet.utxos?.getUtxoClassifications?.()
          if (classifications?.statistics?.reusedAddresses > 0) {
            console.log('  [WARNING] Privacy Notice: Wallet contains UTXOs from reused addresses')
          }
        } catch { /* ignore */ }
      }

      // Efficiency-specific: fee analysis and UTXO count
      if (strategy === 'efficient') {
        const estimatedFee = 250
        const feePercentage = (estimatedFee / totalAmount) * 100
        console.log(`  Fee Analysis: ~${estimatedFee} satoshis (~${feePercentage.toFixed(1)}% of transaction)`)
        if (feePercentage > 5) {
          console.log(`  [WARNING] High fee ratio (~${feePercentage.toFixed(1)}%)`)
        }

        const totalUtxoCount = wallet.utxos?.utxoStore?.xecUtxos?.length || 0
        if (totalUtxoCount > 50) {
          console.log(`  [INFO] High UTXO count (${totalUtxoCount}) - consider using wallet-optimize command to consolidate`)
        }
      }

      // General high-value transaction validation
      const xecAmount = totalAmount / 100
      if (xecAmount > 1000) {
        console.log(`  Notice: Large transaction (${xecAmount} XEC) - please verify recipient address`)
      }

      const displayName = this._strategyLabel(strategy)
      console.log(`  [HEALTHY] ${displayName.charAt(0).toUpperCase() + displayName.slice(1)} strategy validation passed`)
      console.log('  Transaction safety validation completed')
      return true
    } catch (err) {
      throw new Error(`Transaction safety validation failed: ${err.message}`)
    }
  }

  // Get display label for a strategy (efficient → efficiency)
  _strategyLabel (strategy) {
    if (strategy === 'efficient') return 'efficiency'
    return strategy
  }

  // Display strategy-specific UTXO analysis
  displayStrategyAnalysis (wallet, strategy) {
    try {
      const classified = this.utxoClassifier.classifyWalletUtxos(wallet)
      const suitable = this.utxoClassifier.filterForStrategy(classified, strategy)

      const displayName = this._strategyLabel(strategy)
      const label = displayName.charAt(0).toUpperCase() + displayName.slice(1)
      console.log(`  Validating ${displayName} strategy requirements...`)
      console.log(`  Token-Aware ${label} Analysis:`)
      console.log(`    Suitable XEC UTXOs: ${suitable.length}`)
      console.log(`    Token UTXOs: ${classified.tokens.length} (protected)`)
      if (classified.pureDust.length > 0) {
        console.log(`    Pure Dust UTXOs: ${classified.pureDust.length} (excluded)`)
      }
      if (suitable.length === 0 && classified.all.length > 0) {
        console.log('  [WARNING] No suitable pure XEC UTXOs for this strategy')
      }
    } catch (err) {
      console.warn(`  Warning: Could not perform token-aware ${strategy} analysis:`, err.message)
    }
  }

  // Send XEC using smart UTXO selection strategy
  async sendXecWithStrategy (wallet, outputs, strategyOptions, txOptions = {}) {
    try {
      const classified = this.utxoClassifier.classifyWalletUtxos(wallet)
      const available = this.utxoClassifier.filterForStrategy(classified, strategyOptions.strategy)

      if (available.length === 0) {
        // No suitable UTXOs for strategy — fall back to standard
        if (classified.all.length === 0) {
          console.log('  [INFO] No UTXOs found for token-aware filtering - proceeding with standard method')
        }

        // Try wallet native methods first
        if (typeof wallet.sendXecWithStrategy === 'function') {
          console.log(`Using wallet's native ${strategyOptions.strategy} strategy without filtering`)
          return await wallet.sendXecWithStrategy(outputs, strategyOptions, txOptions)
        }
        if (typeof wallet.setUtxoSelectionStrategy === 'function') {
          console.log(`Configuring wallet to use ${strategyOptions.strategy} strategy`)
          await wallet.setUtxoSelectionStrategy(strategyOptions.strategy)
          return await wallet.sendXec(outputs, txOptions)
        }

        console.log(`Using analytics-influenced UTXO selection with ${strategyOptions.strategy} preference`)
        if (strategyOptions.strategy === 'privacy') {
          console.log('  Strategy focus: Minimizing address linking and transaction traceability')
        } else if (strategyOptions.strategy === 'security') {
          console.log('  Strategy focus: Avoiding potentially problematic UTXOs')
        } else if (strategyOptions.strategy === 'efficient') {
          console.log('  Strategy focus: Minimizing transaction fees and size')
        }
        return await wallet.sendXec(outputs, txOptions)
      }

      // Apply filtered UTXOs temporarily
      console.log(`Applying token-aware UTXO filtering for ${strategyOptions.strategy} strategy...`)
      console.log(`    Available Pure XEC UTXOs: ${available.length}`)
      console.log(`    Protected Token UTXOs: ${classified.tokens.length}`)

      const original = wallet.utxos.utxoStore.xecUtxos
      wallet.utxos.utxoStore.xecUtxos = available.map(i => i.utxo)

      try {
        if (typeof wallet.sendXecWithStrategy === 'function') {
          console.log(`Using wallet's native ${strategyOptions.strategy} strategy with token-aware filtering`)
          return await wallet.sendXecWithStrategy(outputs, strategyOptions, txOptions)
        }
        if (typeof wallet.setUtxoSelectionStrategy === 'function') {
          console.log(`Configuring wallet to use ${strategyOptions.strategy} strategy with token-aware filtering`)
          await wallet.setUtxoSelectionStrategy(strategyOptions.strategy)
          return await wallet.sendXec(outputs, txOptions)
        }

        console.log(`Using token-aware filtered UTXOs with ${strategyOptions.strategy} preference`)
        return await wallet.sendXec(outputs, txOptions)
      } finally {
        wallet.utxos.utxoStore.xecUtxos = original
      }
    } catch (err) {
      throw new Error(`Smart selection failed: ${err.message}`)
    }
  }
}

export default SendXec
