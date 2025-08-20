/*
  Create a new XEC wallet.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletCreate {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.createWallet = this.createWallet.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Creating wallet '${flags.name}'...`)

      // Check if wallet already exists
      if (await this.walletUtil.walletExists(flags.name)) {
        throw new Error(`Wallet '${flags.name}' already exists`)
      }

      const walletData = await this.createWallet(flags.name, flags.description)
      
      console.log('\nWallet created successfully!')
      console.log(`Name: ${flags.name}`)
      console.log(`Description: ${flags.description || '(none)'}`)
      console.log(`XEC Address: ${walletData.wallet.xecAddress}`)
      console.log(`\nIMPORTANT: Save your mnemonic phrase securely:`)
      console.log(`${walletData.wallet.mnemonic}`)
      console.log('\nYou can view your address and QR code with:')
      console.log(`node xec-wallet.js wallet-addrs -n ${flags.name} -q`)

      return walletData
    } catch (err) {
      console.error('Error creating wallet:', err.message)
      return 0
    }
  }

  validateFlags (flags) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Validate wallet name format
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Wallet name can only contain letters, numbers, underscores, and hyphens.')
    }

    return true
  }

  // Create a new wallet and save it to file
  async createWallet (walletName, description = '') {
    try {
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('Wallet name is required.')
      }

      // Create new XEC wallet instance
      const xecWallet = new this.MinimalXecWallet()
      await xecWallet.walletInfoPromise

      // Create wallet data structure
      const walletData = {
        wallet: {
          mnemonic: xecWallet.walletInfo.mnemonic,
          privateKey: xecWallet.walletInfo.privateKey,
          publicKey: xecWallet.walletInfo.publicKey,
          xecAddress: xecWallet.walletInfo.xecAddress,
          hdPath: xecWallet.walletInfo.hdPath
        },
        description: description || '',
        created: new Date().toISOString()
      }

      // Save wallet to file
      await this.walletUtil.saveWallet(walletName, walletData)

      return walletData
    } catch (err) {
      throw new Error(`Failed to create wallet: ${err.message}`)
    }
  }
}

export default WalletCreate