/*
  Cryptographically verify a message and signature was signed by a provided
  XEC address.
*/

// Global npm libraries
import MinimalXecWallet from 'minimal-xec-wallet'

// Local libraries
import { validateAddress } from '../lib/validators.js'

class MsgVerify {
  constructor () {
    // Encapsulate dependencies
    this.MinimalXecWallet = MinimalXecWallet

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.verify = this.verify.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      console.log('Verifying message signature...\n')

      // Verify the signature
      const result = await this.verify(flags)

      console.log(`Message: ${flags.msg}`)
      console.log(`Signature: ${flags.sig}`)
      console.log(`Address: ${flags.addr}`)
      console.log(`Signature verification result: ${result ? 'VALID' : 'INVALID'}`)

      return result
    } catch (err) {
      console.error('Error in msg-verify:', err.message)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if address not specified
    const addr = flags.addr
    if (!addr || addr === '') {
      throw new Error('You must specify an address with the -a flag.')
    }

    // Exit if message not specified
    const msg = flags.msg
    if (!msg || msg === '') {
      throw new Error('You must specify a message to verify with the -m flag.')
    }

    // Exit if signature not specified
    const sig = flags.sig
    if (!sig || sig === '') {
      throw new Error('You must specify a signature with the -s flag.')
    }

    // Validate XEC address format after all required fields are present
    validateAddress(addr)

    return true
  }

  async verify (flags) {
    try {
      const WalletClass = this.MinimalXecWallet
      const tempWallet = new WalletClass()
      await tempWallet.walletInfoPromise

      const result = tempWallet.verifyMessage(flags.msg, flags.sig, flags.addr)
      return result
    } catch (err) {
      console.error('Error in verify():', err.message)
      throw new Error(`Message verification failed: ${err.message}`)
    }
  }
}

export default MsgVerify
