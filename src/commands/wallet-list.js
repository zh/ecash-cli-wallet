/*
  List all existing XEC wallets.
*/

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletList {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.displayWallets = this.displayWallets.bind(this)
  }

  async run (flags = {}) {
    try {
      console.log('Listing XEC wallets...\n')

      const wallets = await this.walletUtil.listWallets()
      
      if (wallets.length === 0) {
        console.log('No wallets found.')
        console.log('Create a new wallet with: node xec-wallet.js wallet-create -n <name>')
        return true
      }

      this.displayWallets(wallets)

      return true
    } catch (err) {
      console.error('Error listing wallets:', err.message)
      return 0
    }
  }

  displayWallets (wallets) {
    try {
      console.log(`Found ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}:\n`)
      
      wallets.forEach((wallet, index) => {
        console.log(`${index + 1}. ${wallet.name}`)
        console.log(`   Address: ${wallet.xecAddress}`)
        if (wallet.description) {
          console.log(`   Description: ${wallet.description}`)
        }
        console.log(`   Created: ${new Date(wallet.created).toLocaleDateString()}`)
        console.log()
      })

      console.log('Commands:')
      console.log('   Check balance: node xec-wallet.js wallet-balance -n <name>')
      console.log('   View addresses: node xec-wallet.js wallet-addrs -n <name> -q')
      console.log('   Send XEC: node xec-wallet.js send-xec -n <name> -a <address> -q <amount>')

      return true
    } catch (err) {
      throw new Error(`Failed to display wallets: ${err.message}`)
    }
  }
}

export default WalletList