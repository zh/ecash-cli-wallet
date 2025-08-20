/*
  Check the XEC balance of a wallet.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletBalance {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getBalance = this.getBalance.bind(this)
    this.displayBalance = this.displayBalance.bind(this)
    this.getETokenData = this.getETokenData.bind(this)
    this.categorizeTokens = this.categorizeTokens.bind(this)
    this.displayETokenBalances = this.displayETokenBalances.bind(this)
    this.displayUtxoBreakdown = this.displayUtxoBreakdown.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Checking balance for wallet '${flags.name}'...\n`)

      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(flags.name)
      
      // Get balance information
      const balanceData = await this.getBalance(walletData)
      
      // Display balance information
      await this.displayBalance(balanceData, flags.name)

      return true
    } catch (err) {
      console.error('Error checking balance:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    return true
  }

  // Get balance information for the wallet
  async getBalance (walletData) {
    try {
      // Create wallet instance from stored mnemonic
      const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
      await xecWallet.walletInfoPromise

      // Initialize to get UTXOs and balance
      await xecWallet.initialize()

      // Get detailed balance information
      const balance = await xecWallet.getDetailedBalance()
      const xecUsdPrice = await xecWallet.getXecUsd().catch(() => null)

      // Get eToken balances
      const eTokenData = await this.getETokenData(xecWallet)

      return {
        balance,
        xecUsdPrice,
        address: xecWallet.walletInfo.xecAddress,
        wallet: xecWallet,
        eTokens: eTokenData
      }
    } catch (err) {
      throw new Error(`Failed to get balance: ${err.message}`)
    }
  }

  // Display balance information on screen
  async displayBalance (balanceData, walletName) {
    try {
      const { balance, xecUsdPrice, address, eTokens } = balanceData

      console.log(`Wallet: ${walletName}`)
      console.log(`Address: ${address}`)
      console.log()
      
      // Display XEC balance
      console.log('XEC Balance:')
      console.log(`   Confirmed: ${balance.confirmed.toLocaleString()} XEC`)
      console.log(`   Unconfirmed: ${balance.unconfirmed.toLocaleString()} XEC`)
      console.log(`   Total: ${balance.total.toLocaleString()} XEC`)
      
      // Display satoshi amounts
      console.log()
      console.log('Satoshi Balance:')
      console.log(`   Total: ${balance.satoshis.total.toLocaleString()} sats`)

      // Display USD value if price is available
      if (xecUsdPrice && balance.total > 0) {
        const usdValue = (balance.total * xecUsdPrice).toFixed(2)
        console.log()
        console.log('USD Value:')
        console.log(`   ~$${usdValue} USD (at $${xecUsdPrice}/XEC)`)
      }

      // Display eToken balances
      await this.displayETokenBalances(eTokens)

      // Display UTXO breakdown for debugging fee issues
      await this.displayUtxoBreakdown(balanceData.wallet)

      console.log()
      console.log('Commands:')
      console.log(`   Send XEC: node xec-wallet.js send-xec -n ${walletName} -a <address> -q <amount>`)
      console.log(`   View QR: node xec-wallet.js wallet-addrs -n ${walletName} -q`)

      return true
    } catch (err) {
      throw new Error(`Failed to display balance: ${err.message}`)
    }
  }

  // Get eToken data for the wallet
  async getETokenData (wallet) {
    try {
      // Extract token UTXOs from the wallet's XEC UTXOs
      const tokenUtxos = []
      
      if (wallet.utxos && wallet.utxos.utxoStore && wallet.utxos.utxoStore.xecUtxos) {
        // Look for UTXOs that have token data
        for (const utxo of wallet.utxos.utxoStore.xecUtxos) {
          if (utxo.token && utxo.token.tokenId && !utxo.token.isMintBaton) {
            tokenUtxos.push(utxo.token)
          }
        }
      }
      
      if (tokenUtxos.length === 0) {
        return { slp: [], alp: [] }
      }

      // Group UTXOs by token ID and sum balances
      const tokenBalances = {}
      for (const token of tokenUtxos) {
        const tokenId = token.tokenId
        if (!tokenId) continue
        
        if (!tokenBalances[tokenId]) {
          tokenBalances[tokenId] = {
            tokenId: tokenId,
            balance: 0,
            protocol: token.tokenType?.protocol || 'SLP'
          }
        }
        
        // Add balance from atoms
        const atoms = token.atoms || 0
        let balance = 0
        if (typeof atoms === 'bigint') {
          balance = Number(atoms)
        } else if (typeof atoms === 'string') {
          balance = parseFloat(atoms)
        } else {
          balance = parseFloat(atoms) || 0
        }
        
        tokenBalances[tokenId].balance += balance
      }

      // Convert to array and get metadata for each token
      const tokenList = Object.values(tokenBalances)
      
      // Get detailed data for each token
      const tokenDataPromises = tokenList.map(async (token) => {
        try {
          let ticker = 'Unknown'
          let name = 'Unknown Token'
          let decimals = 0
          let protocol = token.protocol || 'SLP'
          
          // Try multiple methods to get token metadata
          try {
            // Method 1: Try wallet.getETokenData (most reliable for metadata)
            const eTokenData = await wallet.getETokenData(token.tokenId)
            if (eTokenData) {
              ticker = eTokenData.ticker || ticker
              name = eTokenData.name || name
              decimals = eTokenData.decimals || decimals
              protocol = eTokenData.protocol || protocol
            }
          } catch (err) {
            // Method 1 failed, try fallback
          }
          
          // Method 2: Try hybridTokens.getTokenData as fallback
          if (ticker === 'Unknown') {
            try {
              const tokenData = await wallet.hybridTokens.getTokenData(token.tokenId)
              protocol = tokenData.protocol || protocol
              
              if (tokenData.genesisData) {
                ticker = tokenData.genesisData.ticker || ticker
                name = tokenData.genesisData.name || name
                decimals = tokenData.genesisData.decimals || decimals
              }
            } catch (err) {
              // Method 2 failed, continue to final fallback
            }
          }
          
          // Final fallback: Use shortened token ID as ticker if still unknown
          if (ticker === 'Unknown') {
            ticker = token.tokenId.slice(0, 8).toUpperCase()
            name = `Token ${ticker}`
          }
          
          // Calculate display amount
          const displayBalance = token.balance / Math.pow(10, decimals)
          
          return {
            tokenId: token.tokenId,
            balance: token.balance,
            balanceStr: displayBalance.toString(),
            ticker: ticker,
            name: name,
            decimals: decimals,
            protocol: protocol
          }
        } catch (err) {
          console.error(`Warning: Could not process token ${token.tokenId}:`, err.message)
          // Ultimate fallback
          const fallbackTicker = token.tokenId.slice(0, 8).toUpperCase()
          return {
            tokenId: token.tokenId,
            balance: token.balance,
            balanceStr: (token.balance || 0).toString(),
            ticker: fallbackTicker,
            name: `Token ${fallbackTicker}`,
            decimals: 0,
            protocol: token.protocol || 'SLP'
          }
        }
      })

      const allTokenData = await Promise.all(tokenDataPromises)
      
      // Filter out any tokens with 0 balance
      const filteredTokenData = allTokenData.filter(token => 
        parseFloat(token.balanceStr) > 0
      )
      
      // Categorize tokens by protocol
      return this.categorizeTokens(filteredTokenData)
    } catch (err) {
      console.error('Warning: Could not fetch eToken data:', err.message)
      return { slp: [], alp: [] }
    }
  }

  // Categorize tokens into SLP and ALP groups
  categorizeTokens (tokenData) {
    const slp = []
    const alp = []

    for (const token of tokenData) {
      if (token.protocol && token.protocol.toUpperCase() === 'ALP') {
        alp.push(token)
      } else {
        slp.push(token)
      }
    }

    return { slp, alp }
  }

  // Display eToken balances grouped by protocol
  async displayETokenBalances (eTokens) {
    try {
      const { slp, alp } = eTokens

      if (slp.length === 0 && alp.length === 0) {
        return
      }

      console.log()

      // Display SLP tokens
      if (slp.length > 0) {
        console.log('SLP Tokens:')
        for (const token of slp) {
          const amount = parseFloat(token.balanceStr).toLocaleString()
          console.log(`   ${token.ticker} ${token.name}  ${token.tokenId}  ${amount}`)
        }
      }

      // Display ALP tokens
      if (alp.length > 0) {
        console.log()
        console.log('ALP Tokens:')
        for (const token of alp) {
          const amount = parseFloat(token.balanceStr).toLocaleString()
          console.log(`   ${token.ticker} ${token.name}  ${token.tokenId}  ${amount}`)
        }
      }

      return true
    } catch (err) {
      console.error('Warning: Could not display eToken balances:', err.message)
      return false
    }
  }

  // Display UTXO breakdown for debugging fee calculation issues
  async displayUtxoBreakdown (wallet) {
    try {
      console.log()
      console.log('UTXO Breakdown (for fee calculation debugging):')
      console.log('-'.repeat(60))

      if (!wallet.utxos || !wallet.utxos.utxoStore || !wallet.utxos.utxoStore.xecUtxos) {
        console.log('   No UTXO data available')
        return false
      }

      const utxos = wallet.utxos.utxoStore.xecUtxos
      let pureXecUtxos = []
      let tokenUtxos = []
      let pureXecTotal = 0
      let tokenXecTotal = 0

      // Categorize UTXOs
      for (const utxo of utxos) {
        // Safely get XEC amount - use sats property which is the correct one
        let xecAmount = 0
        if (utxo.sats !== undefined) {
          const satoshis = parseInt(utxo.sats) || 0
          xecAmount = satoshis / 100 // Convert from satoshis to XEC
        } else if (utxo.value) {
          const satoshis = parseInt(utxo.value) || 0
          xecAmount = satoshis / 100 // Convert from satoshis to XEC
        }
        
        // Safely get TXID from outpoint
        const txid = utxo.outpoint?.txid || utxo.txid || 'unknown'
        const outIdx = utxo.outpoint?.outIdx !== undefined ? utxo.outpoint.outIdx : (utxo.outIdx !== undefined ? utxo.outIdx : 0)
        
        if (utxo.token && utxo.token.tokenId) {
          // This UTXO is locked with tokens
          tokenUtxos.push({
            txid: txid,
            outIdx: outIdx,
            xecAmount: xecAmount,
            tokenId: utxo.token.tokenId,
            atoms: utxo.token.atoms
          })
          tokenXecTotal += xecAmount
        } else {
          // This is pure XEC UTXO
          pureXecUtxos.push({
            txid: txid,
            outIdx: outIdx,
            xecAmount: xecAmount
          })
          pureXecTotal += xecAmount
        }
      }

      console.log(`Pure XEC UTXOs (available for fees): ${pureXecUtxos.length}`)
      console.log(`   Total: ${pureXecTotal.toLocaleString()} XEC`)
      
      if (pureXecUtxos.length > 0) {
        console.log('   UTXOs:')
        pureXecUtxos.slice(0, 5).forEach((utxo, i) => {
          console.log(`     ${i + 1}. ${utxo.txid.slice(0, 8)}...${utxo.txid.slice(-4)}:${utxo.outIdx} - ${utxo.xecAmount.toLocaleString()} XEC`)
        })
        if (pureXecUtxos.length > 5) {
          console.log(`     ... and ${pureXecUtxos.length - 5} more`)
        }
      }

      console.log()
      console.log(`Token UTXOs (XEC locked with tokens): ${tokenUtxos.length}`)
      console.log(`   Total: ${tokenXecTotal.toLocaleString()} XEC`)
      
      if (tokenUtxos.length > 0) {
        console.log('   UTXOs:')
        tokenUtxos.slice(0, 5).forEach((utxo, i) => {
          console.log(`     ${i + 1}. ${utxo.txid.slice(0, 8)}...${utxo.txid.slice(-4)}:${utxo.outIdx} - ${utxo.xecAmount.toLocaleString()} XEC (Token: ${utxo.tokenId.slice(0, 8)}...)`)
        })
        if (tokenUtxos.length > 5) {
          console.log(`     ... and ${tokenUtxos.length - 5} more`)
        }
      }

      console.log()
      console.log('Fee Calculation Analysis:')
      console.log(`   Available for fees: ${pureXecTotal.toLocaleString()} XEC`)
      console.log(`   Locked in tokens: ${tokenXecTotal.toLocaleString()} XEC`)
      console.log(`   Total wallet: ${(pureXecTotal + tokenXecTotal).toLocaleString()} XEC`)

      if (pureXecTotal < 0.1) {
        console.log('   WARNING: Very low pure XEC available for fees!')
        console.log('   This may cause "Insufficient XEC for transaction fees" errors.')
        console.log('   Consider adding more pure XEC to your wallet.')
      }

      return true
    } catch (err) {
      console.error('Warning: Could not display UTXO breakdown:', err.message)
      return false
    }
  }
}

export default WalletBalance