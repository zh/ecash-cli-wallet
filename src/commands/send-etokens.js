/*
  Send eTokens from a wallet to a destination address.
  Supports both SLP and ALP tokens with comprehensive validation.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class SendETokens {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.loadWallet = this.loadWallet.bind(this)
    this.validateTokenBalance = this.validateTokenBalance.bind(this)
    this.validateDestination = this.validateDestination.bind(this)
    this.validateQuantity = this.validateQuantity.bind(this)
    this.buildOutputs = this.buildOutputs.bind(this)
    this.sendTransaction = this.sendTransaction.bind(this)
    this.displayResults = this.displayResults.bind(this)
    this.handleError = this.handleError.bind(this)
  }

  async run (flags) {
    try {
      // Step 1: Validate all inputs
      this.validateFlags(flags)

      console.log(`Sending ${flags.qty} eTokens from wallet '${flags.name}'...`)
      console.log()

      // Step 2: Load and initialize wallet
      const wallet = await this.loadWallet(flags.name)

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

      // Step 7: Send transaction
      const txid = await this.sendTransaction(wallet, flags.tokenId, outputs)

      // Step 8: Display results
      this.displayResults(txid, flags, tokenInfo)

      return true
    } catch (err) {
      this.handleError(err)
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

    return true
  }

  // Load and initialize wallet
  async loadWallet (walletName) {
    try {
      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(walletName)

      // Create wallet instance from stored mnemonic
      const wallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
      await wallet.walletInfoPromise

      // Initialize to get UTXOs and balance
      await wallet.initialize()

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
        balance: balance,
        decimals: decimals,
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

  // Build transaction outputs
  buildOutputs (address, quantity, decimals) {
    try {
      // Use quantity directly (not converted to atoms) as shown in minimal-xec-wallet examples
      // The wallet API expects the display amount, not atoms
      const outputs = [{
        address: address,
        amount: quantity
      }]

      return outputs
    } catch (err) {
      throw new Error(`Failed to build transaction outputs: ${err.message}`)
    }
  }

  // Send the transaction
  async sendTransaction (wallet, tokenId, outputs) {
    try {
      console.log('Building and broadcasting transaction...')

      // Check XEC balance first - get detailed balance for better debugging
      const detailedBalance = await wallet.getDetailedBalance()
      const xecBalance = detailedBalance.total
      
      if (xecBalance < 0.1) {
        throw new Error(`Insufficient XEC for transaction fees. Current balance: ${xecBalance} XEC. Minimum required: ~0.1 XEC`)
      }

      // Try multiple approaches for both SLP and ALP tokens
      
      // Method 1: Try wallet.sendETokens with fee rate (primary method)
      try {
        // Use higher fee rate to help with UTXO selection and change calculation
        const txid = await wallet.sendETokens(tokenId, outputs, 2.0)
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
    console.log()
    console.log('View this transaction on block explorers:')
    console.log(`   https://explorer.e.cash/tx/${txid}`)
    console.log(`   https://3xpl.com/ecash/transaction/${txid}`)
    console.log()
    console.log('Commands:')
    console.log(`   Check balance: node xec-wallet.js wallet-balance -n ${flags.name}`)
    console.log(`   Token info: node xec-wallet.js etoken-info -t ${flags.tokenId}`)
  }

  // Handle and display errors appropriately
  handleError (err) {
    if (err.message.includes('Insufficient XEC')) {
      console.error('Insufficient XEC for Fees:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Send more XEC to your wallet for transaction fees')
      console.log('   - The wallet needs at least 1-2 XEC to cover eToken transaction fees')
      console.log('   - Check XEC balance with: node xec-wallet.js wallet-balance -n <wallet>')
    } else if (err.message.includes('Insufficient')) {
      console.error('Insufficient Balance:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Check your token balance with: node xec-wallet.js wallet-balance -n <wallet>')
      console.log('   - Verify you have enough of the specified token')
    } else if (err.message.includes('address')) {
      console.error('Invalid Address:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Use eCash address format: ecash:qr5x...')
      console.log('   - Double-check the destination address')
    } else if (err.message.includes('Token ID')) {
      console.error('Invalid Token ID:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Use a 64-character hex token ID')
      console.log('   - Check available tokens: node xec-wallet.js wallet-balance -n <wallet>')
    } else if (err.message.includes('quantity') || err.message.includes('decimal')) {
      console.error('Invalid Quantity:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Use a positive number for quantity')
      console.log('   - Check token decimal precision with: node xec-wallet.js etoken-info -t <token-id>')
    } else {
      console.error('Transaction Failed:', err.message)
      console.log()
      console.log('Suggestions:')
      console.log('   - Verify wallet has sufficient XEC for fees (need ~1-2 XEC)')
      console.log('   - Check network connectivity')
      console.log('   - Try again in a few moments')
    }
  }

}

export default SendETokens