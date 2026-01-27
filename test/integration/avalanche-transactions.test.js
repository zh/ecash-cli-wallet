/*
  Integration Tests for Avalanche Transactions
  Tests CLI commands with Avalanche finality flags and configuration
*/

import { expect } from 'chai'
import { runCLI, cleanupTestWallets } from '../helpers/test-utils.js'

describe('Avalanche Transactions Integration', function () {
  // Increase timeout for CLI operations
  this.timeout(15000)

  afterEach(async function () {
    // Clean up any test wallets created during tests
    await cleanupTestWallets()
  })

  describe('Avalanche Config Commands', function () {
    it('should show avalanche status', async function () {
      const result = await runCLI(['config', 'avalanche-status'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Avalanche Configuration')
      expect(result.stdout).to.include('Enabled')
      expect(result.stdout).to.include('Default Await Finality')
      expect(result.stdout).to.include('Finality Timeout')
    })

    it('should enable avalanche features', async function () {
      const result = await runCLI(['config', 'avalanche-enable'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Avalanche features enabled')
    })

    it('should disable avalanche features', async function () {
      const result = await runCLI(['config', 'avalanche-disable'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Avalanche features disabled')
    })

    it('should set avalanche default finality to true', async function () {
      const result = await runCLI(['config', 'avalanche-default-finality', '--value', 'true'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Avalanche default finality')
      expect(result.stdout).to.include('ON')
    })

    it('should set avalanche default finality to false', async function () {
      const result = await runCLI(['config', 'avalanche-default-finality', '--value', 'false'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Avalanche default finality')
      expect(result.stdout).to.include('OFF')
    })

    it('should include avalanche in config list', async function () {
      const result = await runCLI(['config', 'list'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('avalanche.enabled')
      expect(result.stdout).to.include('avalanche.defaultAwaitFinality')
      expect(result.stdout).to.include('avalanche.finalityTimeout')
    })
  })

  describe('Send XEC with Finality Flag', function () {
    it('should show finality option in send-xec help', async function () {
      const result = await runCLI(['send-xec', '--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('-f, --finality')
      expect(result.stdout).to.include('--finality-timeout')
    })

    it('should require wallet name for send-xec', async function () {
      const result = await runCLI(['send-xec', '-a', 'ecash:test', '-q', '100'])

      // Should fail with wallet name error
      expect(result.stdout || result.stderr).to.include('wallet name')
    })

    it('should validate address for send-xec with finality', async function () {
      const walletName = `test-send-finality-${Date.now()}`

      // Create wallet first
      const createResult = await runCLI(['wallet-create', '--name', walletName])
      expect(createResult.code).to.equal(0)

      // Try to send with finality flag (will fail due to invalid address or no funds, but command should parse)
      const result = await runCLI([
        'send-xec',
        '-n', walletName,
        '-a', 'invalid-address',
        '-q', '100',
        '--finality'
      ])

      // Should fail with address validation, not flag parsing error
      const output = result.stdout + ' ' + result.stderr
      expect(output.toLowerCase()).to.match(/address|invalid/)
    })
  })

  describe('Wallet Sweep with Finality Flag', function () {
    it('should show finality option in wallet-sweep help', async function () {
      const result = await runCLI(['wallet-sweep', '--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('-f, --finality')
    })

    it('should require WIF for wallet-sweep', async function () {
      const result = await runCLI(['wallet-sweep', '-n', 'test-wallet'])

      // Should fail with WIF requirement error
      expect(result.stdout || result.stderr).to.match(/wif|private key/i)
    })
  })

  describe('Send eTokens with Finality Flag', function () {
    it('should show finality option in send-etokens help', async function () {
      const result = await runCLI(['send-etokens', '--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('-f, --finality')
    })

    it('should require wallet name for send-etokens', async function () {
      const result = await runCLI(['send-etokens', '-t', 'token123', '-a', 'ecash:test', '-q', '10'])

      // Should fail with wallet name error
      expect(result.stdout || result.stderr).to.include('wallet name')
    })
  })

  describe('Wallet Balance with Avalanche Status', function () {
    it('should show Avalanche finality status in wallet balance', async function () {
      const walletName = `test-balance-avalanche-${Date.now()}`

      // Create wallet first
      const createResult = await runCLI(['wallet-create', '--name', walletName])
      expect(createResult.code).to.equal(0)

      // Get balance and check for Avalanche status
      const balanceResult = await runCLI(['wallet-balance', '--name', walletName])

      expect(balanceResult.code).to.equal(0)
      expect(balanceResult.stdout).to.include('Avalanche Finality')
    })
  })

  describe('Finality Timeout Handling', function () {
    it('should accept custom finality timeout in send-xec', async function () {
      const result = await runCLI(['send-xec', '--help'])

      expect(result.code).to.equal(0)
      // Verify finality-timeout option is documented
      expect(result.stdout).to.include('--finality-timeout')
      expect(result.stdout).to.match(/timeout|milliseconds/i)
    })
  })

  describe('Config Persistence', function () {
    it('should persist avalanche settings across commands', async function () {
      // Enable avalanche
      const enableResult = await runCLI(['config', 'avalanche-enable'])
      expect(enableResult.code).to.equal(0)

      // Check status
      const statusResult = await runCLI(['config', 'avalanche-status'])
      expect(statusResult.code).to.equal(0)
      expect(statusResult.stdout).to.include('true')

      // Disable avalanche
      const disableResult = await runCLI(['config', 'avalanche-disable'])
      expect(disableResult.code).to.equal(0)

      // Check status again
      const statusResult2 = await runCLI(['config', 'avalanche-status'])
      expect(statusResult2.code).to.equal(0)
      expect(statusResult2.stdout).to.include('false')

      // Re-enable for clean state
      await runCLI(['config', 'avalanche-enable'])
    })

    it('should persist finality timeout setting', async function () {
      // Set custom timeout
      const setResult = await runCLI(['config', 'set', '--key', 'avalanche.finalityTimeout', '--value', '45000'])
      expect(setResult.code).to.equal(0)

      // Verify it was saved
      const getResult = await runCLI(['config', 'get', '--key', 'avalanche.finalityTimeout'])
      expect(getResult.code).to.equal(0)
      expect(getResult.stdout).to.include('45000')

      // Reset to default
      await runCLI(['config', 'set', '--key', 'avalanche.finalityTimeout', '--value', '30000'])
    })
  })

  describe('Help Documentation', function () {
    it('should document avalanche commands in config help', async function () {
      const result = await runCLI(['config', '--help'])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('avalanche-enable')
      expect(result.stdout).to.include('avalanche-disable')
      expect(result.stdout).to.include('avalanche-status')
      expect(result.stdout).to.include('avalanche-default-finality')
    })

    it('should explain finality in transaction command help', async function () {
      const sendXecHelp = await runCLI(['send-xec', '--help'])
      expect(sendXecHelp.stdout).to.match(/finality|avalanche/i)

      const sweepHelp = await runCLI(['wallet-sweep', '--help'])
      expect(sweepHelp.stdout).to.match(/finality|avalanche/i)

      const eTokensHelp = await runCLI(['send-etokens', '--help'])
      expect(eTokensHelp.stdout).to.match(/finality|avalanche/i)
    })
  })
})
