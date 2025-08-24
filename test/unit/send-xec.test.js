/*
  Unit Tests for SendXec Command
  Tests XEC sending functionality including smart coin selection strategies
*/

import { expect } from 'chai'
import sinon from 'sinon'
import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import SendXec from '../../src/commands/send-xec.js'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('SendXec Command', function () {
  let sendXec
  let mockWallet
  let mockUtxos
  let mockWalletUtil
  let tempWalletPath

  beforeEach(function () {
    // Create SendXec instance
    sendXec = new SendXec()

    // Create temp wallet path for each test
    const tempDir = path.join(__dirname, '../fixtures/temp')
    tempWalletPath = path.join(tempDir, `test-wallet-${Date.now()}.json`)

    // Mock wallet utility
    mockWalletUtil = {
      loadWallet: sinon.stub(),
      getAnalyticsOptions: sinon.stub(),
      isWalletAnalyticsEnabled: sinon.stub()
    }
    sendXec.walletUtil = mockWalletUtil

    // Mock UTXO analytics
    mockUtxos = {
      hasAnalytics: sinon.stub().returns(true),
      detectSecurityThreats: sinon.stub(),
      getUtxoClassifications: sinon.stub(),
      utxoStore: {
        xecUtxos: []
      }
    }

    // Mock wallet instance
    mockWallet = {
      walletInfo: {
        xecAddress: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy'
      },
      walletInfoPromise: Promise.resolve(),
      initialize: sinon.stub().resolves(),
      getXecBalance: sinon.stub().resolves(1000),
      sendXec: sinon.stub().resolves('mockTxId123'),
      sendXecWithStrategy: sinon.stub().resolves('mockStrategyTxId123'),
      setUtxoSelectionStrategy: sinon.stub().resolves(),
      utxos: mockUtxos
    }

    // Mock MinimalXecWallet constructor
    sendXec.MinimalXecWallet = sinon.stub().returns(mockWallet)
  })

  afterEach(async function () {
    // Clean up temp wallet file
    try {
      await fs.unlink(tempWalletPath)
    } catch (err) {
      // Ignore if file doesn't exist
    }

    // Restore all stubs
    sinon.restore()
  })

  describe('Constructor', function () {
    it('should create SendXec instance with proper dependencies', function () {
      expect(sendXec).to.be.instanceOf(SendXec)
      expect(sendXec.MinimalXecWallet).to.be.a('function')
      expect(sendXec.walletUtil).to.be.an('object') // Changed from instanceOf since we're using mock
    })

    it('should bind all methods properly', function () {
      expect(sendXec.run).to.be.a('function')
      expect(sendXec.validateFlags).to.be.a('function')
      expect(sendXec.validateStrategy).to.be.a('function')
      expect(sendXec.validateTransactionSafety).to.be.a('function')
    })
  })

  describe('validateStrategy', function () {
    it('should accept valid strategies', function () {
      expect(() => sendXec.validateStrategy('efficient')).to.not.throw()
      expect(() => sendXec.validateStrategy('privacy')).to.not.throw()
      expect(() => sendXec.validateStrategy('security')).to.not.throw()
      expect(() => sendXec.validateStrategy('EFFICIENT')).to.not.throw() // case insensitive
      expect(() => sendXec.validateStrategy(' privacy ')).to.not.throw() // whitespace trimmed
    })

    it('should reject invalid strategies', function () {
      expect(() => sendXec.validateStrategy('invalid')).to.throw(/Invalid strategy/)
      expect(() => sendXec.validateStrategy('fast')).to.throw(/Invalid strategy/)
      expect(() => sendXec.validateStrategy('')).to.throw(/must be a non-empty string/)
      expect(() => sendXec.validateStrategy(null)).to.throw(/must be a non-empty string/)
      expect(() => sendXec.validateStrategy(123)).to.throw(/must be a non-empty string/)
    })

    it('should provide helpful error messages', function () {
      try {
        sendXec.validateStrategy('invalid')
      } catch (err) {
        expect(err.message).to.include('Valid strategies: efficient, privacy, security')
      }
    })
  })

  describe('validateFlags', function () {
    it('should validate required flags', function () {
      const validFlags = {
        name: 'test-wallet',
        addr: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        qty: '100'
      }

      expect(() => sendXec.validateFlags(validFlags)).to.not.throw()
    })

    it('should reject missing required flags', function () {
      expect(() => sendXec.validateFlags({})).to.throw(/wallet name/)
      expect(() => sendXec.validateFlags({ name: 'test' })).to.throw(/recipient address/)
      expect(() => sendXec.validateFlags({ name: 'test', addr: 'ecash:test' })).to.throw(/quantity/)
    })

    it('should validate strategy when provided', function () {
      const flagsWithStrategy = {
        name: 'test-wallet',
        addr: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        qty: '100',
        strategy: 'efficient'
      }

      expect(() => sendXec.validateFlags(flagsWithStrategy)).to.not.throw()

      const flagsWithInvalidStrategy = {
        ...flagsWithStrategy,
        strategy: 'invalid'
      }

      expect(() => sendXec.validateFlags(flagsWithInvalidStrategy)).to.throw(/Invalid strategy/)
    })
  })

  describe('validateTransactionSafety', function () {
    const mockOutputs = [{
      address: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
      amount: 10000 // 100 XEC in satoshis
    }]

    beforeEach(function () {
      // Setup console.log stub to capture validation output
      sinon.stub(console, 'log')
      sinon.stub(console, 'warn')
    })

    it('should validate security strategy', async function () {
      const flags = { strategy: 'security' }

      // Mock security threats detection
      mockUtxos.detectSecurityThreats.returns({
        dustAttack: { detected: false, confidence: 0 },
        riskLevel: 'low'
      })

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWith('Performing security strategy safety validation...')).to.be.true
      expect(console.log.calledWith('  [HEALTHY] Security strategy validation passed')).to.be.true
    })

    it('should detect and warn about dust attacks', async function () {
      const flags = { strategy: 'security' }

      // Mock high-confidence dust attack
      mockUtxos.detectSecurityThreats.returns({
        dustAttack: { detected: true, confidence: 0.8 },
        riskLevel: 'high'
      })

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWithMatch(/HIGH RISK.*dust attack/)).to.be.true
    })

    it('should validate privacy strategy', async function () {
      const flags = { strategy: 'privacy' }

      // Mock UTXO classifications
      mockUtxos.getUtxoClassifications.returns({
        statistics: { reusedAddresses: 0 }
      })

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWith('  Validating privacy strategy requirements...')).to.be.true
      expect(console.log.calledWith('  [HEALTHY] Privacy strategy validation passed')).to.be.true
    })

    it('should validate efficiency strategy', async function () {
      const flags = { strategy: 'efficient' }

      // Mock UTXO store with moderate UTXO count
      mockUtxos.utxoStore.xecUtxos = new Array(25) // 25 UTXOs

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWith('  Validating efficiency strategy requirements...')).to.be.true
      expect(console.log.calledWith('  [HEALTHY] Efficiency strategy validation passed')).to.be.true
    })

    it('should warn about high UTXO count in efficiency strategy', async function () {
      const flags = { strategy: 'efficient' }

      // Mock high UTXO count
      mockUtxos.utxoStore.xecUtxos = new Array(60) // 60 UTXOs

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWithMatch(/High UTXO count.*60/)).to.be.true
      expect(console.log.calledWithMatch(/wallet-optimize command/)).to.be.true
    })

    it('should handle large transaction amounts', async function () {
      const flags = { strategy: 'efficient' }
      const largeOutputs = [{
        address: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        amount: 150000 // 1500 XEC in satoshis
      }]

      const result = await sendXec.validateTransactionSafety(mockWallet, largeOutputs, flags)
      expect(result).to.be.true

      expect(console.log.calledWithMatch(/Large transaction.*1500 XEC/)).to.be.true
    })

    it('should handle validation errors gracefully', async function () {
      const flags = { strategy: 'security' }

      // Mock error in security threats detection
      mockUtxos.detectSecurityThreats.throws(new Error('Mock analytics error'))

      const result = await sendXec.validateTransactionSafety(mockWallet, mockOutputs, flags)
      expect(result).to.be.true

      expect(console.warn.calledWithMatch(/Could not get security threat analysis/)).to.be.true
    })
  })

  describe('sendXecWithStrategy', function () {
    const mockOutputs = [{
      address: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
      amount: 10000
    }]
    const mockStrategyOptions = {
      strategy: 'efficient',
      feeRate: 1.0
    }

    beforeEach(function () {
      sinon.stub(console, 'log')
    })

    it('should use native strategy method if available', async function () {
      // Mock wallet has native strategy support
      mockWallet.sendXecWithStrategy = sinon.stub().resolves('strategyTxId123')

      const result = await sendXec.sendXecWithStrategy(mockWallet, mockOutputs, mockStrategyOptions)

      expect(result).to.equal('strategyTxId123')
      expect(mockWallet.sendXecWithStrategy.calledWith(mockOutputs, mockStrategyOptions)).to.be.true
      expect(console.log.calledWithMatch(/native.*efficient.*strategy/)).to.be.true
    })

    it('should use strategy configuration method if available', async function () {
      // Create fresh mock wallet for this test
      const testWallet = {
        sendXecWithStrategy: undefined, // No native strategy method
        setUtxoSelectionStrategy: sinon.stub().resolves(),
        sendXec: sinon.stub().resolves('configuredTxId123')
      }

      const result = await sendXec.sendXecWithStrategy(testWallet, mockOutputs, mockStrategyOptions)

      expect(result).to.equal('configuredTxId123')
      expect(testWallet.setUtxoSelectionStrategy.calledWith('efficient')).to.be.true
      expect(testWallet.sendXec.calledWith(mockOutputs)).to.be.true
      expect(console.log.calledWithMatch(/Configuring wallet to use.*efficient/)).to.be.true
    })

    it('should fall back to regular sendXec with analytics influence', async function () {
      // Create fresh mock wallet with no special strategy methods
      const testWallet = {
        sendXecWithStrategy: undefined,
        setUtxoSelectionStrategy: undefined,
        sendXec: sinon.stub().resolves('regularTxId123')
      }

      const result = await sendXec.sendXecWithStrategy(testWallet, mockOutputs, mockStrategyOptions)

      expect(result).to.equal('regularTxId123')
      expect(testWallet.sendXec.calledWith(mockOutputs)).to.be.true
      expect(console.log.calledWithMatch(/analytics-influenced UTXO selection/)).to.be.true
    })

    it('should log strategy-specific focus messages', async function () {
      // Test privacy strategy
      const testWalletPrivacy = { sendXec: sinon.stub().resolves('txId123') }
      await sendXec.sendXecWithStrategy(testWalletPrivacy, mockOutputs, { strategy: 'privacy' })
      expect(console.log.calledWithMatch(/Minimizing address linking/)).to.be.true

      // Reset console log
      console.log.resetHistory()

      // Test security strategy
      const testWalletSecurity = { sendXec: sinon.stub().resolves('txId123') }
      await sendXec.sendXecWithStrategy(testWalletSecurity, mockOutputs, { strategy: 'security' })
      expect(console.log.calledWithMatch(/Avoiding potentially problematic UTXOs/)).to.be.true

      // Reset console log
      console.log.resetHistory()

      // Test efficiency strategy
      const testWalletEfficiency = { sendXec: sinon.stub().resolves('txId123') }
      await sendXec.sendXecWithStrategy(testWalletEfficiency, mockOutputs, { strategy: 'efficient' })
      expect(console.log.calledWithMatch(/Minimizing transaction fees/)).to.be.true
    })

    it('should handle errors and provide meaningful messages', async function () {
      const testWallet = { sendXec: sinon.stub().rejects(new Error('Mock send error')) }

      try {
        await sendXec.sendXecWithStrategy(testWallet, mockOutputs, mockStrategyOptions)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.match(/Smart selection failed.*Mock send error/)
      }
    })
  })

  describe('sendXec', function () {
    const mockWalletData = {
      wallet: {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      }
    }

    const mockFlags = {
      name: 'test-wallet',
      addr: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
      qty: '100'
    }

    beforeEach(function () {
      sinon.stub(console, 'log')
      sinon.stub(console, 'warn')
      mockWalletUtil.loadWallet.resolves(mockWalletData)
      mockWalletUtil.getAnalyticsOptions.resolves({ utxoAnalytics: { enabled: true } })
    })

    it('should send XEC without strategy (original behavior)', async function () {
      mockWallet.getXecBalance.resolves(1000)
      mockWallet.sendXec.resolves('normalTxId123')

      const result = await sendXec.sendXec(mockWalletData, mockFlags)

      expect(result).to.equal('normalTxId123')
      expect(sendXec.MinimalXecWallet.calledWith(mockWalletData.wallet.mnemonic)).to.be.true
      expect(mockWallet.sendXec.calledOnce).to.be.true
    })

    it('should send XEC with strategy when provided', async function () {
      const strategyFlags = { ...mockFlags, strategy: 'efficient' }
      mockWallet.getXecBalance.resolves(1000)
      mockWallet.sendXec.resolves('strategyTxId123')

      // Mock sendXecWithStrategy to be called
      const sendXecWithStrategySpy = sinon.stub(sendXec, 'sendXecWithStrategy').resolves('strategyTxId123')

      const result = await sendXec.sendXec(mockWalletData, strategyFlags)

      expect(result).to.equal('strategyTxId123')
      expect(console.log.calledWithMatch(/Using efficient strategy/)).to.be.true
      expect(sendXecWithStrategySpy.calledOnce).to.be.true
    })

    it('should fall back to standard method when analytics fail', async function () {
      const strategyFlags = { ...mockFlags, strategy: 'privacy' }
      mockWallet.getXecBalance.resolves(1000)
      mockWallet.sendXec.resolves('fallbackTxId123')

      // Mock analytics unavailable
      mockUtxos.hasAnalytics.returns(false)

      const result = await sendXec.sendXec(mockWalletData, strategyFlags)

      expect(result).to.equal('fallbackTxId123')
      expect(console.warn.calledWithMatch(/Analytics not available.*falling back/)).to.be.true
    })

    it('should fall back when smart selection fails', async function () {
      const strategyFlags = { ...mockFlags, strategy: 'security' }
      mockWallet.getXecBalance.resolves(1000)
      mockWallet.sendXec.resolves('fallbackTxId123')

      // Mock smart selection failure
      sinon.stub(sendXec, 'sendXecWithStrategy')
        .rejects(new Error('Mock strategy error'))

      const result = await sendXec.sendXec(mockWalletData, strategyFlags)

      expect(result).to.equal('fallbackTxId123')
      expect(console.warn.calledWithMatch(/Smart selection failed.*falling back/)).to.be.true
    })

    it('should check insufficient funds', async function () {
      mockWallet.getXecBalance.resolves(50) // Less than requested 100 XEC

      try {
        await sendXec.sendXec(mockWalletData, mockFlags)
        expect.fail('Should have thrown insufficient funds error')
      } catch (err) {
        expect(err.message).to.match(/Insufficient funds.*100.*50/)
      }
    })

    it('should properly convert XEC to satoshis', async function () {
      mockWallet.getXecBalance.resolves(1000)
      mockWallet.sendXec.resolves('txId123')

      await sendXec.sendXec(mockWalletData, { ...mockFlags, qty: '123.45' })

      // Should be called with 12345 satoshis (123.45 * 100)
      const sendXecCall = mockWallet.sendXec.getCall(0)
      expect(sendXecCall.args[0][0].amount).to.equal(12345)
    })
  })

  describe('Integration scenarios', function () {
    beforeEach(function () {
      sinon.stub(console, 'log')
      sinon.stub(console, 'warn')
    })

    it('should handle complete strategy transaction flow', async function () {
      const walletData = {
        wallet: {
          mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
        }
      }

      const flags = {
        name: 'test-wallet',
        addr: 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        qty: '100',
        strategy: 'privacy'
      }

      // Setup all mocks for successful transaction
      mockWalletUtil.loadWallet.resolves(walletData)
      mockWalletUtil.getAnalyticsOptions.resolves({ utxoAnalytics: { enabled: true } })
      mockWallet.getXecBalance.resolves(1000)
      mockUtxos.detectSecurityThreats.returns({ dustAttack: { detected: false } })
      mockUtxos.getUtxoClassifications.returns({ statistics: { reusedAddresses: 0 } })

      const sendXecWithStrategySpy = sinon.stub(sendXec, 'sendXecWithStrategy').resolves('completeTxId123')

      const result = await sendXec.sendXec(walletData, flags)

      expect(result).to.equal('completeTxId123')
      expect(console.log.calledWithMatch(/privacy strategy safety validation/)).to.be.true
      expect(console.log.calledWithMatch(/Using privacy strategy/)).to.be.true
      expect(sendXecWithStrategySpy.calledOnce).to.be.true
    })
  })
})
