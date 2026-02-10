/*
  Test Utilities and Helper Functions
  Common functions used across multiple test files
*/

import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

// ES module compatibility
const __dirname = dirname(fileURLToPath(import.meta.url))

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
 * Generate random wallet name for testing
 */
export function generateTestWalletName () {
  return `test-wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
