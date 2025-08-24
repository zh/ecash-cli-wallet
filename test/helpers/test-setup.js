/*
  Test Setup and Global Configuration
  Sets up test environment, mocks, and common utilities
*/

import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Global test configuration
global.TEST_CONFIG = {
  timeout: 10000,
  tempDir: path.join(__dirname, '../fixtures/temp'),
  fixturesDir: path.join(__dirname, '../fixtures'),
  testWalletsDir: path.join(__dirname, '../fixtures/wallets')
}

// Ensure test directories exist
async function setupTestDirectories () {
  const dirs = [
    global.TEST_CONFIG.tempDir,
    global.TEST_CONFIG.testWalletsDir
  ]

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch (err) {
      // Directory might already exist
      if (err.code !== 'EEXIST') {
        console.warn(`Warning: Could not create test directory ${dir}:`, err.message)
      }
    }
  }
}

// Environment setup
process.env.NODE_ENV = 'test'
process.env.ECASH_CLI_ANALYTICS_ENABLED = 'false' // Disable analytics by default in tests

// Setup before running tests
before(async function () {
  this.timeout(30000) // Allow time for setup
  await setupTestDirectories()
})

// Cleanup after all tests
after(async function () {
  // Clean up test temp directory
  try {
    await fs.rm(global.TEST_CONFIG.tempDir, { recursive: true, force: true })
  } catch (err) {
    // Ignore cleanup errors
  }
})
