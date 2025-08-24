/*
  Unit Tests for Wallet Health Command
  Tests the WalletHealth class methods and data processing
*/

import { expect, use } from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import WalletHealth from '../../src/commands/wallet-health.js'

// Configure chai to use sinon-chai
use(sinonChai)

describe('WalletHealth Unit Tests', function () {
  let walletHealth
  let sandbox

  beforeEach(function () {
    sandbox = sinon.createSandbox()
    walletHealth = new WalletHealth()
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('Constructor', function () {
    it('should create WalletHealth instance with proper bindings', function () {
      expect(walletHealth).to.be.instanceOf(WalletHealth)
      expect(walletHealth.walletUtil).to.exist
      expect(walletHealth.configManager).to.exist
      expect(walletHealth.run).to.be.a('function')
      expect(walletHealth.validateFlags).to.be.a('function')
      expect(walletHealth.analyzeWalletHealth).to.be.a('function')
    })
  })

  describe('validateFlags', function () {
    it('should require wallet name', function () {
      expect(() => walletHealth.validateFlags({})).to.throw('wallet name')
      expect(() => walletHealth.validateFlags({ name: '' })).to.throw('wallet name')
    })

    it('should pass validation with valid wallet name', function () {
      expect(walletHealth.validateFlags({ name: 'test-wallet' })).to.equal(true)
    })
  })

  describe('formatHealthScore', function () {
    it('should format numeric health scores correctly', function () {
      expect(walletHealth.formatHealthScore(95)).to.equal('EXCELLENT (95)')
      expect(walletHealth.formatHealthScore(75)).to.equal('GOOD (75)')
      expect(walletHealth.formatHealthScore(55)).to.equal('FAIR (55)')
      expect(walletHealth.formatHealthScore(35)).to.equal('POOR (35)')
      expect(walletHealth.formatHealthScore(15)).to.equal('CRITICAL (15)')
    })

    it('should format string health statuses correctly', function () {
      expect(walletHealth.formatHealthScore('healthy')).to.equal('HEALTHY')
      expect(walletHealth.formatHealthScore('at-risk')).to.equal('AT RISK')
      expect(walletHealth.formatHealthScore('at_risk')).to.equal('AT RISK')
      expect(walletHealth.formatHealthScore('unhealthy')).to.equal('UNHEALTHY')
      expect(walletHealth.formatHealthScore('critical')).to.equal('CRITICAL')
    })

    it('should handle unknown health values', function () {
      expect(walletHealth.formatHealthScore('unknown')).to.equal('UNKNOWN')
      expect(walletHealth.formatHealthScore(undefined)).to.equal('UNKNOWN')
      expect(walletHealth.formatHealthScore(null)).to.equal('UNKNOWN')
    })
  })

  describe('formatRiskLevel', function () {
    it('should format risk levels correctly', function () {
      expect(walletHealth.formatRiskLevel('low')).to.equal('LOW')
      expect(walletHealth.formatRiskLevel('medium')).to.equal('MEDIUM')
      expect(walletHealth.formatRiskLevel('high')).to.equal('HIGH')
      expect(walletHealth.formatRiskLevel('critical')).to.equal('CRITICAL')
      expect(walletHealth.formatRiskLevel('unknown')).to.equal('UNKNOWN')
    })
  })

  describe('getAgeHealthIndicator', function () {
    it('should return correct indicators for age classifications', function () {
      expect(walletHealth.getAgeHealthIndicator('unconfirmed')).to.equal('(WATCH)')
      expect(walletHealth.getAgeHealthIndicator('fresh')).to.equal('(NORMAL)')
      expect(walletHealth.getAgeHealthIndicator('recent')).to.equal('(GOOD)')
      expect(walletHealth.getAgeHealthIndicator('mature')).to.equal('(EXCELLENT)')
      expect(walletHealth.getAgeHealthIndicator('aged')).to.equal('(EXCELLENT)')
      expect(walletHealth.getAgeHealthIndicator('ancient')).to.equal('(STABLE)')
      expect(walletHealth.getAgeHealthIndicator('unknown')).to.equal('')
    })
  })

  describe('getValueHealthIndicator', function () {
    it('should return correct indicators for value classifications', function () {
      expect(walletHealth.getValueHealthIndicator('dust')).to.equal('(WARNING - Uneconomical)')
      expect(walletHealth.getValueHealthIndicator('micro')).to.equal('(CAUTION - Low value)')
      expect(walletHealth.getValueHealthIndicator('small')).to.equal('(NORMAL)')
      expect(walletHealth.getValueHealthIndicator('medium')).to.equal('(GOOD)')
      expect(walletHealth.getValueHealthIndicator('large')).to.equal('(EXCELLENT)')
      expect(walletHealth.getValueHealthIndicator('whale')).to.equal('(HIGH VALUE)')
      expect(walletHealth.getValueHealthIndicator('unknown')).to.equal('')
    })
  })

  describe('getPriorityIndicator', function () {
    it('should return correct priority indicators', function () {
      expect(walletHealth.getPriorityIndicator('critical')).to.equal('[CRITICAL]')
      expect(walletHealth.getPriorityIndicator('high')).to.equal('[HIGH]')
      expect(walletHealth.getPriorityIndicator('medium')).to.equal('[MEDIUM]')
      expect(walletHealth.getPriorityIndicator('low')).to.equal('[LOW]')
      expect(walletHealth.getPriorityIndicator(undefined)).to.equal('[INFO]')
      expect(walletHealth.getPriorityIndicator(null)).to.equal('[INFO]')
    })
  })

  describe('displayHealthDashboard', function () {
    let consoleLogStub

    beforeEach(function () {
      consoleLogStub = sandbox.stub(console, 'log')
    })

    it('should display health dashboard with proper data access', async function () {
      const mockHealthData = {
        walletName: 'test-wallet',
        address: 'ecash:qp123456789',
        analysisTime: new Date().toISOString(),
        balance: { total: 1000, confirmed: 1000 },
        healthReport: {
          overallHealth: 'healthy',
          metrics: {
            totalUtxos: 5,
            healthyUtxos: 4,
            dustUtxos: 1,
            suspiciousUtxos: 0,
            unconfirmedUtxos: 0
          },
          summary: {
            spendablePercentage: 80.0,
            tokenUtxos: 2
          },
          alerts: []
        },
        tokenAwareMetrics: {
          totalUtxos: 5,
          healthyUtxos: 4,
          pureDustUtxos: 1,
          tokenUtxos: 2,
          suspiciousUtxos: 0,
          tokenPortfolio: {
            uniqueTokens: 2,
            mintBatons: 0
          }
        }
      }

      const result = await walletHealth.displayHealthDashboard(mockHealthData, {})

      expect(result).to.equal(true)
      expect(consoleLogStub).to.have.been.called

      // Check that the correct data was accessed and displayed
      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]).join(' ')
      expect(logCalls).to.include('test-wallet')
      expect(logCalls).to.include('HEALTHY')
      expect(logCalls).to.include('Total UTXOs: 5')
      expect(logCalls).to.include('Healthy UTXOs: 4')
      expect(logCalls).to.include('Pure Dust UTXOs: 1')
      expect(logCalls).to.include('1,000 XEC')
      expect(logCalls).to.include('80.0%')
    })

    it('should handle missing or undefined health data gracefully', async function () {
      const mockHealthData = {
        walletName: 'test-wallet',
        address: 'ecash:qp123456789',
        analysisTime: new Date().toISOString(),
        balance: { total: 0, confirmed: 0 },
        healthReport: {
          overallHealth: undefined,
          metrics: {},
          summary: {},
          alerts: []
        }
      }

      const result = await walletHealth.displayHealthDashboard(mockHealthData, {})

      expect(result).to.equal(true)
      expect(consoleLogStub).to.have.been.called

      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]).join(' ')
      expect(logCalls).to.include('Total UTXOs: N/A')
      expect(logCalls).to.include('Healthy UTXOs: 0')
      expect(logCalls).to.include('UNKNOWN')
    })

    it('should display alerts when present', async function () {
      const mockHealthData = {
        walletName: 'test-wallet',
        address: 'ecash:qp123456789',
        analysisTime: new Date().toISOString(),
        balance: { total: 1000, confirmed: 1000 },
        healthReport: {
          overallHealth: 'at-risk',
          metrics: { totalUtxos: 10, healthyUtxos: 5 },
          summary: {},
          alerts: [
            { severity: 'critical', message: 'High dust ratio detected' },
            { severity: 'high', message: 'Possible dust attack' },
            { severity: 'medium', message: 'Low privacy score' },
            { severity: 'low', message: 'Consider consolidation' }
          ]
        }
      }

      const result = await walletHealth.displayHealthDashboard(mockHealthData, {})

      expect(result).to.equal(true)
      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]).join(' ')
      expect(logCalls).to.include('CRITICAL ALERTS')
      expect(logCalls).to.include('High dust ratio detected')
      expect(logCalls).to.include('Possible dust attack')
      // Should only show first 3 critical/high alerts
      expect(logCalls).to.not.include('Consider consolidation')
    })
  })

  describe('displayActionableRecommendations', function () {
    let consoleLogStub

    beforeEach(function () {
      consoleLogStub = sandbox.stub(console, 'log')
    })

    it('should display recommendations sorted by priority', async function () {
      const mockHealthData = {
        recommendations: [
          { priority: 'low', message: 'Consider address rotation', action: 'Use new address' },
          { priority: 'critical', message: 'Consolidate dust UTXOs', potentialSavings: 1000 },
          { priority: 'high', message: 'Review suspicious transactions', command: 'wallet-classify' },
          { priority: 'medium', message: 'Improve privacy score' }
        ]
      }

      const result = await walletHealth.displayActionableRecommendations(mockHealthData, {})

      expect(result).to.equal(true)
      expect(consoleLogStub).to.have.been.called

      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]).join(' ')
      expect(logCalls).to.include('ACTIONABLE RECOMMENDATIONS')
      expect(logCalls).to.include('[CRITICAL] Consolidate dust UTXOs')
      expect(logCalls).to.include('[HIGH] Review suspicious transactions')
      expect(logCalls).to.include('[MEDIUM] Improve privacy score')
      expect(logCalls).to.include('[LOW] Consider address rotation')
      expect(logCalls).to.include('Potential savings: 1000')
      expect(logCalls).to.include('Command: wallet-classify')
    })

    it('should show no recommendations message when empty', async function () {
      const mockHealthData = {
        recommendations: []
      }

      const result = await walletHealth.displayActionableRecommendations(mockHealthData, {})

      expect(result).to.equal(true)
      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]).join(' ')
      expect(logCalls).to.include('No specific recommendations')
      expect(logCalls).to.include('good health')
    })
  })

  describe('run method', function () {
    it('should validate flags and proceed with analysis', async function () {
      // Mock all the dependencies and methods
      sandbox.stub(walletHealth.walletUtil, 'isWalletAnalyticsEnabled').resolves(true)
      sandbox.stub(walletHealth, 'analyzeWalletHealth').resolves({
        walletName: 'test-wallet',
        healthReport: { overallHealth: 'healthy', metrics: {}, alerts: [], recommendations: [], summary: {} },
        analysisTime: new Date().toISOString()
      })
      sandbox.stub(walletHealth, 'displayHealthDashboard').resolves(true)
      sandbox.stub(walletHealth, 'displayActionableRecommendations').resolves(true)
      sandbox.stub(console, 'log')

      const result = await walletHealth.run({ name: 'test-wallet' })

      expect(result).to.equal(true)
      expect(walletHealth.walletUtil.isWalletAnalyticsEnabled).to.have.been.calledOnce
      expect(walletHealth.analyzeWalletHealth).to.have.been.calledOnce
      expect(walletHealth.displayHealthDashboard).to.have.been.calledOnce
    })

    it('should handle analytics disabled gracefully', async function () {
      sandbox.stub(walletHealth.walletUtil, 'isWalletAnalyticsEnabled').resolves(false)
      sandbox.stub(console, 'log')

      const result = await walletHealth.run({ name: 'test-wallet' })

      expect(result).to.equal(false)
      expect(walletHealth.walletUtil.isWalletAnalyticsEnabled).to.have.been.calledOnce
    })

    it('should handle errors and return false', async function () {
      sandbox.stub(walletHealth.walletUtil, 'isWalletAnalyticsEnabled').rejects(new Error('Test error'))
      sandbox.stub(console, 'error')

      const result = await walletHealth.run({ name: 'test-wallet' })

      expect(result).to.equal(0)
      expect(console.error).to.have.been.calledWith(sinon.match('Error analyzing wallet health'))
    })
  })
})
