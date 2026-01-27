/*
  Unit Tests for WalletCreate Command
  Tests wallet creation functionality including mnemonic support
*/

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai'
import sinon from 'sinon'
import WalletCreate from '../../src/commands/wallet-create.js'

describe('WalletCreate Unit Tests', function () {
  let walletCreate, mockWalletUtil, mockMinimalXecWallet

  beforeEach(function () {
    walletCreate = new WalletCreate()

    // Mock WalletUtil
    mockWalletUtil = {
      walletExists: sinon.stub(),
      saveWallet: sinon.stub(),
      getAvalancheOptions: sinon.stub().resolves({
        avalanche: {
          enabled: true,
          defaultAwaitFinality: false,
          finalityTimeout: 30000
        }
      })
    }
    walletCreate.walletUtil = mockWalletUtil

    // Mock MinimalXecWallet
    mockMinimalXecWallet = sinon.stub()
    mockMinimalXecWallet.prototype.walletInfoPromise = Promise.resolve()
    mockMinimalXecWallet.prototype.walletInfo = {
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      privateKey: 'mock-private-key',
      publicKey: 'mock-public-key',
      xecAddress: 'ecash:qr03uhyuv0cen3atackpru04watjlllxtu6aqnedrp',
      hdPath: "m/44'/899'/0'/0/0"
    }
    walletCreate.MinimalXecWallet = mockMinimalXecWallet
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('Constructor', function () {
    it('should create WalletCreate instance with proper bindings', function () {
      expect(walletCreate).to.be.an.instanceOf(WalletCreate)
      expect(walletCreate.run).to.be.a('function')
      expect(walletCreate.validateFlags).to.be.a('function')
      expect(walletCreate.validateMnemonic).to.be.a('function')
      expect(walletCreate.createWallet).to.be.a('function')
    })
  })

  describe('validateFlags', function () {
    it('should require wallet name', function () {
      expect(() => walletCreate.validateFlags({})).to.throw('You must specify a wallet name with the -n flag.')
      expect(() => walletCreate.validateFlags({ name: '' })).to.throw('You must specify a wallet name with the -n flag.')
    })

    it('should pass validation with valid wallet name', function () {
      expect(() => walletCreate.validateFlags({ name: 'test-wallet' })).to.not.throw()
    })

    it('should validate wallet name format', function () {
      expect(() => walletCreate.validateFlags({ name: 'test wallet' })).to.throw('Wallet name can only contain letters, numbers, underscores, and hyphens.')
      expect(() => walletCreate.validateFlags({ name: 'test@wallet' })).to.throw('Wallet name can only contain letters, numbers, underscores, and hyphens.')
    })

    it('should validate mnemonic when provided', function () {
      // Valid mnemonic should not throw
      expect(() => walletCreate.validateFlags({
        name: 'test-wallet',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      })).to.not.throw()

      // Invalid mnemonic should throw
      expect(() => walletCreate.validateFlags({
        name: 'test-wallet',
        mnemonic: 'invalid short'
      })).to.throw('Invalid mnemonic')
    })

    it('should validate cashtab flag usage', function () {
      const consoleSpy = sinon.spy(console, 'log')

      // Using --cashtab with mnemonic should not show warning
      expect(() => walletCreate.validateFlags({
        name: 'test-wallet',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        cashtab: true
      })).to.not.throw()

      // Using --cashtab without mnemonic should show warning but not throw
      expect(() => walletCreate.validateFlags({
        name: 'test-wallet',
        cashtab: true
      })).to.not.throw()

      expect(consoleSpy.calledWith('WARNING: --cashtab flag is recommended only when importing existing CashTab mnemonics.')).to.be.true
      expect(consoleSpy.calledWith('For new wallets, the default eCash standard derivation path is recommended.')).to.be.true

      consoleSpy.restore()
    })
  })

  describe('validateMnemonic', function () {
    it('should accept valid 12-word mnemonic', function () {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      expect(() => walletCreate.validateMnemonic(mnemonic)).to.not.throw()
    })

    it('should accept valid 24-word mnemonic', function () {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
      expect(() => walletCreate.validateMnemonic(mnemonic)).to.not.throw()
    })

    it('should reject invalid word count', function () {
      expect(() => walletCreate.validateMnemonic('abandon abandon abandon')).to.throw('Invalid mnemonic length. Expected 12, 15, 18, 21, or 24 words, got 3 words.')
      expect(() => walletCreate.validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).to.throw('Invalid mnemonic length. Expected 12, 15, 18, 21, or 24 words, got 13 words.')
    })

    it('should reject empty or non-string mnemonic', function () {
      expect(() => walletCreate.validateMnemonic('')).to.throw('Mnemonic must be a non-empty string')
      expect(() => walletCreate.validateMnemonic(null)).to.throw('Mnemonic must be a non-empty string')
      expect(() => walletCreate.validateMnemonic(undefined)).to.throw('Mnemonic must be a non-empty string')
      expect(() => walletCreate.validateMnemonic(123)).to.throw('Mnemonic must be a non-empty string')
    })

    it('should reject words with invalid characters', function () {
      expect(() => walletCreate.validateMnemonic('abandon abandon 123invalid abandon abandon abandon abandon abandon abandon abandon abandon about')).to.throw('Invalid word in mnemonic: "123invalid". Words should contain only letters.')
      expect(() => walletCreate.validateMnemonic('abandon abandon @invalid abandon abandon abandon abandon abandon abandon abandon abandon about')).to.throw('Invalid word in mnemonic: "@invalid". Words should contain only letters.')
    })

    it('should handle extra whitespace correctly', function () {
      const mnemonic = '  abandon   abandon  abandon abandon  abandon abandon abandon abandon abandon abandon  abandon   about  '
      expect(() => walletCreate.validateMnemonic(mnemonic)).to.not.throw()
    })

    it('should warn about mnemonics with many repeated words', function () {
      const consoleSpy = sinon.spy(console, 'log')
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'

      walletCreate.validateMnemonic(mnemonic)

      expect(consoleSpy.calledWith('WARNING: Mnemonic contains many repeated words. Please verify it is correct.')).to.be.true
      consoleSpy.restore()
    })
  })

  describe('createWallet', function () {
    beforeEach(function () {
      mockWalletUtil.walletExists.resolves(false)
      mockWalletUtil.saveWallet.resolves()
    })

    it('should create wallet without mnemonic (random generation)', async function () {
      const walletData = await walletCreate.createWallet('test-wallet', 'Test description')

      expect(mockMinimalXecWallet.calledWith()).to.be.true
      expect(mockWalletUtil.saveWallet.calledOnce).to.be.true
      expect(walletData.wallet).to.have.property('mnemonic')
      expect(walletData.wallet).to.have.property('xecAddress')
      expect(walletData.description).to.equal('Test description')
    })

    it('should create wallet with provided mnemonic', async function () {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const walletData = await walletCreate.createWallet('test-wallet', 'Test description', testMnemonic)

      expect(mockMinimalXecWallet.calledWith(testMnemonic)).to.be.true
      expect(mockWalletUtil.saveWallet.calledOnce).to.be.true
      expect(walletData.wallet).to.have.property('mnemonic')
      expect(walletData.wallet).to.have.property('xecAddress')
    })

    it('should handle empty description parameter', async function () {
      const walletData = await walletCreate.createWallet('test-wallet')

      expect(walletData.description).to.equal('')
    })

    it('should handle null mnemonic parameter', async function () {
      const walletData = await walletCreate.createWallet('test-wallet', 'Test', null)

      expect(mockMinimalXecWallet.calledWith()).to.be.true
      expect(walletData).to.have.property('wallet')
    })

    it('should create wallet with CashTab derivation path', async function () {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const walletData = await walletCreate.createWallet('test-wallet', 'Test description', testMnemonic, true)

      // Should pass mnemonic and advanced options with hdPath
      expect(mockMinimalXecWallet.calledWith(testMnemonic, sinon.match.object)).to.be.true
      expect(mockWalletUtil.saveWallet.calledOnce).to.be.true

      // Check that compatibility metadata is stored
      expect(walletData.compatibility).to.exist
      expect(walletData.compatibility.derivationPath).to.equal('m/44\'/1899\'/0\'/0/0')
      expect(walletData.compatibility.standard).to.equal('CashTab')
      expect(walletData.compatibility.cashtabCompatible).to.be.true
    })

    it('should create wallet with standard derivation path by default', async function () {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const walletData = await walletCreate.createWallet('test-wallet', 'Test description', testMnemonic, false)

      expect(mockMinimalXecWallet.calledWith(testMnemonic, sinon.match.object)).to.be.true

      // Check that compatibility metadata reflects standard path
      expect(walletData.compatibility).to.exist
      expect(walletData.compatibility.derivationPath).to.equal('m/44\'/899\'/0\'/0/0')
      expect(walletData.compatibility.standard).to.equal('eCash BIP44')
      expect(walletData.compatibility.cashtabCompatible).to.be.false
    })

    it('should throw error for invalid wallet name', async function () {
      try {
        await walletCreate.createWallet('')
        expect.fail('Should have thrown error for empty wallet name')
      } catch (err) {
        expect(err.message).to.include('Wallet name is required')
      }
    })
  })

  describe('Integration scenarios', function () {
    beforeEach(function () {
      mockWalletUtil.walletExists.resolves(false)
      mockWalletUtil.saveWallet.resolves()
    })

    it('should handle complete wallet creation flow with mnemonic', async function () {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const flags = {
        name: 'test-integration-wallet',
        description: 'Integration test wallet',
        mnemonic: testMnemonic
      }

      // This should not throw and should complete successfully
      expect(() => walletCreate.validateFlags(flags)).to.not.throw()

      const walletData = await walletCreate.createWallet(flags.name, flags.description, flags.mnemonic)

      expect(walletData).to.have.property('wallet')
      expect(walletData.wallet).to.have.property('mnemonic')
      expect(walletData.wallet).to.have.property('xecAddress')
    })
  })
})
