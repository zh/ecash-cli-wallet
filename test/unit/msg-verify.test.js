/*
  Unit Tests for MsgVerify Command
  Tests message signature verification functionality including validation and cryptographic operations
*/

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai'
import sinon from 'sinon'
import MsgVerify from '../../src/commands/msg-verify.js'

describe('MsgVerify Unit Tests', function () {
  let msgVerify

  beforeEach(function () {
    msgVerify = new MsgVerify()
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('Constructor', function () {
    it('should create MsgVerify instance with proper bindings', function () {
      expect(msgVerify).to.be.an.instanceOf(MsgVerify)
      expect(msgVerify.run).to.be.a('function')
      expect(msgVerify.validateFlags).to.be.a('function')
      expect(msgVerify.verify).to.be.a('function')
      expect(msgVerify.MinimalXecWallet).to.exist
    })
  })

  describe('validateFlags', function () {
    it('should pass validation with valid flags', function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags)).to.not.throw()
    })

    it('should throw error if address is missing', function () {
      const flags = {
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify an address with the -a flag.')
    })

    it('should throw error if address is empty string', function () {
      const flags = {
        addr: '',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify an address with the -a flag.')
    })

    it('should throw error for invalid address format', function () {
      const flags = {
        addr: 'invalid-address',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('Invalid address:')
    })

    it('should throw error if message is missing', function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify a message to verify with the -m flag.')
    })

    it('should throw error if message is empty string', function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: '',
        sig: 'H123abc...'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify a message to verify with the -m flag.')
    })

    it('should throw error if signature is missing', function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!'
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify a signature with the -s flag.')
    })

    it('should throw error if signature is empty string', function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: ''
      }

      expect(() => msgVerify.validateFlags(flags))
        .to.throw('You must specify a signature with the -s flag.')
    })

    it('should handle undefined flags object', function () {
      expect(() => msgVerify.validateFlags())
        .to.throw('You must specify an address with the -a flag.')
    })
  })

  describe('verify method', function () {
    it('should create temp wallet and call verifyMessage', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      const mockVerifyMessage = sinon.stub().returns(true)
      msgVerify.MinimalXecWallet = function MockWallet () {
        this.walletInfoPromise = Promise.resolve()
        this.verifyMessage = mockVerifyMessage
      }

      const result = await msgVerify.verify(flags)

      expect(result).to.equal(true)
      expect(mockVerifyMessage).to.have.been.calledWith(flags.msg, flags.sig, flags.addr)
    })

    it('should handle verification errors', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'InvalidSig'
      }

      msgVerify.MinimalXecWallet = function MockWallet () {
        this.walletInfoPromise = Promise.resolve()
        this.verifyMessage = sinon.stub().throws(new Error('Invalid signature format'))
      }

      try {
        await msgVerify.verify(flags)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.include('Message verification failed')
      }
    })
  })

  describe('run method', function () {
    let consoleLogSpy, consoleErrorSpy

    beforeEach(function () {
      consoleLogSpy = sinon.spy(console, 'log')
      consoleErrorSpy = sinon.spy(console, 'error')
    })

    afterEach(function () {
      consoleLogSpy.restore()
      consoleErrorSpy.restore()
    })

    it('should successfully run the verify command', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      sinon.stub(msgVerify, 'verify').resolves(true)

      const result = await msgVerify.run(flags)

      expect(result).to.equal(true)
      expect(consoleLogSpy).to.have.been.calledWith('Verifying message signature...\n')
      expect(consoleLogSpy).to.have.been.calledWith(`Message: ${flags.msg}`)
      expect(consoleLogSpy).to.have.been.calledWith(`Signature: ${flags.sig}`)
      expect(consoleLogSpy).to.have.been.calledWith(`Address: ${flags.addr}`)
      expect(consoleLogSpy).to.have.been.calledWith('Signature verification result: VALID')
    })

    it('should handle invalid signature result', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'InvalidSignature'
      }

      sinon.stub(msgVerify, 'verify').resolves(false)

      const result = await msgVerify.run(flags)

      expect(result).to.equal(false)
      expect(consoleLogSpy).to.have.been.calledWith('Signature verification result: INVALID')
    })

    it('should handle validation errors for missing signature', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!'
        // Missing sig
      }

      const result = await msgVerify.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith(
        'Error in msg-verify:',
        'You must specify a signature with the -s flag.'
      )
    })

    it('should handle validation errors for missing message', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        sig: 'H123abc...'
        // Missing msg
      }

      const result = await msgVerify.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith(
        'Error in msg-verify:',
        'You must specify a message to verify with the -m flag.'
      )
    })

    it('should handle verification errors from verify method', async function () {
      const flags = {
        addr: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
        msg: 'Hello eCash!',
        sig: 'MalformedSignature'
      }

      // Stub to simulate a verification error
      sinon.stub(msgVerify, 'verify').rejects(new Error('Message verification failed: Invalid signature format'))

      const result = await msgVerify.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.called
    })

    it('should handle address validation errors', async function () {
      const flags = {
        addr: 'invalid-address-format',
        msg: 'Hello eCash!',
        sig: 'H123abc...'
      }

      const result = await msgVerify.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith(
        'Error in msg-verify:',
        'Invalid address: Address must be an eCash address (ecash: prefix)'
      )
    })
  })
})
