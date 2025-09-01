/*
  Cryptographically sign a message with your private key.
*/

// Global npm libraries
import { signMsg, fromHex } from 'ecash-lib'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class MsgSign {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.sign = this.sign.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log(`Signing message with wallet '${flags.name}'...\n`)

      // Load wallet data
      const walletData = await this.walletUtil.loadWalletWithAnalytics(flags.name)

      // Sign the message
      const signObj = await this.sign(flags, walletData)

      console.log('Message signed successfully!')
      console.log(`Signed message with key associated with address: ${signObj.xecAddress}`)
      console.log(`Input message: ${signObj.message}`)
      console.log('Signature:')
      console.log(signObj.signature)

      return true
    } catch (err) {
      console.error('Error in msg-sign:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet name not specified
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if message not specified
    const msg = flags.msg
    if (!msg || msg === '') {
      throw new Error('You must specify a message to sign with the -m flag.')
    }

    return true
  }

  async sign (flags, walletData) {
    try {
      // Get the wallet's private key in hex format
      const privateKeyHex = walletData.wallet.privateKey

      if (!privateKeyHex) {
        throw new Error('Wallet private key not found')
      }

      // Convert hex string to Uint8Array for ecash-lib
      const privateKeyUint8Array = fromHex(privateKeyHex)

      // Sign the message using ecash-lib
      const signature = signMsg(flags.msg, privateKeyUint8Array)

      // Get the wallet address
      const xecAddress = walletData.wallet.xecAddress

      const outObj = {
        signature,
        xecAddress,
        message: flags.msg
      }

      return outObj
    } catch (err) {
      console.error('Error in sign():', err.message)
      throw err
    }
  }
}

export default MsgSign
