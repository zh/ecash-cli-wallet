/*
  Integration Tests for Wallet Creation with Mnemonic Support
  Tests the wallet-create command with mnemonic parameter
*/

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai'
import { runCLI, cleanupTestWallets, generateTestWalletName } from '../helpers/test-utils.js'

describe('Wallet Create with Mnemonic Integration Tests', function () {
  // Increase timeout for wallet operations
  this.timeout(15000)

  afterEach(async function () {
    await cleanupTestWallets()
  })

  // Skip cleanup for duplicate wallet test
  describe('Edge Cases', function () {
    // Override afterEach for this describe block
    afterEach(function () {
      // Don't clean up for duplicate wallet test
    })

    it('should prevent duplicate wallet creation', async function () {
      const walletName = generateTestWalletName()

      // Create first wallet
      const result1 = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_12
      ])
      expect(result1.code).to.equal(0)

      // Try to create second wallet with same name
      const result2 = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_24
      ])

      expect(result2.code).to.not.equal(0)
      expect(result2.stderr).to.satisfy((output) => {
        return output.includes('already exists') ||
               output.includes('Wallet \'' + walletName + '\' already exists')
      })
    })
  })

  // Test mnemonics from test-utils.js
  const TEST_MNEMONIC_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const TEST_MNEMONIC_24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

  describe('Mnemonic Parameter Support', function () {
    it('should create wallet with 12-word mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_12
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
      expect(result.stdout).to.include('Wallet created from provided mnemonic.')
      expect(result.stdout).to.include('SECURITY WARNING:')
      expect(result.stdout).to.include(`Name: ${walletName}`)
      expect(result.stdout).to.include('XEC Address:')
    })

    it('should create wallet with 24-word mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_24
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
      expect(result.stdout).to.include('Wallet created from provided mnemonic.')
      expect(result.stdout).to.include(walletName)
    })

    it('should create deterministic addresses from same mnemonic', async function () {
      const mnemonic = TEST_MNEMONIC_12
      const walletName1 = generateTestWalletName()
      const walletName2 = generateTestWalletName()

      // Create first wallet
      const result1 = await runCLI([
        'wallet-create',
        '--name', walletName1,
        '--mnemonic', mnemonic
      ])

      // Create second wallet with same mnemonic
      const result2 = await runCLI([
        'wallet-create',
        '--name', walletName2,
        '--mnemonic', mnemonic
      ])

      expect(result1.code).to.equal(0)
      expect(result2.code).to.equal(0)

      // Extract addresses from output
      const addressMatch1 = result1.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)
      const addressMatch2 = result2.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)

      expect(addressMatch1).to.not.be.null
      expect(addressMatch2).to.not.be.null
      expect(addressMatch1[1]).to.equal(addressMatch2[1]) // Same mnemonic = same address
    })

    it('should work with short mnemonic flag', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '-m', TEST_MNEMONIC_12
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
    })
  })

  describe('Mnemonic Validation Error Handling', function () {
    it('should reject mnemonic with invalid word count', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', 'abandon abandon abandon' // Only 3 words
      ])

      expect(result.code).to.not.equal(0)
      expect(result.stdout || result.stderr).to.include('Invalid mnemonic length')
      expect(result.stdout || result.stderr).to.include('Expected 12, 15, 18, 21, or 24 words')
    })

    it('should reject mnemonic with invalid characters', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', 'abandon abandon 123invalid abandon abandon abandon abandon abandon abandon abandon abandon about'
      ])

      expect(result.code).to.not.equal(0)
      expect(result.stdout || result.stderr).to.include('Invalid word in mnemonic')
      expect(result.stdout || result.stderr).to.include('123invalid')
    })

    it('should reject empty mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', ''
      ])

      expect(result.code).to.not.equal(0)
      expect(result.stdout || result.stderr).to.include('Mnemonic must be a non-empty string')
    })
  })

  describe('Backward Compatibility', function () {
    it('should still create wallet without mnemonic (original behavior)', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
      expect(result.stdout).to.include('IMPORTANT: Save your mnemonic phrase securely:')
      expect(result.stdout).to.not.include('Wallet created from provided mnemonic.')
    })

    it('should work with description and mnemonic together', async function () {
      const walletName = generateTestWalletName()
      const description = 'Test wallet with custom mnemonic'

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--description', description,
        '--mnemonic', TEST_MNEMONIC_12
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
      expect(result.stdout).to.include(`Description: ${description}`)
      expect(result.stdout).to.include('Wallet created from provided mnemonic.')
    })
  })

  describe('Security Warnings', function () {
    it('should display security warning when using command line mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_12
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('SECURITY WARNING:')
      expect(result.stdout).to.include('Consider using a more secure method for production wallets.')
    })

    it('should not display mnemonic warning when generating random mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.not.include('WARNING: Using mnemonic via command line')
      expect(result.stdout).to.include('IMPORTANT: Save your mnemonic phrase securely:')
    })
  })

  describe('Additional Edge Cases', function () {
    it('should handle mnemonic with extra whitespace', async function () {
      const walletName = generateTestWalletName()
      const mnemonicWithSpaces = '  abandon   abandon  abandon abandon  abandon abandon abandon abandon abandon abandon  abandon   about  '

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', mnemonicWithSpaces
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
    })
  })

  describe('CashTab Compatibility Mode', function () {
    it('should create wallet with --cashtab flag', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_12,
        '--cashtab'
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Wallet created successfully!')
      expect(result.stdout).to.include('Using CashTab-compatible derivation path: m/44\'/1899\'/0\'/0/0')
      expect(result.stdout).to.include('This wallet is compatible with CashTab imports/exports.')
    })

    it('should generate different addresses for CashTab vs standard derivation', async function () {
      const mnemonic = TEST_MNEMONIC_12
      const standardWalletName = generateTestWalletName()
      const cashtabWalletName = generateTestWalletName()

      // Create standard wallet
      const standardResult = await runCLI([
        'wallet-create',
        '--name', standardWalletName,
        '--mnemonic', mnemonic
      ])

      // Create CashTab wallet
      const cashtabResult = await runCLI([
        'wallet-create',
        '--name', cashtabWalletName,
        '--mnemonic', mnemonic,
        '--cashtab'
      ])

      expect(standardResult.code).to.equal(0)
      expect(cashtabResult.code).to.equal(0)

      // Extract addresses from output
      const standardAddressMatch = standardResult.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)
      const cashtabAddressMatch = cashtabResult.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)

      expect(standardAddressMatch).to.not.be.null
      expect(cashtabAddressMatch).to.not.be.null
      expect(standardAddressMatch[1]).to.not.equal(cashtabAddressMatch[1]) // Different addresses
    })

    it('should show warning when using --cashtab without mnemonic', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--cashtab'
      ])

      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('WARNING: --cashtab flag is recommended only when importing existing CashTab mnemonics.')
      expect(result.stdout).to.include('For new wallets, the default eCash standard derivation path is recommended.')
      expect(result.stdout).to.include('Using CashTab-compatible derivation path: m/44\'/1899\'/0\'/0/0')
    })

    it('should create deterministic CashTab addresses from same mnemonic', async function () {
      const mnemonic = TEST_MNEMONIC_12
      const walletName1 = generateTestWalletName()
      const walletName2 = generateTestWalletName()

      // Create first CashTab wallet
      const result1 = await runCLI([
        'wallet-create',
        '--name', walletName1,
        '--mnemonic', mnemonic,
        '--cashtab'
      ])

      // Create second CashTab wallet with same mnemonic
      const result2 = await runCLI([
        'wallet-create',
        '--name', walletName2,
        '--mnemonic', mnemonic,
        '--cashtab'
      ])

      expect(result1.code).to.equal(0)
      expect(result2.code).to.equal(0)

      // Extract addresses from output
      const addressMatch1 = result1.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)
      const addressMatch2 = result2.stdout.match(/XEC Address: (ecash:[a-z0-9]+)/)

      expect(addressMatch1).to.not.be.null
      expect(addressMatch2).to.not.be.null
      expect(addressMatch1[1]).to.equal(addressMatch2[1]) // Same mnemonic with --cashtab = same address
    })

    it('should store compatibility metadata in wallet file', async function () {
      const walletName = generateTestWalletName()

      const result = await runCLI([
        'wallet-create',
        '--name', walletName,
        '--mnemonic', TEST_MNEMONIC_12,
        '--cashtab'
      ])

      expect(result.code).to.equal(0)

      // Read wallet file to verify metadata
      const fs = await import('fs/promises')
      const path = await import('path')
      const { fileURLToPath } = await import('url')

      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const walletPath = path.join(__dirname, '../../.wallets', `${walletName}.json`)

      const walletData = JSON.parse(await fs.readFile(walletPath, 'utf8'))

      expect(walletData.compatibility).to.exist
      expect(walletData.compatibility.derivationPath).to.equal('m/44\'/1899\'/0\'/0/0')
      expect(walletData.compatibility.standard).to.equal('CashTab')
      expect(walletData.compatibility.cashtabCompatible).to.be.true
      expect(walletData.wallet.hdPath).to.equal('m/44\'/1899\'/0\'/0/0')
    })
  })
})
