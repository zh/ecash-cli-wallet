/*
  Sweep XEC from a WIF private key to a destination address.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletSweep {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.checkBalance = this.checkBalance.bind(this)
    this.sweepFunds = this.sweepFunds.bind(this)
    this.validateWif = this.validateWif.bind(this)
    this.validateWallet = this.validateWallet.bind(this)
  }

  async run (flags) {
    try {
      await this.validateFlags(flags)

      console.log(`Sweeping funds from WIF to wallet '${flags.name}'...\n`)

      // Create temporary wallet from WIF
      const sourceWallet = new this.MinimalXecWallet(flags.wif)
      await sourceWallet.walletInfoPromise

      // Check balance
      const balanceData = await this.checkBalance(sourceWallet)

      if (flags.balanceOnly) {
        console.log('Balance check completed.')
        return true
      }

      if (balanceData.total === 0) {
        console.log('No funds to sweep. Address has zero balance.')
        return true
      }

      // Perform the sweep
      const txid = await this.sweepFunds(sourceWallet, flags, balanceData)

      console.log('Transaction sent successfully!')
      console.log(`TXID: ${txid}`)
      console.log()
      console.log('View this transaction on block explorers:')
      console.log(`https://explorer.e.cash/tx/${txid}`)
      console.log(`https://3xpl.com/ecash/transaction/${txid}`)

      return true
    } catch (err) {
      console.error('Error sweeping funds:', err.message)
      return 0
    }
  }

  async validateFlags (flags = {}) {
    // Exit if WIF not specified
    if (!flags.wif || flags.wif === '') {
      throw new Error('You must specify a WIF private key with the -w flag.')
    }

    // Exit if destination wallet name not specified (unless balance-only)
    if (!flags.balanceOnly && (!flags.name || flags.name === '')) {
      throw new Error('You must specify a destination wallet name with the -n flag.')
    }

    // Validate WIF format
    this.validateWif(flags.wif)

    // Validate destination wallet exists if provided
    if (flags.name) {
      await this.validateWallet(flags.name)
    }

    // Validate quantity if specified
    if (flags.qty) {
      const amount = parseFloat(flags.qty)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Quantity must be a positive number.')
      }
    }

    return true
  }

  validateWif (wif) {
    try {
      if (!wif || typeof wif !== 'string') {
        throw new Error('WIF must be a non-empty string')
      }

      // Check WIF format - should start with K, L, 5 (mainnet) or c, 9 (testnet)
      const startsWithWifChar = ['K', 'L', '5', 'c', '9'].includes(wif[0])
      const isWifLength = wif.length === 51 || wif.length === 52

      // Also allow 64-character hex private keys
      const isHex = wif.length === 64 && /^[a-fA-F0-9]+$/.test(wif)

      if (!startsWithWifChar && !isWifLength && !isHex) {
        throw new Error('Invalid WIF format. Must be 51-52 characters starting with K/L/5/c/9 or 64-character hex string.')
      }

      return true
    } catch (err) {
      throw new Error(`Invalid WIF: ${err.message}`)
    }
  }

  async validateWallet (walletName) {
    try {
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('Wallet name must be a non-empty string')
      }

      // Check if wallet exists
      const exists = await this.walletUtil.walletExists(walletName)
      if (!exists) {
        throw new Error(`Wallet '${walletName}' does not exist`)
      }

      return true
    } catch (err) {
      throw new Error(`Invalid wallet: ${err.message}`)
    }
  }

  async checkBalance (wallet) {
    try {
      await wallet.initialize()

      // Get detailed balance information
      const balance = await wallet.getDetailedBalance()
      const address = wallet.walletInfo.xecAddress

      console.log(`Source Address: ${address}`)
      console.log()
      console.log('XEC Balance:')
      console.log(`   Confirmed: ${balance.confirmed.toLocaleString()} XEC`)
      console.log(`   Unconfirmed: ${balance.unconfirmed.toLocaleString()} XEC`)
      console.log(`   Total: ${balance.total.toLocaleString()} XEC`)
      console.log()

      return balance
    } catch (err) {
      throw new Error(`Failed to get balance: ${err.message}`)
    }
  }

  async sweepFunds (sourceWallet, flags, balanceData) {
    try {
      if (balanceData.total < 0.01) {
        throw new Error('Insufficient funds for transaction fees. Minimum 0.01 XEC required.')
      }

      // Load destination wallet to get its address
      const destWalletData = await this.walletUtil.loadWallet(flags.name)
      const destAddress = destWalletData.wallet.xecAddress

      console.log(`Destination address: ${destAddress}`)

      let txid

      if (flags.qty) {
        // Send specific amount
        const amountToSend = parseFloat(flags.qty)

        if (amountToSend > balanceData.total) {
          throw new Error(
            `Insufficient funds. Trying to send ${amountToSend} XEC, but only ${balanceData.total} XEC available.`
          )
        }

        // Convert XEC to satoshis (XEC uses 2 decimal places)
        const satoshis = Math.floor(amountToSend * 100)

        const outputs = [{
          address: destAddress,
          amountSat: satoshis
        }]

        txid = await sourceWallet.sendXec(outputs)
      } else {
        // Send all funds
        txid = await sourceWallet.sendAllXec(destAddress)
      }

      return txid
    } catch (err) {
      throw new Error(`Failed to sweep funds: ${err.message}`)
    }
  }
}

export default WalletSweep
