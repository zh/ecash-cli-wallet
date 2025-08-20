/*
  Display wallet addresses and optionally show QR codes.
*/

// Global npm libraries
import qrcodeTerminal from 'qrcode-terminal'
import qrcode from 'qrcode'
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class WalletAddrs {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet
    this.walletUtil = new WalletUtil()
    this.qrcodeTerminal = qrcodeTerminal
    this.qrcode = qrcode

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.displayAddresses = this.displayAddresses.bind(this)
    this.generateSmallQR = this.generateSmallQR.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Determine what to show based on flags
      const showXec = flags.xec || !flags.wif
      const showWif = flags.wif

      console.log(`Addresses for wallet '${flags.name}':\n`)

      // Load wallet data
      const walletData = await this.walletUtil.loadWallet(flags.name)
      
      // Display address information
      await this.displayAddresses(walletData, flags, { showXec, showWif })

      return true
    } catch (err) {
      console.error('Error displaying addresses:', err.message)
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


  // Generate smaller QR code that fits terminal window
  async generateSmallQR (text) {
    try {
      // Try using qrcode package with terminal output and smaller width
      const qrString = await this.qrcode.toString(text, {
        type: 'terminal',
        width: 40,
        small: true,
        errorCorrectionLevel: 'M'
      })
      console.log(qrString)
    } catch (err) {
      // Fallback to qrcode-terminal with small option
      console.log('QR generation with qrcode failed, using fallback:')
      this.qrcodeTerminal.generate(text, { small: true })
    }
  }

  // Display wallet addresses and optionally QR codes
  async displayAddresses (walletData, flags, options) {
    try {
      const { showXec, showWif } = options
      const xecAddress = walletData.wallet.xecAddress
      
      // Get WIF if needed
      let wifKey = null
      if (showWif) {
        const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
        await xecWallet.walletInfoPromise
        // Export as compressed WIF (starts with L/K for mainnet)
        wifKey = xecWallet.exportPrivateKeyAsWIF(true, false)
      }

      console.log('Primary Address (HD Path: m/44\'/899\'/0\'/0/0):')
      
      // Show XEC address
      if (showXec) {
        console.log(`   XEC Address: ${xecAddress}`)
        console.log(`   (Same address works for XEC and eTokens)`)
        if (flags.qr) {
          console.log('\nXEC Address QR Code:')
          await this.generateSmallQR(xecAddress)
        }
      }
      
      // Show WIF private key
      if (showWif) {
        console.log(`   WIF Private Key: ${wifKey}`)
        if (flags.qr) {
          console.log('\nWIF Private Key QR Code:')
          await this.generateSmallQR(wifKey)
        }
        console.log('\nWARNING: Keep this private key secure! Anyone with this key can access your funds.')
      }
      
      console.log()

      // Show additional HD addresses if requested
      if (flags.index !== undefined) {
        console.log('Additional HD Addresses:')
        
        const xecWallet = new this.MinimalXecWallet(walletData.wallet.mnemonic)
        await xecWallet.walletInfoPromise

        const hdIndex = parseInt(flags.index) || 1
        const keyPair = await xecWallet.getKeyPair(hdIndex)
        
        console.log(`   HD Index ${hdIndex}:`)
        
        if (showXec) {
          console.log(`   XEC: ${keyPair.xecAddress}`)
          if (flags.qr) {
            console.log(`\nXEC QR Code for HD Index ${hdIndex}:`)
            await this.generateSmallQR(keyPair.xecAddress)
          }
        }
        
        if (showWif) {
          // Convert hex private key to WIF format (compressed, mainnet)
          // getKeyPair returns hex private key in the 'wif' property
          const wifPrivateKey = xecWallet.keyDerivation.exportToWif(keyPair.wif, true, false)
          console.log(`   WIF: ${wifPrivateKey}`)
          if (flags.qr) {
            console.log(`\nWIF QR Code for HD Index ${hdIndex}:`)
            await this.generateSmallQR(wifPrivateKey)
          }
          console.log('\nWARNING: Keep this private key secure!')
        }
        
        console.log()
      }

      console.log('Tips:')
      if (showXec) {
        console.log('   - Use XEC address for receiving XEC coins and eTokens')
      }
      if (showWif) {
        console.log('   - Use WIF key to sweep/import wallet into other applications')
      }
      console.log('   - Use --xec or --wif to show specific address types')
      console.log('   - Add --index <number> to view additional HD addresses')
      if (!flags.qr) {
        console.log('   - Add -q flag to display QR codes')
      }

      return true
    } catch (err) {
      throw new Error(`Failed to display addresses: ${err.message}`)
    }
  }
}

export default WalletAddrs