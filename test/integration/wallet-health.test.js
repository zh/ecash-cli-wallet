/*
  Integration Tests for Wallet Health Command
  Tests the wallet-health command with real wallet data and analytics
*/

import { expect } from 'chai'
import { runCLI, cleanupTestWallets } from '../helpers/test-utils.js'

describe('Wallet Health Integration Tests', function () {
  // Increase timeout for CLI operations with analytics
  this.timeout(30000)

  afterEach(async function () {
    await cleanupTestWallets()
  })

  describe('Wallet Health Analysis', function () {
    it('should show health analysis for existing wallet', async function () {
      // Use the existing 'first' wallet which has UTXOs
      const result = await runCLI(['wallet-health', '--name', 'first'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('WALLET HEALTH DASHBOARD')
      expect(result.stdout).to.include('Overall Health:')
      expect(result.stdout).to.include('Key Health Metrics:')

      // Verify actual UTXO data is shown (not N/A)
      expect(result.stdout).to.include('Total UTXOs:')
      expect(result.stdout).to.not.include('Total UTXOs: N/A')
      expect(result.stdout).to.include('Healthy UTXOs:')

      // Should show balance information
      expect(result.stdout).to.include('Balance Health:')
      expect(result.stdout).to.include('Total Balance:')
      expect(result.stdout).to.include('XEC')
    })

    it('should handle wallet with analytics disabled gracefully', async function () {
      this.timeout(30000) // Runs 3 CLI commands
      // Use existing wallet instead of creating new one
      // Disable analytics for this test
      await runCLI(['config', 'analytics-disable'])

      const result = await runCLI(['wallet-health', '--name', 'first'])

      // Wallet health should still work (shows dashboard or informative message)
      expect(result.code).to.equal(0)
      expect(result.stdout).to.satisfy((output) => {
        return output.includes('WALLET HEALTH DASHBOARD') ||
               output.includes('Analytics are disabled')
      })

      // Re-enable analytics for other tests
      await runCLI(['config', 'analytics-enable'])
    })

    it('should provide detailed analysis when requested', async function () {
      this.timeout(20000) // Increase timeout for detailed analysis
      const result = await runCLI(['wallet-health', '--name', 'first', '--detailed'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('WALLET HEALTH DASHBOARD')
      expect(result.stdout).to.include('DETAILED HEALTH ANALYSIS')
      expect(result.stdout).to.include('UTXO Health by Classification')
    })

    it('should show dust attack analysis when requested', async function () {
      const result = await runCLI(['wallet-health', '--name', 'first', '--dust-analysis'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('DUST ATTACK ANALYSIS')
      expect(result.stdout).to.include('Risk Level:')
      expect(result.stdout).to.include('Detection Status:')
    })

    it('should show security analysis when requested', async function () {
      const result = await runCLI(['wallet-health', '--name', 'first', '--security'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('SECURITY THREAT ANALYSIS')
      expect(result.stdout).to.include('Privacy Score:')
    })

    it('should export health report when requested', async function () {
      const result = await runCLI(['wallet-health', '--name', 'first', '--export'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Health report exported to:')
      expect(result.stdout).to.include('.json')
    })

    it('should show actionable recommendations', async function () {
      const result = await runCLI(['wallet-health', '--name', 'first'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('ACTIONABLE RECOMMENDATIONS')

      // Should show either specific recommendations or no recommendations message
      expect(result.stdout).to.satisfy((output) => {
        return output.includes('Recommended Actions') ||
               output.includes('No specific recommendations') ||
               output.includes('good health')
      })
    })
  })

  describe('Health Metrics Validation', function () {
    it('should display numeric values for health metrics', async function () {
      this.timeout(15000)
      const result = await runCLI(['wallet-health', '--name', 'first'], { timeout: 15000 })

      expect(result.code).to.equal(0)

      // Extract the health metrics section
      const output = result.stdout
      expect(output).to.match(/Total UTXOs:\s+\d+/) // Should show actual number
      expect(output).to.match(/Healthy UTXOs:\s+\d+/) // Should show actual number
      expect(output).to.match(/Total Balance:\s+[\d,]+\.?\d*\s+XEC/) // Should show balance
    })

    it('should show health status other than unknown', async function () {
      const result = await runCLI(['wallet-health', '--name', 'first'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Overall Health:')

      // Should show a valid health status
      expect(result.stdout).to.satisfy((output) => {
        return output.includes('HEALTHY') ||
               output.includes('GOOD') ||
               output.includes('FAIR') ||
               output.includes('POOR') ||
               output.includes('CRITICAL')
      })

      // Should not show UNKNOWN
      expect(result.stdout).to.not.include('UNKNOWN')
    })

    it('should calculate spendable ratio correctly', async function () {
      this.timeout(15000)
      const result = await runCLI(['wallet-health', '--name', 'first'], { timeout: 15000 })

      expect(result.code).to.equal(0)
      expect(result.stdout).to.match(/Spendable Ratio:\s+[\d.]+%/)
    })
  })

  describe('Error Handling', function () {
    it('should handle non-existent wallet gracefully', async function () {
      const result = await runCLI(['wallet-health', '--name', 'non-existent-wallet'])

      // Should show analytics disabled message (since that's checked first)
      expect(result.stdout || result.stderr).to.include('Analytics are disabled')
      expect(result.stdout || result.stderr).to.include('Enable analytics')
    })

    it('should require wallet name parameter', async function () {
      const result = await runCLI(['wallet-health'])

      expect(result.stdout || result.stderr).to.include('wallet name')
    })

    it('should handle analytics initialization failures', async function () {
      // This test verifies that the command handles cases where analytics can't be initialized
      // Test with an empty/new wallet that may not have proper analytics setup

      const result = await runCLI(['wallet-health', '--name', 'non-existent-wallet'])

      // Should provide useful error messages
      expect(result.stdout || result.stderr).to.satisfy((output) => {
        return output.includes('Analytics') ||
               output.includes('not available') ||
               output.includes('not found') ||
               output.includes('Enable analytics')
      })
    })
  })

  describe('Command Options', function () {
    it('should show help when requested', async function () {
      const result = await runCLI(['wallet-health', '--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Usage:')
      expect(result.stdout).to.include('wallet-health')
      expect(result.stdout).to.include('--detailed')
      expect(result.stdout).to.include('--dust-analysis')
      expect(result.stdout).to.include('--security')
      expect(result.stdout).to.include('--export')
    })

    it('should accept short wallet name flag', async function () {
      this.timeout(15000) // Increase timeout for this specific test
      const result = await runCLI(['wallet-health', '-n', 'first'], { timeout: 15000 })

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('WALLET HEALTH DASHBOARD')
    })
  })
})
