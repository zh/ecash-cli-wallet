/*
  Get comprehensive information about an eToken including genesis data, metadata, and protocol details.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class ETokenInfo {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getTokenInfo = this.getTokenInfo.bind(this)
    this.displayTokenInfo = this.displayTokenInfo.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      const walletName = flags.name
      console.log(`Getting token information from wallet '${walletName}' for token: ${flags.tokenId}...\\n`)

      // Get token information with wallet context
      const tokenInfo = await this.getTokenInfo(flags.tokenId, walletName)

      // Display token information
      this.displayTokenInfo(tokenInfo, walletName)

      return true
    } catch (err) {
      console.error('Error getting token info:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if token ID not specified
    const tokenId = flags.tokenId
    if (!tokenId || tokenId === '') {
      throw new Error('You must specify a token ID with the -t flag.')
    }

    // Basic token ID format validation
    if (typeof tokenId !== 'string' || tokenId.length !== 64) {
      throw new Error('Token ID must be a 64-character hex string.')
    }

    return true
  }

  // Get comprehensive token information
  async getTokenInfo (tokenId, walletName) {
    try {
      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(walletName)

      // Get analytics options to ensure proper hdPath usage
      const analyticsOptions = await this.walletUtil.getAnalyticsOptions(walletName)

      // Create wallet instance for token data access
      const wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic, analyticsOptions)
      await wallet.walletInfoPromise
      await wallet.initialize()

      // Get token data using hybrid tokens manager
      const tokenData = await wallet.hybridTokens.getTokenData(tokenId)

      // Get basic eToken data
      const eTokenData = await wallet.getETokenData(tokenId).catch(() => null)

      // Get wallet's token balance for this specific token
      const tokenBalance = await wallet.getETokenBalance({ tokenId })

      return {
        tokenId,
        tokenData,
        eTokenData,
        tokenBalance,
        walletAddress: wallet.walletInfo.xecAddress
      }
    } catch (err) {
      throw new Error(`Failed to get token information: ${err.message}`)
    }
  }

  // Display comprehensive token information
  displayTokenInfo (tokenInfo, walletName) {
    try {
      const { tokenId, tokenData, eTokenData, tokenBalance, walletAddress } = tokenInfo

      console.log('='.repeat(80))
      console.log(`eToken Information (Wallet: ${walletName})`)
      console.log('='.repeat(80))
      console.log()

      // Wallet Context
      console.log('Wallet Context:')
      console.log(`   Wallet Name: ${walletName}`)
      console.log(`   Wallet Address: ${walletAddress}`)
      console.log()

      // Basic token information (from eCash blockchain)
      console.log('Token Information:')
      console.log(`   Token ID: ${tokenId}`)
      console.log(`   Protocol: ${tokenData.protocol || 'Unknown'}`)
      console.log(`   Type: ${tokenData.type || 'Unknown'}`)
      console.log(`   Ticker: ${tokenData.ticker || 'Unknown'}`)
      console.log(`   Name: ${tokenData.name || 'Unknown Token'}`)
      console.log(`   Decimals: ${tokenData.decimals || 0}`)
      console.log(`   Document URL: ${tokenData.url || 'N/A'}`)

      // Wallet Balance for this token
      console.log()
      console.log('Wallet Balance:')
      if (tokenBalance && tokenBalance.balance) {
        console.log(`   Current Balance: ${tokenBalance.balance.display} ${tokenData.ticker || 'tokens'}`)
        console.log(`   Raw Balance (atoms): ${tokenBalance.balance.atoms}`)
        console.log(`   UTXO Count: ${tokenBalance.utxoCount || 0}`)
      } else {
        console.log(`   Current Balance: 0 ${tokenData.ticker || 'tokens'}`)
        console.log('   (No tokens found in this wallet)')
      }

      console.log()

      // Raw token data for debugging
      if (eTokenData) {
        console.log('Raw Token Data:')
        console.log(`   ${JSON.stringify(eTokenData, null, 2)}`)
        console.log()
      }

      // Commands
      console.log('Related Commands:')
      console.log(`   Transaction history: node xec-wallet.js etoken-tx-history -n ${walletName} -t ${tokenId}`)
      console.log(`   Send tokens: node xec-wallet.js send-etokens -n ${walletName} -t ${tokenId} -a <address> -q <amount>`)
      console.log(`   Check balance: node xec-wallet.js wallet-balance -n ${walletName}`)

      console.log()
      console.log('='.repeat(80))

      return true
    } catch (err) {
      throw new Error(`Failed to display token info: ${err.message}`)
    }
  }
}

export default ETokenInfo
