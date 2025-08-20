/*
  Send XEC to a given address.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class SendXec {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.sendXec = this.sendXec.bind(this)
    this.validateAddress = this.validateAddress.bind(this)
    this.validateAmount = this.validateAmount.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Sending ${flags.qty} XEC from wallet '${flags.name}' to ${flags.addr}...\n`)

      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(flags.name)
      
      // Send XEC
      const txid = await this.sendXec(walletData, flags)

      console.log('Transaction sent successfully!')
      console.log(`TXID: ${txid}`)
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
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if address not specified
    const addr = flags.addr
    if (!addr || addr === '') {
      throw new Error('You must specify a recipient address with the -a flag.')
    }

    // Exit if quantity not specified
    const qty = flags.qty
    if (!qty || qty === '') {
      throw new Error('You must specify a quantity in XEC with the -q flag.')
    }

    // Validate address format
    this.validateAddress(addr)

    // Validate amount
    this.validateAmount(qty)

    return true
  }

  validateAddress (address) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Address must be a non-empty string')
      }

      // Only allow eCash addresses (ecash: prefix)
      if (!address.startsWith('ecash:')) {
        throw new Error('Address must be an eCash address (ecash: prefix)')
      }

      // Basic format validation - eCash addresses are typically 48 characters
      if (address.length < 40 || address.length > 60) {
        throw new Error('Invalid eCash address length')
      }

      // Check for valid base32 characters after prefix
      const addressPart = address.substring(6) // Remove "ecash:" prefix
      if (!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(addressPart)) {
        throw new Error('Invalid eCash address format')
      }

      return true
    } catch (err) {
      throw new Error(`Invalid address: ${err.message}`)
    }
  }

  validateAmount (amount) {
    try {
      const numAmount = parseFloat(amount)

      if (isNaN(numAmount)) {
        throw new Error('Amount must be a valid number')
      }

      if (numAmount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      if (numAmount < 5.46) {
        throw new Error('Amount must be at least 5.46 XEC (546 satoshis - dust limit)')
      }

      return true
    } catch (err) {
      throw new Error(`Invalid amount: ${err.message}`)
    }
  }

  // Send XEC using the wallet
  async sendXec (walletData, flags) {
    try {
      // Create wallet instance from stored mnemonic
      const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
      await xecWallet.walletInfoPromise

      // Initialize to get UTXOs
      await xecWallet.initialize()

      // Check wallet balance
      const balance = await xecWallet.getXecBalance()
      const amountToSend = parseFloat(flags.qty)

      if (balance < amountToSend) {
        throw new Error(
          `Insufficient funds. You are trying to send ${amountToSend} XEC, but the wallet only has ${balance} XEC`
        )
      }

      // Convert XEC to satoshis (XEC uses 2 decimal places, so multiply by 100)
      const satoshis = Math.floor(amountToSend * 100)

      // Create output object
      const outputs = [{
        address: flags.addr,
        amount: satoshis
      }]

      // Send the transaction
      const txid = await xecWallet.sendXec(outputs)

      return txid
    } catch (err) {
      throw new Error(`Failed to send XEC: ${err.message}`)
    }
  }
}

export default SendXec