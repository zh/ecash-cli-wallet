/*
  Optimize wallet by consolidating UTXOs to improve transaction efficiency.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletOptimize {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.optimizeWallet = this.optimizeWallet.bind(this)
    this.displayPreOptimizationAnalysis = this.displayPreOptimizationAnalysis.bind(this)
    this.displayOptimizationResults = this.displayOptimizationResults.bind(this)
    this.formatUtxoDistribution = this.formatUtxoDistribution.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      const action = flags.dryRun ? 'Analyzing optimization plan' : 'Optimizing'
      console.log(`${action} for wallet '${flags.name}'...\n`)

      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(flags.name)

      // Perform optimization
      const results = await this.optimizeWallet(walletData, flags)

      // Display results
      await this.displayOptimizationResults(results, flags)

      return true
    } catch (err) {
      console.error('Error optimizing wallet:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // dry-run flag is optional and defaults to false
    return true
  }

  // Optimize wallet using the existing ConsolidateUtxos functionality
  async optimizeWallet (walletData, flags) {
    try {
      // Create wallet instance from stored mnemonic
      const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
      await xecWallet.walletInfoPromise

      // Initialize to get UTXOs
      await xecWallet.initialize()

      // Display pre-optimization analysis
      await this.displayPreOptimizationAnalysis(xecWallet)

      // Run optimization with dry-run flag
      const optimizationResults = await xecWallet.optimize(flags.dryRun || false)

      return {
        wallet: xecWallet,
        results: optimizationResults,
        dryRun: flags.dryRun || false
      }
    } catch (err) {
      throw new Error(`Failed to optimize wallet: ${err.message}`)
    }
  }

  // Display pre-optimization analysis
  async displayPreOptimizationAnalysis (wallet) {
    try {
      console.log('Pre-Optimization Analysis:')
      console.log('='.repeat(50))

      // Get UTXO distribution using the consolidation library
      const utxoDistribution = wallet.consolidateUtxos.getUtxoDistribution()
      console.log(`Total UTXOs: ${utxoDistribution.total}`)
      console.log(this.formatUtxoDistribution(utxoDistribution))

      // Get optimization savings estimate
      const savingsEstimate = wallet.consolidateUtxos.estimateOptimizationSavings()
      console.log('\nOptimization Potential:')
      console.log(`   Current pure XEC UTXOs: ${savingsEstimate.currentUtxos}`)
      console.log(`   Optimal UTXOs: ${savingsEstimate.optimalUtxos}`)
      console.log(`   Estimated savings: ${savingsEstimate.savings} satoshis`)

      if (savingsEstimate.tokenUtxos > 0) {
        console.log(`   Token UTXOs preserved: ${savingsEstimate.tokenUtxos}`)
      }

      if (savingsEstimate.savings > 0) {
        console.log(`   Benefit: Will save ${savingsEstimate.savings} sats in future transaction fees`)
      } else {
        console.log('   Note: Optimization may not provide immediate fee savings')
      }

      console.log()
      return true
    } catch (err) {
      console.warn('Warning: Could not display pre-optimization analysis:', err.message)
      return false
    }
  }

  // Format UTXO distribution for display
  formatUtxoDistribution (distribution) {
    const lines = []
    lines.push(`   Dust UTXOs (<1000 sats): ${distribution.dust}`)
    lines.push(`   Small UTXOs (1K-10K sats): ${distribution.small}`)
    lines.push(`   Medium UTXOs (10K-100K sats): ${distribution.medium}`)
    lines.push(`   Large UTXOs (>100K sats): ${distribution.large}`)

    // Show token UTXO information for awareness
    if (distribution.tokenUtxos > 0) {
      lines.push(`   Token UTXOs (preserved): ${distribution.tokenUtxos}`)
    }

    // Calculate fragmentation level (only for pure XEC UTXOs)
    if (distribution.total > 0) {
      const fragmentationLevel = (distribution.dust + distribution.small) / distribution.total
      const fragmentationPercent = (fragmentationLevel * 100).toFixed(1)
      lines.push(`   Fragmentation level: ${fragmentationPercent}% (dust + small UTXOs)`)
    }

    return lines.join('\n')
  }

  // Display optimization results
  async displayOptimizationResults (optimizationData, flags) {
    try {
      const { results, dryRun } = optimizationData

      console.log('Optimization Results:')
      console.log('='.repeat(50))

      if (!results.success) {
        console.log(`FAILED - Optimization failed: ${results.message}`)
        return false
      }

      console.log(`SUCCESS - ${results.message}`)

      // Display analysis data
      if (results.analysis) {
        console.log('\nAnalysis:')
        console.log(`   Pure XEC UTXOs analyzed: ${results.analysis.totalUtxos}`)
        console.log(`   Total value: ${(results.analysis.totalValue / 100).toLocaleString()} XEC`)

        if (results.analysis.tokenUtxos > 0) {
          console.log(`   Token UTXOs preserved: ${results.analysis.tokenUtxos}`)
        }

        if (results.analysis.consolidationFee) {
          console.log(`   Consolidation fee: ${results.analysis.consolidationFee} satoshis`)
        }

        if (results.analysis.potentialSavings) {
          const savings = results.analysis.potentialSavings
          console.log(`   Future fee savings: ${savings} satoshis`)
        }
      }

      // Display transaction details
      if (results.transactions && results.transactions.length > 0) {
        console.log(`\n${dryRun ? 'Planned' : 'Executed'} Transactions:`)

        results.transactions.forEach((tx, index) => {
          console.log(`   Transaction ${index + 1}:`)

          if (dryRun) {
            // Dry run - show planned transaction details
            console.log(`     Inputs: ${tx.inputCount} UTXOs`)
            console.log(`     Input value: ${(tx.totalInputValue / 100).toLocaleString()} XEC`)
            console.log(`     Output value: ${(tx.outputValue / 100).toLocaleString()} XEC`)
            console.log(`     Estimated fee: ${tx.estimatedFee} satoshis`)
          } else {
            // Actual execution - show results
            if (tx.success) {
              console.log(`     SUCCESS - TXID: ${tx.txid}`)
              console.log(`     Consolidated: ${tx.inputCount} UTXOs -> 1 UTXO`)
              console.log(`     Value: ${(tx.outputValue / 100).toLocaleString()} XEC`)
              console.log(`     Fee: ${tx.fee} satoshis`)
              console.log(`     Explorer: https://explorer.e.cash/tx/${tx.txid}`)
            } else {
              console.log(`     FAILED: ${tx.error}`)
            }
          }
          console.log()
        })
      }

      // Display summary and next steps
      if (dryRun) {
        console.log('NOTE: This was a dry run - no transactions were broadcast.')
        console.log(`To execute: node xec-wallet.js wallet-optimize --name ${flags.name}`)
        console.log('TOKEN SAFETY: All tokens are safe - only pure XEC UTXOs will be consolidated.')
      } else {
        console.log('COMPLETE: Optimization completed!')
        console.log('Your wallet UTXOs have been consolidated for better transaction efficiency.')
        console.log('TOKEN SAFETY: All tokens remain safe and untouched.')
      }

      return true
    } catch (err) {
      throw new Error(`Failed to display optimization results: ${err.message}`)
    }
  }
}

export default WalletOptimize
