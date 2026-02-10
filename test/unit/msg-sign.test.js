/*
  Unit Tests for MsgSign Command
  Tests message signing functionality including validation and cryptographic operations
*/

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai'
import sinon from 'sinon'
import MsgSign from '../../src/commands/msg-sign.js'

describe('MsgSign Unit Tests', function () {
  let msgSign

  beforeEach(function () {
    msgSign = new MsgSign()
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('Constructor', function () {
    it('should create MsgSign instance with proper bindings', function () {
      expect(msgSign).to.be.an.instanceOf(MsgSign)
      expect(msgSign.run).to.be.a('function')
      expect(msgSign.validateFlags).to.be.a('function')
      expect(msgSign.sign).to.be.a('function')
      expect(msgSign.loadWallet).to.be.a('function')
    })
  })

  describe('validateFlags', function () {
    it('should pass validation with valid flags', function () {
      const flags = {
        name: 'test-wallet',
        msg: 'Hello eCash!'
      }

      expect(() => msgSign.validateFlags(flags)).to.not.throw()
    })

    it('should throw error if wallet name is missing', function () {
      const flags = {
        msg: 'Hello eCash!'
      }

      expect(() => msgSign.validateFlags(flags))
        .to.throw('You must specify a wallet name with the -n flag.')
    })

    it('should throw error if wallet name is empty string', function () {
      const flags = {
        name: '',
        msg: 'Hello eCash!'
      }

      expect(() => msgSign.validateFlags(flags))
        .to.throw('You must specify a wallet name with the -n flag.')
    })

    it('should throw error if message is missing', function () {
      const flags = {
        name: 'test-wallet'
      }

      expect(() => msgSign.validateFlags(flags))
        .to.throw('You must specify a message to sign with the -m flag.')
    })

    it('should throw error if message is empty string', function () {
      const flags = {
        name: 'test-wallet',
        msg: ''
      }

      expect(() => msgSign.validateFlags(flags))
        .to.throw('You must specify a message to sign with the -m flag.')
    })

    it('should handle undefined flags object', function () {
      expect(() => msgSign.validateFlags())
        .to.throw('You must specify a wallet name with the -n flag.')
    })
  })

  describe('sign method', function () {
    it('should call wallet.signMessage and return result', async function () {
      const flags = { msg: 'Hello eCash!' }
      const mockWallet = {
        signMessage: sinon.stub().returns('base64SignatureString'),
        walletInfo: { xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz' }
      }

      const result = await msgSign.sign(flags, mockWallet)

      expect(result.signature).to.equal('base64SignatureString')
      expect(result.xecAddress).to.equal('ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz')
      expect(result.message).to.equal('Hello eCash!')
      expect(mockWallet.signMessage).to.have.been.calledWith('Hello eCash!')
    })

    it('should throw error if signMessage throws', async function () {
      const flags = { msg: 'Hello eCash!' }
      const mockWallet = {
        signMessage: sinon.stub().throws(new Error('Wallet not initialized or no private key available')),
        walletInfo: { xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz' }
      }

      try {
        await msgSign.sign(flags, mockWallet)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.equal('Wallet not initialized or no private key available')
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

    it('should successfully run the sign command', async function () {
      const flags = {
        name: 'test-wallet',
        msg: 'Hello eCash!'
      }
      const mockWallet = {
        signMessage: sinon.stub().returns('base64SignatureString'),
        walletInfo: { xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz' }
      }
      const mockSignResult = {
        signature: 'H123abc...',
        xecAddress: mockWallet.walletInfo.xecAddress,
        message: flags.msg
      }

      msgSign.loadWallet = sinon.stub().resolves(mockWallet)
      sinon.stub(msgSign, 'sign').resolves(mockSignResult)

      const result = await msgSign.run(flags)

      expect(result).to.equal(true)
      expect(msgSign.loadWallet).to.have.been.calledWith(flags.name)
      expect(consoleLogSpy).to.have.been.calledWith(`Signing message with wallet '${flags.name}'...\n`)
      expect(consoleLogSpy).to.have.been.calledWith('Message signed successfully!')
      expect(consoleLogSpy).to.have.been.calledWith(`Signed message with key associated with address: ${mockSignResult.xecAddress}`)
      expect(consoleLogSpy).to.have.been.calledWith(`Input message: ${mockSignResult.message}`)
      expect(consoleLogSpy).to.have.been.calledWith('Signature:')
      expect(consoleLogSpy).to.have.been.calledWith(mockSignResult.signature)
    })

    it('should handle validation errors', async function () {
      const flags = {
        name: 'test-wallet'
        // Missing msg
      }

      const result = await msgSign.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith(
        'Error in msg-sign:',
        'You must specify a message to sign with the -m flag.'
      )
    })

    it('should handle wallet loading errors', async function () {
      const flags = {
        name: 'non-existent-wallet',
        msg: 'Hello eCash!'
      }

      msgSign.loadWallet = sinon.stub().rejects(new Error('Wallet not found'))

      const result = await msgSign.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith('Error in msg-sign:', 'Wallet not found')
    })

    it('should handle signing errors', async function () {
      const flags = {
        name: 'test-wallet',
        msg: 'Hello eCash!'
      }
      const mockWallet = {
        signMessage: sinon.stub().returns('base64SignatureString'),
        walletInfo: { xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz' }
      }

      msgSign.loadWallet = sinon.stub().resolves(mockWallet)
      sinon.stub(msgSign, 'sign').rejects(new Error('Signing failed'))

      const result = await msgSign.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith('Error in msg-sign:', 'Signing failed')
    })
  })
})
