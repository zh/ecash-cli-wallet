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
    address: 'ecash:qpqqptudwydz4a9e4hddacr4r7mgvhm9wvm5kdkttz'
  },
  funded: {
    name: 'test-funded',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    address: 'ecash:qz5vvd5fhqnzqq5v8n24pqd6xg5z5q5z5q5z5q5z5q'
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
