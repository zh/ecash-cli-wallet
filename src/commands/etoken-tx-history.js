/*
  Get transaction history for an eToken, showing all transactions involving the token.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class ETokenTxHistory {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getTokenTxHistory = this.getTokenTxHistory.bind(this)
    this.displayTxHistory = this.displayTxHistory.bind(this)
    this.formatTransaction = this.formatTransaction.bind(this)
    this.formatDate = this.formatDate.bind(this)
    this.getTransactionType = this.getTransactionType.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      const walletName = flags.name
      console.log(`Getting transaction history from wallet '${walletName}' for token: ${flags.tokenId}...\n`)

      // Get token transaction history
      const txHistory = await this.getTokenTxHistory(flags.tokenId, walletName)

      // Display transaction history
      await this.displayTxHistory(txHistory, flags.tokenId, walletName)

      return true
    } catch (err) {
      console.error('Error getting token transaction history:', err.message)
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

  // Get transaction history for the token
  async getTokenTxHistory (tokenId, walletName) {
    try {
      // Load wallet data to get the address
      const walletData = await this.walletUtil.loadWallet(walletName)

      // Get analytics options to ensure proper hdPath usage
      const analyticsOptions = await this.walletUtil.getAnalyticsOptions(walletName)

      // Create wallet instance from stored data
      const wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic, analyticsOptions)
      await wallet.walletInfoPromise
      await wallet.initialize()

      // Get token metadata
      const tokenData = await wallet.getETokenData(tokenId)
      if (!tokenData) {
        throw new Error(`Token ${tokenId} not found or not supported`)
      }

      // Get general transaction history for the wallet
      const allTransactions = await wallet.getTransactions(wallet.walletInfo.xecAddress)

      // Filter transactions that involve this specific token
      const tokenTransactions = []

      // Get detailed transaction data to check for token entries
      for (const tx of allTransactions) {
        try {
          // Get detailed transaction data which includes tokenEntries
          const txData = await wallet.getTxData([tx.txid])
          const detailedTx = txData[0]

          if (detailedTx && detailedTx.tokenEntries && detailedTx.tokenEntries.length > 0) {
            const hasToken = detailedTx.tokenEntries.some(entry => entry.tokenId === tokenId)

            if (hasToken) {
              // Merge basic transaction info with detailed token data
              const mergedTx = {
                ...tx,
                tokenEntries: detailedTx.tokenEntries
              }
              tokenTransactions.push(mergedTx)
            }
          }
        } catch (err) {
          // Skip transactions that can't be fetched (silently)
        }
      }

      return {
        tokenData,
        transactions: tokenTransactions,
        walletAddress: wallet.walletInfo.xecAddress,
        wallet
      }
    } catch (err) {
      throw new Error(`Failed to get token transaction history: ${err.message}`)
    }
  }

  // Get transaction type based on token entries
  getTransactionType (tx, tokenId) {
    try {
      if (!tx.tokenEntries || tx.tokenEntries.length === 0) {
        return 'UNKNOWN'
      }

      // Find the token entry for our specific token
      const tokenEntry = tx.tokenEntries.find(entry => entry.tokenId === tokenId)
      if (!tokenEntry) {
        return 'UNKNOWN'
      }

      // Determine transaction type based on token entry
      if (tokenEntry.txType) {
        switch (tokenEntry.txType) {
          case 'GENESIS':
            return 'GENESIS'
          case 'MINT':
            return 'MINT'
          case 'SEND':
            return 'SEND'
          case 'BURN':
            return 'BURN'
          default:
            return 'UNKNOWN'
        }
      }

      // Fallback: analyze transaction structure
      if (tokenEntry.actualBurnAtoms && tokenEntry.actualBurnAtoms > 0n) {
        return 'BURN'
      }
      if (tokenEntry.intentionalBurnAtoms && tokenEntry.intentionalBurnAtoms > 0n) {
        return 'BURN'
      }

      // Check if this looks like genesis (usually first tx with this token ID)
      if (tokenEntry.amounts && tokenEntry.amounts.length === 1 && tx.block?.height) {
        // Could be genesis if it's creating new tokens
        return 'SEND' // Default to SEND for most token transactions
      }

      return 'SEND' // Default to SEND for token transactions
    } catch (err) {
      return 'UNKNOWN'
    }
  }

  // Format timestamp to readable date
  formatDate (timestamp) {
    if (!timestamp) return 'Unknown Date'

    try {
      const date = new Date(timestamp * 1000)
      return date.toISOString().replace('T', ' ').slice(0, 19)
    } catch (err) {
      return 'Invalid Date'
    }
  }

  // Format a single transaction for display
  async formatTransaction (tx, index, decimals = 0, tokenId, walletAddress, wallet) {
    try {
      const timestamp = tx.block?.timestamp || tx.timeFirstSeen
      const date = this.formatDate(timestamp)
      const type = this.getTransactionType(tx, tokenId)
      const txid = tx.txid || 'Unknown'
      const isConfirmed = tx.block !== null
      const status = isConfirmed ? '' : ' (pending)'

      let amount = 'tokens'
      let direction = ''
      const transactionDirection = await this.getTransactionDirection(tx, walletAddress, wallet)

      // Extract token-specific information from token entries
      if (tx.tokenEntries && tx.tokenEntries.length > 0) {
        const tokenEntry = tx.tokenEntries.find(entry => entry.tokenId === tokenId)

        if (tokenEntry) {
          // Get token amount from the entry
          let tokenAtoms = 0n

          if (tokenEntry.actualBurnAtoms && tokenEntry.actualBurnAtoms > 0n) {
            tokenAtoms = BigInt(tokenEntry.actualBurnAtoms)
            direction = 'BURNED'
            amount = (Number(tokenAtoms) / Math.pow(10, decimals)).toLocaleString()
          } else if (tokenEntry.intentionalBurnAtoms && tokenEntry.intentionalBurnAtoms > 0n) {
            tokenAtoms = BigInt(tokenEntry.intentionalBurnAtoms)
            direction = 'BURNED'
            amount = (Number(tokenAtoms) / Math.pow(10, decimals)).toLocaleString()
          } else if (tokenEntry.txType === 'SEND') {
            // Determine direction based on wallet involvement
            if (transactionDirection === 'RECEIVE') {
              direction = 'RECEIVED'
              amount = 'tokens'
            } else if (transactionDirection === 'SEND') {
              direction = 'SENT'
              amount = 'tokens'
            } else {
              direction = 'UNKNOWN'
              amount = 'tokens'
            }
          } else if (tokenEntry.txType === 'GENESIS') {
            direction = 'CREATED'
            amount = 'tokens'
          } else if (tokenEntry.txType === 'MINT') {
            direction = 'MINTED'
            amount = 'tokens'
          }
        }
      }

      // Format based on transaction type and direction
      let formattedTx = `${index + 1}.  ${date}  ${type.padEnd(8)}`

      if (type === 'GENESIS') {
        formattedTx += ` ${amount.padStart(12)} ${direction}`
      } else if (type === 'MINT') {
        formattedTx += ` ${amount.padStart(12)} ${direction}`
      } else if (type === 'SEND') {
        formattedTx += ` ${amount.padStart(12)} ${direction}`
      } else if (type === 'BURN') {
        formattedTx += ` ${amount.padStart(12)} ${direction}`
      } else {
        formattedTx += ` ${amount.padStart(12)} ${direction}`
      }

      formattedTx += `  ${txid.slice(0, 8)}...${status}`

      return formattedTx
    } catch (err) {
      return `${index + 1}.  Error formatting transaction: ${err.message}`
    }
  }

  // Determine transaction direction from wallet's perspective
  async getTransactionDirection (tx, walletAddress, wallet) {
    try {
      // Simple heuristic: Check if any outputs go to our wallet address
      // If yes, it's likely RECEIVE; if no outputs to us, it's likely SEND

      if (!tx.outputs || tx.outputs.length === 0) {
        return 'UNKNOWN'
      }

      let hasOutputToUs = false

      // Check each output to see if it goes to our wallet
      for (const output of tx.outputs) {
        if (output.outputScript) {
          try {
            // Try to decode the output script to see if it matches our address
            const walletHash = walletAddress.replace('ecash:', '')

            // For eCash P2PKH outputs, look for our address hash in the script
            if (output.outputScript.includes(walletHash)) {
              hasOutputToUs = true
              break
            }
          } catch (err) {
            // Skip this output if we can't decode it
            continue
          }
        }
      }

      // If transaction has outputs to us, it's likely someone sent tokens TO us
      if (hasOutputToUs) {
        return 'RECEIVE'
      } else {
        // No outputs to us, so we probably sent tokens FROM our wallet
        return 'SEND'
      }
    } catch (err) {
      return 'UNKNOWN'
    }
  }

  // Display transaction history
  async displayTxHistory (txHistory, tokenId, walletName) {
    try {
      const { tokenData, transactions, walletAddress, wallet } = txHistory

      console.log('='.repeat(100))
      console.log(`eToken Transaction History (Wallet: ${walletName})`)
      console.log('='.repeat(100))
      console.log()

      // Display wallet context
      console.log('Wallet Context:')
      console.log(`   Wallet Name: ${walletName}`)
      console.log(`   Wallet Address: ${walletAddress}`)
      console.log()

      // Display basic token info
      const ticker = tokenData?.ticker || 'Unknown'
      const name = tokenData?.name || 'Unknown Token'
      const protocol = tokenData?.protocol || 'Unknown'
      const decimals = tokenData?.decimals || 0

      console.log('Token Information:')
      console.log(`   Token: ${ticker} (${name})`)
      console.log(`   Protocol: ${protocol}`)
      console.log(`   Token ID: ${tokenId}`)
      console.log(`   Decimals: ${decimals}`)
      console.log()

      if (!transactions || transactions.length === 0) {
        console.log('No transaction history found for this token.')
        console.log()
        console.log('='.repeat(100))
        return true
      }

      console.log(`Total Transactions: ${transactions.length}`)
      console.log()
      console.log('Transaction History (newest first):')
      console.log()

      // Sort transactions by timestamp (newest first)
      const sortedTxs = [...transactions].sort((a, b) => {
        const timeA = a.block?.timestamp || a.timeFirstSeen || 0
        const timeB = b.block?.timestamp || b.timeFirstSeen || 0
        return timeB - timeA
      })

      // Display each transaction
      for (let i = 0; i < sortedTxs.length; i++) {
        const formattedTx = await this.formatTransaction(sortedTxs[i], i, decimals, tokenId, walletAddress, wallet)
        console.log(formattedTx)
      }

      console.log()

      // Enhanced summary statistics with direction analysis
      const genesisCount = transactions.filter(tx => this.getTransactionType(tx, tokenId) === 'GENESIS').length
      const mintCount = transactions.filter(tx => this.getTransactionType(tx, tokenId) === 'MINT').length
      const sendCount = transactions.filter(tx => this.getTransactionType(tx, tokenId) === 'SEND').length
      const burnCount = transactions.filter(tx => this.getTransactionType(tx, tokenId) === 'BURN').length

      // Count by direction for SEND transactions
      let sentCount = 0
      let receivedCount = 0

      for (const tx of transactions) {
        if (this.getTransactionType(tx, tokenId) === 'SEND') {
          const direction = await this.getTransactionDirection(tx, walletAddress, wallet)
          if (direction === 'SEND') {
            sentCount++
          } else if (direction === 'RECEIVE') {
            receivedCount++
          }
        }
      }

      console.log('Transaction Summary:')
      console.log(`   Genesis: ${genesisCount}`)
      console.log(`   Mint: ${mintCount}`)
      console.log(`   Transactions: ${sendCount} (${sentCount} sent, ${receivedCount} received)`)
      console.log(`   Burn: ${burnCount}`)

      console.log()

      // Related commands
      console.log('Related Commands:')
      console.log(`   Token info: node xec-wallet.js etoken-info -n ${walletName} -t ${tokenId}`)
      console.log(`   Send tokens: node xec-wallet.js send-etokens -n ${walletName} -t ${tokenId} -a <address> -q <amount>`)
      console.log(`   Check balance: node xec-wallet.js wallet-balance -n ${walletName}`)

      console.log()
      console.log('='.repeat(100))

      return true
    } catch (err) {
      throw new Error(`Failed to display transaction history: ${err.message}`)
    }
  }
}

export default ETokenTxHistory
