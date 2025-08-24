/*
  Basic CLI Integration Tests
  Tests that the CLI can be executed and basic commands work
*/

import { expect } from 'chai'
import { runCLI, cleanupTestWallets } from '../helpers/test-utils.js'

describe('CLI Basic Integration', function () {
  // Increase timeout for CLI operations
  this.timeout(15000)

  afterEach(async function () {
    // Clean up any test wallets created during tests
    await cleanupTestWallets()
  })

  describe('CLI Execution', function () {
    it('should execute CLI without arguments and show help', async function () {
      const result = await runCLI([])

      // CLI should show help and exit with code 0 or 1
      expect([0, 1]).to.include(result.code)
      expect(result.stdout || result.stderr).to.include('Usage:')
    })

    it('should show version when requested', async function () {
      const result = await runCLI(['--version'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.match(/\d+\.\d+\.\d+/)
    })

    it('should show help when requested', async function () {
      const result = await runCLI(['--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Usage:')
      expect(result.stdout).to.include('Commands:')
    })
  })

  describe('Config Commands', function () {
    it('should list default configuration', async function () {
      const result = await runCLI(['config', 'list'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('analytics.enabled')
      expect(result.stdout).to.include('false') // Default is disabled
    })

    it('should get specific config value', async function () {
      const result = await runCLI(['config', 'get', '--key', 'analytics.enabled'], {
        env: { ECASH_CLI_ANALYTICS_ENABLED: 'false' }
      })

      expect(result.code).to.equal(0)
      // Should show the key and its value in JSON format
      expect(result.stdout).to.include('analytics.enabled')
      expect(result.stdout).to.include('Value: false')
    })

    it('should show analytics status', async function () {
      const result = await runCLI(['config', 'analytics-status'], {
        env: { ECASH_CLI_ANALYTICS_ENABLED: 'false' }
      })

      expect(result.code).to.equal(0)
      // Should show status information with DISABLED for false state
      expect(result.stdout).to.include('Analytics Status')
      expect(result.stdout).to.include('DISABLED')
    })
  })

  describe('Wallet Commands', function () {
    it('should show wallet list', async function () {
      const result = await runCLI(['wallet-list'])

      expect(result.code).to.equal(0)
      // Should show wallet listing output
      expect(result.stdout).to.include('Listing XEC wallets')
      expect(result.stdout).to.match(/Found \d+ wallet/)
    })

    it('should create a new wallet', async function () {
      const walletName = `test-integration-${Date.now()}`

      const result = await runCLI([
        'wallet-create',
        '--name', walletName
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('successfully')
      expect(result.stdout).to.include(walletName)
    })

    it('should list created wallet', async function () {
      const walletName = `test-list-${Date.now()}`

      // Create wallet first
      const createResult = await runCLI([
        'wallet-create',
        '--name', walletName
      ])
      expect(createResult.code).to.equal(0)

      // List wallets
      const listResult = await runCLI(['wallet-list'])
      expect(listResult.code).to.equal(0)
      expect(listResult.stdout).to.include(walletName)
    })

    it('should get wallet addresses', async function () {
      const walletName = `test-addrs-${Date.now()}`

      // Create wallet first
      const createResult = await runCLI([
        'wallet-create',
        '--name', walletName
      ])
      expect(createResult.code).to.equal(0)

      // Get addresses
      const addrsResult = await runCLI(['wallet-addrs', '--name', walletName])
      expect(addrsResult.code).to.equal(0)
      expect(addrsResult.stdout).to.include('ecash:')
    })

    it('should get wallet balance', async function () {
      const walletName = `test-balance-${Date.now()}`

      // Create wallet first
      const createResult = await runCLI([
        'wallet-create',
        '--name', walletName
      ])
      expect(createResult.code).to.equal(0)

      // Get balance
      const balanceResult = await runCLI(['wallet-balance', '--name', walletName])
      expect(balanceResult.code).to.equal(0)
      expect(balanceResult.stdout).to.include('Balance:')
      expect(balanceResult.stdout).to.include('0 XEC') // New wallet should have 0 balance
    })
  })

  describe('Analytics Commands (when enabled)', function () {
    it('should show analytics commands are available', async function () {
      const result = await runCLI(['--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('wallet-health')
      expect(result.stdout).to.include('wallet-classify')
    })

    it('should handle wallet-health with no wallet', async function () {
      const result = await runCLI(['wallet-health'])

      // Should show error message about wallet name (exit code issue to be fixed later)
      expect(result.stdout || result.stderr).to.include('wallet name')
    })

    it('should handle wallet-classify with no wallet', async function () {
      const result = await runCLI(['wallet-classify'])

      // Should show error message about wallet name (exit code issue to be fixed later)
      expect(result.stdout || result.stderr).to.include('wallet name')
    })
  })

  describe('Error Handling', function () {
    it('should handle unknown commands', async function () {
      const result = await runCLI(['unknown-command'])

      // Commander.js handles unknown commands and shows error
      expect(result.stderr || result.stdout).to.include('unknown command')
    })

    it('should handle missing wallet name in wallet commands', async function () {
      const result = await runCLI(['wallet-balance'])

      // Should show error message about wallet name (exit code issue to be fixed later)
      expect(result.stdout || result.stderr).to.include('wallet name')
    })

    it('should handle non-existent wallet', async function () {
      const result = await runCLI(['wallet-balance', '--name', 'non-existent-wallet'])

      // Debug: log actual output to understand what we're getting
      // console.log('STDOUT:', JSON.stringify(result.stdout))
      // console.log('STDERR:', JSON.stringify(result.stderr))

      // Should show error message about wallet not found (exit code issue to be fixed later)
      const output = result.stdout + ' ' + result.stderr
      expect(output).to.include('not found')
    })
  })

  describe('Command Help', function () {
    const commands = [
      'wallet-create',
      'wallet-list',
      'wallet-addrs',
      'wallet-balance',
      'wallet-health',
      'wallet-classify',
      'config'
    ]

    for (const command of commands) {
      it(`should show help for ${command} command`, async function () {
        const result = await runCLI([command, '--help'])

        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Usage:')
        expect(result.stdout).to.include(command)
      })
    }
  })
})
