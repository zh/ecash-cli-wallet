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
    this.validateMnemonic = this.validateMnemonic.bind(this)
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

      const walletData = await this.createWallet(flags.name, flags.description, flags.mnemonic, flags.cashtab)

      console.log('\nWallet created successfully!')
      console.log(`Name: ${flags.name}`)
      console.log(`Description: ${flags.description || '(none)'}`)
      console.log(`XEC Address: ${walletData.wallet.xecAddress}`)

      if (flags.mnemonic) {
        console.log('\nWallet created from provided mnemonic.')
        if (flags.cashtab) {
          console.log('Using CashTab-compatible derivation path: m/44\'/1899\'/0\'/0/0')
          console.log('✓ This wallet is compatible with CashTab imports/exports.')
          console.log('⚠️  COMPATIBILITY NOTE: This derivation path is specific to CashTab.')
          console.log('   Other eCash wallets may use the standard m/44\'/899\'/0\'/0/0 path.')
          console.log('   Only use --cashtab when importing existing CashTab mnemonics.')
        } else {
          console.log('Using standard eCash derivation path: m/44\'/899\'/0\'/0/0')
          console.log('✓ This follows the official eCash BIP44 standard.')
          console.log('✓ Compatible with most eCash wallets and tools.')
        }
        console.log('\n⚠️  SECURITY WARNING:')
        console.log('   Using mnemonic via command line exposes it in process history.')
        console.log('   Consider using a more secure method for production wallets.')
      } else {
        console.log('\nIMPORTANT: Save your mnemonic phrase securely:')
        console.log(`${walletData.wallet.mnemonic}`)
        if (flags.cashtab) {
          console.log('\n⚠️  CashTab Compatibility Mode:')
          console.log('   Using CashTab-compatible derivation path: m/44\'/1899\'/0\'/0/0')
          console.log('   This derivation path is specific to CashTab.')
          console.log('   For better compatibility, consider using standard mode (without --cashtab).')
        } else {
          console.log('\n✓ Using standard eCash derivation path: m/44\'/899\'/0\'/0/0')
          console.log('  This follows the official eCash BIP44 standard.')
        }
      }

      console.log('\nYou can view your address and QR code with:')
      console.log(`node xec-wallet.js wallet-addrs -n ${flags.name} -q`)

      return walletData
    } catch (err) {
      console.error('Error creating wallet:', err.message)
      process.exit(1)
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

    // Validate mnemonic if provided (including empty string check)
    if (flags.mnemonic !== undefined) {
      this.validateMnemonic(flags.mnemonic)
    }

    // Validate cashtab flag usage - should only be used with mnemonic
    if (flags.cashtab && !flags.mnemonic) {
      console.log('WARNING: --cashtab flag is recommended only when importing existing CashTab mnemonics.')
      console.log('For new wallets, the default eCash standard derivation path is recommended.')
    }

    return true
  }

  validateMnemonic (mnemonic) {
    try {
      if (!mnemonic || typeof mnemonic !== 'string') {
        throw new Error('Mnemonic must be a non-empty string')
      }

      // Normalize whitespace before validation
      const normalized = mnemonic.trim().replace(/\s+/g, ' ')

      // Clean and split mnemonic into words
      const words = normalized.split(' ')

      // Check word count - BIP39 supports 12, 15, 18, 21, or 24 words
      const validWordCounts = [12, 15, 18, 21, 24]
      if (!validWordCounts.includes(words.length)) {
        throw new Error(`Invalid mnemonic length. Expected 12, 15, 18, 21, or 24 words, got ${words.length} words.`)
      }

      // Basic word validation - each word should be alphabetic
      for (const word of words) {
        if (!/^[a-z]+$/i.test(word)) {
          throw new Error(`Invalid word in mnemonic: "${word}". Words should contain only letters.`)
        }
      }

      // Check for common patterns that might indicate invalid mnemonic
      const uniqueWords = new Set(words)
      if (uniqueWords.size < words.length * 0.5) {
        console.log('WARNING: Mnemonic contains many repeated words. Please verify it is correct.')
      }

      return true
    } catch (err) {
      throw new Error(`Invalid mnemonic: ${err.message}`)
    }
  }

  // Create a new wallet and save it to file
  async createWallet (walletName, description = '', mnemonic = null, cashtab = false) {
    try {
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('Wallet name is required.')
      }

      // Determine derivation path based on cashtab flag
      const hdPath = cashtab ? "m/44'/1899'/0'/0/0" : "m/44'/899'/0'/0/0"

      // Prepare advanced options for MinimalXecWallet
      const advancedOptions = {}
      if (cashtab) {
        advancedOptions.hdPath = hdPath
      }

      // Create new XEC wallet instance - with or without provided mnemonic
      const xecWallet = mnemonic
        ? new this.MinimalXecWallet(mnemonic.trim().replace(/\s+/g, ' '), advancedOptions)
        : new this.MinimalXecWallet(null, advancedOptions)
      await xecWallet.walletInfoPromise

      // Generate derived addresses (indices 0-9) using the same derivation pattern
      const derived = {}
      const coinType = cashtab ? '1899' : '899'

      // Include index 0 (main wallet) as a safeguard - if wallet.xecAddress gets corrupted,
      // the original address can be recovered from the derived section
      const mainPath = `m/44'/${coinType}'/0'/0/0`
      derived[mainPath] = xecWallet.walletInfo.xecAddress

      // Add indices 1-9
      for (let i = 1; i <= 9; i++) {
        const derivedPath = `m/44'/${coinType}'/0'/0/${i}`
        try {
          const keyData = xecWallet.keyDerivation.deriveFromMnemonic(xecWallet.walletInfo.mnemonic, derivedPath)
          derived[derivedPath] = keyData.address
        } catch (err) {
          console.warn(`Warning: Could not derive address for path ${derivedPath}: ${err.message}`)
          // Skip this derived address if derivation fails
        }
      }

      // Create wallet data structure
      const walletData = {
        wallet: {
          mnemonic: xecWallet.walletInfo.mnemonic,
          privateKey: xecWallet.walletInfo.privateKey,
          publicKey: xecWallet.walletInfo.publicKey,
          xecAddress: xecWallet.walletInfo.xecAddress,
          hdPath: xecWallet.walletInfo.hdPath
        },
        derived,
        description: description || '',
        created: new Date().toISOString(),
        compatibility: {
          derivationPath: hdPath,
          standard: cashtab ? 'CashTab' : 'eCash BIP44',
          cashtabCompatible: cashtab
        }
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
