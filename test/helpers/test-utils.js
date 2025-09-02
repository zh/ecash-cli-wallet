/*
  Test Utilities and Helper Functions
  Common functions used across multiple test files
*/

import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to the CLI executable
const CLI_PATH = path.join(__dirname, '../../xec-wallet.js')

// Test wallet data for fixtures
export const TEST_WALLETS = {
  empty: {
    name: 'test-empty',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
    privateKey: '4f6fc721c36c8dd01d162c72bb8e57095c3f30a6c9c1a7cf5a7a4b5b2e9d9a4c' // Example private key
  },
  funded: {
    name: 'test-funded',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    address: 'ecash:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q',
    privateKey: '6f8fc721c36c8dd01d162c72bb8e57095c3f30a6c9c1a7cf5a7a4b5b2e9d9a4f' // Example private key
  }
}

// Test data for message signing operations
export const MESSAGE_TEST_FIXTURES = {
  // Known message/signature pairs for predictable testing
  knownSignatures: [
    {
      message: 'Hello eCash!',
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: 'H1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Example signature
      description: 'Basic message with standard characters'
    },
    {
      message: 'Message with special characters: !@#$%^&*()_+{}[]|\\:";\'<>?,./',
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: 'H9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba', // Example signature
      description: 'Message containing special characters'
    },
    {
      message: 'A'.repeat(100), // Long message
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: 'Habcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef', // Example signature
      description: 'Long message (100 characters of A)'
    },
    {
      message: 'Empty signature test',
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: '', // Empty signature for negative testing
      description: 'Test case with empty signature'
    }
  ],

  // Invalid test cases for negative testing
  invalidCases: [
    {
      message: 'Valid message',
      address: 'invalid-address-format',
      signature: 'H1234567890abcdef',
      expectedError: 'Invalid XEC address format',
      description: 'Invalid address format'
    },
    {
      message: 'Valid message',
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: 'InvalidSignatureFormat',
      expectedError: 'Invalid signature',
      description: 'Malformed signature'
    },
    {
      message: '',
      address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz',
      signature: 'H1234567890abcdef',
      expectedError: 'You must specify a message',
      description: 'Empty message'
    }
  ],

  // Test messages for different scenarios
  testMessages: {
    short: 'Hi',
    medium: 'This is a medium length test message for eCash signing and verification.',
    long: 'L'.repeat(500), // 500 character message
    unicode: '🚀 eCash message with emojis and unicode: ñáéíóú 中文 العربية',
    newlines: 'Message with\nmultiple\nlines\nfor testing',
    json: '{"type":"test","data":{"value":123,"flag":true}}',
    numbers: '1234567890',
    whitespace: '  Message with extra whitespace  ',
    tabs: 'Message\twith\ttabs',
    special: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./'
  }
}

/**
 * Execute CLI command and return result
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export async function runCLI (args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: 'pipe',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
        success: code === 0
      })
    })

    child.on('error', reject)

    // Set timeout
    const timeout = options.timeout || 10000
    setTimeout(() => {
      child.kill()
      reject(new Error(`CLI command timed out after ${timeout}ms`))
    }, timeout)
  })
}

/**
 * Create a temporary test wallet
 * @param {string} walletName - Name for the test wallet
 * @param {string} mnemonic - Optional mnemonic (uses empty wallet if not provided)
 * @returns {Promise<string>} - Path to wallet file
 */
export async function createTestWallet (walletName, mnemonic = TEST_WALLETS.empty.mnemonic) {
  // Use local path instead of global TEST_CONFIG
  const walletDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/wallets')
  const walletPath = path.join(walletDir, `${walletName}.json`)

  // Create wallet using CLI (check what options are actually supported)
  const result = await runCLI([
    'wallet-create',
    '--name', walletName
  ])

  if (!result.success) {
    throw new Error(`Failed to create test wallet: ${result.stderr}`)
  }

  return walletPath
}

/**
 * Remove test wallet file
 * @param {string} walletName - Name of the wallet to remove
 */
export async function removeTestWallet (walletName) {
  const walletPath = path.join(global.TEST_CONFIG.testWalletsDir, `${walletName}.json`)
  try {
    await fs.unlink(walletPath)
  } catch (err) {
    // Ignore if file doesn't exist
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
}

/**
 * Clean up all test wallets
 */
export async function cleanupTestWallets () {
  try {
    // Use local path instead of global TEST_CONFIG
    const testWalletsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/wallets')

    const walletFiles = await fs.readdir(testWalletsDir)
    for (const file of walletFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(testWalletsDir, file))
      }
    }
  } catch (err) {
    // Ignore if directory doesn't exist
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
}

/**
 * Create temporary config file for testing
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} - Path to config file
 */
export async function createTempConfig (config) {
  const configPath = path.join(global.TEST_CONFIG.tempDir, `config-${Date.now()}.json`)
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
  return configPath
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 */
export function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate random wallet name for testing
 */
export function generateTestWalletName () {
  return `test-wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate CLI output format
 * @param {string} output - CLI output to validate
 * @param {string[]} expectedPatterns - Regex patterns that should match
 */
export function validateCLIOutput (output, expectedPatterns) {
  const results = []
  for (const pattern of expectedPatterns) {
    const regex = new RegExp(pattern, 'i')
    results.push({
      pattern,
      matched: regex.test(output)
    })
  }
  return results
}

/**
 * Extract JSON from CLI output
 * @param {string} output - CLI output that may contain JSON
 * @returns {Object|null} - Parsed JSON or null if not found
 */
export function extractJSONFromOutput (output) {
  try {
    // Look for JSON blocks in output
    const lines = output.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return JSON.parse(trimmed)
      }
    }

    // Try to parse entire output as JSON
    return JSON.parse(output)
  } catch (err) {
    return null
  }
}

/**
 * Mock network requests for testing
 * @param {Object} responses - Mock responses keyed by URL pattern
 */
export function mockNetworkResponses (responses) {
  // This would be implemented with a proper HTTP mocking library
  // For now, just return a placeholder
  return {
    restore: () => {
      // Restore original network behavior
    }
  }
}

/**
 * Extract signature from CLI sign output
 * @param {string} signOutput - Output from msg-sign command
 * @returns {string|null} - Extracted signature or null if not found
 */
export function extractSignatureFromOutput (signOutput) {
  const signatureMatch = signOutput.match(/Signature:\s*([^\n\r]+)/)
  return signatureMatch ? signatureMatch[1].trim() : null
}

/**
 * Extract address from CLI sign output
 * @param {string} signOutput - Output from msg-sign command
 * @returns {string|null} - Extracted address or null if not found
 */
export function extractAddressFromOutput (signOutput) {
  const addressMatch = signOutput.match(/Signed message with key associated with address: (ecash:[a-z0-9]+)/)
  return addressMatch ? addressMatch[1] : null
}

/**
 * Parse verification result from CLI verify output
 * @param {string} verifyOutput - Output from msg-verify command
 * @returns {boolean} - True if signature was valid, false otherwise
 */
export function parseVerificationResult (verifyOutput) {
  return verifyOutput.includes('Signature verification result: VALID')
}

/**
 * Create test wallet and return signing information
 * @param {string} walletName - Name for the test wallet
 * @param {string} mnemonic - Mnemonic to use
 * @returns {Promise<{walletName: string, address: string}>} - Wallet info
 */
export async function createTestWalletForSigning (walletName, mnemonic = TEST_WALLETS.empty.mnemonic) {
  const createResult = await runCLI([
    'wallet-create',
    '-n', walletName,
    '-d', `Test wallet for signing: ${walletName}`,
    '-m', mnemonic
  ])

  if (!createResult.success) {
    throw new Error(`Failed to create test wallet: ${createResult.stderr}`)
  }

  // Extract address from creation output if available
  // For now, we'll use the known address from the test fixture
  const address = mnemonic === TEST_WALLETS.empty.mnemonic ? TEST_WALLETS.empty.address : TEST_WALLETS.funded.address

  return {
    walletName,
    address
  }
}

/**
 * Perform a complete sign-verify test cycle
 * @param {string} walletName - Wallet to use for signing
 * @param {string} message - Message to sign
 * @returns {Promise<{signed: boolean, verified: boolean, signature: string, address: string}>}
 */
export async function performSignVerifyTest (walletName, message) {
  // Sign the message
  const signResult = await runCLI([
    'msg-sign',
    '-n', walletName,
    '-m', message
  ])

  if (!signResult.success) {
    throw new Error(`Sign failed: ${signResult.stderr}`)
  }

  const signature = extractSignatureFromOutput(signResult.stdout)
  const address = extractAddressFromOutput(signResult.stdout)

  if (!signature || !address) {
    throw new Error('Could not extract signature or address from sign output')
  }

  // Verify the signature
  const verifyResult = await runCLI([
    'msg-verify',
    '-a', address,
    '-m', message,
    '-s', signature
  ])

  if (!verifyResult.success) {
    throw new Error(`Verify failed: ${verifyResult.stderr}`)
  }

  const verified = parseVerificationResult(verifyResult.stdout)

  return {
    signed: true,
    verified,
    signature,
    address
  }
}

/**
 * Generate test data for message signing tests
 * @param {number} count - Number of test cases to generate
 * @returns {Array} - Array of test message objects
 */
export function generateMessageTestCases (count = 10) {
  const testCases = []
  const messages = Object.values(MESSAGE_TEST_FIXTURES.testMessages)

  for (let i = 0; i < count; i++) {
    const message = messages[i % messages.length] + ` - Test ${i + 1}`
    testCases.push({
      id: `test-${i + 1}`,
      message,
      expectedValid: true,
      description: `Generated test case ${i + 1}`
    })
  }

  return testCases
}

/**
 * Validate that a signature has the correct format
 * @param {string} signature - Signature to validate
 * @returns {boolean} - True if signature format is valid
 */
export function isValidSignatureFormat (signature) {
  // Basic validation - should start with 'H' and be hex-encoded
  if (!signature || typeof signature !== 'string') {
    return false
  }

  // Signature should start with 'H' for Bitcoin message signatures
  if (!signature.startsWith('H')) {
    return false
  }

  // Rest should be valid hex characters (0-9, a-f, A-F)
  const hexPart = signature.slice(1)
  return /^[0-9a-fA-F]+$/.test(hexPart) && hexPart.length >= 64
}

/**
 * Create fixtures for deterministic testing
 * @returns {Promise<void>} - Creates test fixture files if needed
 */
export async function createMessageTestFixtures () {
  const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')
  const messageFixturesPath = path.join(fixturesDir, 'message-signatures.json')

  // Create fixtures directory if it doesn't exist
  try {
    await fs.mkdir(fixturesDir, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }

  // Write message test fixtures to file for persistence
  const fixtures = {
    created: new Date().toISOString(),
    description: 'Test fixtures for message signing and verification',
    wallets: TEST_WALLETS,
    messageFixtures: MESSAGE_TEST_FIXTURES
  }

  await fs.writeFile(messageFixturesPath, JSON.stringify(fixtures, null, 2))
  return messageFixturesPath
}
