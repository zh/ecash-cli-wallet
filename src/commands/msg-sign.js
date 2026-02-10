/*
  Cryptographically sign a message with your private key.
*/

// Local libraries
import { loadWallet } from '../lib/wallet-loader.js'

class MsgSign {
  constructor () {
    // Encapsulate dependencies
    this.loadWallet = loadWallet

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
      const wallet = await this.loadWallet(flags.name)

      // Sign the message
      const signObj = await this.sign(flags, wallet)

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

  async sign (flags, wallet) {
    try {
      const signature = wallet.signMessage(flags.msg)
      const xecAddress = wallet.walletInfo.xecAddress

      return {
        signature,
        xecAddress,
        message: flags.msg
      }
    } catch (err) {
      console.error('Error in sign():', err.message)
      throw err
    }
  }
}

export default MsgSign
