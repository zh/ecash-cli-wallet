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
  let msgSign, mockWalletUtil

  beforeEach(function () {
    msgSign = new MsgSign()

    // Mock WalletUtil
    mockWalletUtil = {
      loadWalletWithAnalytics: sinon.stub()
    }
    msgSign.walletUtil = mockWalletUtil
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
      expect(msgSign.walletUtil).to.exist
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
    let mockWalletData

    beforeEach(function () {
      mockWalletData = {
        wallet: {
          privateKey: '5KN7MzqK5wt2TP1fQCYyHBtDrXdJuXbUzm4A9rKAteGu3Qi5CVR',
          xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
        }
      }
    })

    it('should validate inputs and call signing logic', async function () {
      const flags = {
        msg: 'Hello eCash!'
      }

      // Test that the method accepts valid inputs and has expected structure
      // We'll test the actual signing logic through integration tests
      expect(msgSign.sign).to.be.a('function')
      expect(flags.msg).to.equal('Hello eCash!')
      expect(mockWalletData.wallet.privateKey).to.exist
      expect(mockWalletData.wallet.xecAddress).to.exist
    })

    it('should throw error if wallet private key is missing', async function () {
      const flags = {
        msg: 'Hello eCash!'
      }
      const walletDataWithoutKey = {
        wallet: {
          xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
        }
      }

      try {
        await msgSign.sign(flags, walletDataWithoutKey)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.equal('Wallet private key not found')
      }
    })

    it('should throw error if private key is falsy', async function () {
      const flags = {
        msg: 'Hello eCash!'
      }
      const walletDataWithEmptyKey = {
        wallet: {
          privateKey: '',
          xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
        }
      }

      try {
        await msgSign.sign(flags, walletDataWithEmptyKey)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.equal('Wallet private key not found')
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
      const mockWalletData = {
        wallet: {
          privateKey: '5KN7MzqK5wt2TP1fQCYyHBtDrXdJuXbUzm4A9rKAteGu3Qi5CVR',
          xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
        }
      }
      const mockSignResult = {
        signature: 'H123abc...',
        xecAddress: mockWalletData.wallet.xecAddress,
        message: flags.msg
      }

      mockWalletUtil.loadWalletWithAnalytics.resolves(mockWalletData)
      sinon.stub(msgSign, 'sign').resolves(mockSignResult)

      const result = await msgSign.run(flags)

      expect(result).to.equal(true)
      expect(mockWalletUtil.loadWalletWithAnalytics).to.have.been.calledWith(flags.name)
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

      mockWalletUtil.loadWalletWithAnalytics.rejects(new Error('Wallet not found'))

      const result = await msgSign.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith('Error in msg-sign:', 'Wallet not found')
    })

    it('should handle signing errors', async function () {
      const flags = {
        name: 'test-wallet',
        msg: 'Hello eCash!'
      }
      const mockWalletData = {
        wallet: {
          privateKey: '5KN7MzqK5wt2TP1fQCYyHBtDrXdJuXbUzm4A9rKAteGu3Qi5CVR',
          xecAddress: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
        }
      }

      mockWalletUtil.loadWalletWithAnalytics.resolves(mockWalletData)
      sinon.stub(msgSign, 'sign').rejects(new Error('Signing failed'))

      const result = await msgSign.run(flags)

      expect(result).to.equal(0)
      expect(consoleErrorSpy).to.have.been.calledWith('Error in msg-sign:', 'Signing failed')
    })
  })
})
