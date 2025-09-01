#!/usr/bin/env node

/*
  This is the primary entry point for the XEC CLI wallet app.
  This app uses commander.js and minimal-xec-wallet.
*/

// Global npm libraries
import { Command } from 'commander'

// Local libraries
import WalletCreate from './src/commands/wallet-create.js'
import WalletList from './src/commands/wallet-list.js'
import WalletAddrs from './src/commands/wallet-addrs.js'
import WalletBalance from './src/commands/wallet-balance.js'
import SendXec from './src/commands/send-xec.js'
import WalletSweep from './src/commands/wallet-sweep.js'
import ETokenInfo from './src/commands/etoken-info.js'
import ETokenTxHistory from './src/commands/etoken-tx-history.js'
import SendETokens from './src/commands/send-etokens.js'
import WalletOptimize from './src/commands/wallet-optimize.js'
import WalletHealth from './src/commands/wallet-health.js'
import WalletClassify from './src/commands/wallet-classify.js'
import WalletSecurity from './src/commands/wallet-security.js'
import Config from './src/commands/config.js'

// Instantiate the subcommands
const walletCreate = new WalletCreate()
const walletList = new WalletList()
const walletAddrs = new WalletAddrs()
const walletBalance = new WalletBalance()
const sendXec = new SendXec()
const walletSweep = new WalletSweep()
const etokenInfo = new ETokenInfo()
const etokenTxHistory = new ETokenTxHistory()
const sendETokens = new SendETokens()
const walletOptimize = new WalletOptimize()
const walletHealth = new WalletHealth()
const walletClassify = new WalletClassify()
const walletSecurity = new WalletSecurity()
const config = new Config()
const program = new Command()

program
  .name('xec-wallet')
  .description('A command-line eCash (XEC) wallet using minimal-xec-wallet.')
  .version('1.0.1')

// Define the wallet-create command
program
  .command('wallet-create')
  .description('Create a new XEC wallet with name')
  .option('-n, --name <string>', 'wallet name')
  .option('-d, --description <string>', 'wallet description')
  .option('-m, --mnemonic <string>', 'use existing mnemonic phrase (12 or 24 words)')
  .option('--cashtab', 'use CashTab-compatible derivation path (m/44\'/1899\'/0\'/0/0) for importing CashTab mnemonics')
  .action(walletCreate.run)

// Define the wallet-list command
program
  .command('wallet-list')
  .description('List existing XEC wallets')
  .action(walletList.run)

// Define the wallet-addrs command
program
  .command('wallet-addrs')
  .description('Display addresses and QR codes for a wallet')
  .option('-n, --name <string>', 'wallet name')
  .option('-q, --qr', 'show QR code for selected address type')
  .option('--xec', 'show only XEC address (default)')
  .option('--wif', 'show WIF private key for sweeping')
  .option('--index <number>', 'show additional HD address at index')
  .action(walletAddrs.run)

// Define the wallet-balance command
program
  .command('wallet-balance')
  .description('Get XEC balance for the wallet with optional analytics')
  .option('-n, --name <string>', 'wallet name')
  .option('--detailed', 'show detailed analytics information')
  .option('--analytics', 'show analytics data')
  .option('--export-analytics', 'export analytics data to JSON file')
  .action(walletBalance.run)

// Define the wallet-sweep command
program
  .command('wallet-sweep')
  .description('Sweep XEC from a WIF private key to a wallet')
  .option('-w, --wif <string>', 'WIF private key to sweep from')
  .option('-n, --name <string>', 'destination wallet name to sweep funds to')
  .option('-b, --balance-only', 'only check balance, do not sweep')
  .option('-q, --qty <string>', 'specific amount to send (optional, default: sweep all)')
  .action(walletSweep.run)

// Define the send-xec command
program
  .command('send-xec')
  .description('Send XEC to an address with optional smart coin selection')
  .option('-n, --name <string>', 'wallet name sending XEC')
  .option('-a, --addr <string>', 'address to send XEC to')
  .option('-q, --qty <string>', 'the quantity of XEC to send')
  .option('--strategy <strategy>', 'UTXO selection strategy: efficient|privacy|security (requires analytics)')
  .action(sendXec.run)

// Define the send-etokens command
program
  .command('send-etokens')
  .description('Send eTokens to an address with optional smart coin selection')
  .option('-n, --name <string>', 'wallet name sending eTokens')
  .option('-t, --tokenId <string>', 'Token ID to send')
  .option('-a, --addr <string>', 'destination address to send eTokens to')
  .option('-q, --qty <string>', 'quantity of eTokens to send')
  .option('--strategy <strategy>', 'UTXO selection strategy: efficient|privacy|security (requires analytics)')
  .action(sendETokens.run)

// Define the etoken-info command
program
  .command('etoken-info')
  .description('Get detailed information about an eToken')
  .option('-n, --name <string>', 'wallet name')
  .option('-t, --tokenId <string>', 'Token ID to lookup')
  .action(etokenInfo.run)

// Define the etoken-tx-history command
program
  .command('etoken-tx-history')
  .description('Get transaction history for an eToken')
  .option('-t, --tokenId <string>', 'Token ID to lookup')
  .option('-n, --name <string>', 'wallet name')
  .action(etokenTxHistory.run)

// Define the wallet-optimize command
program
  .command('wallet-optimize')
  .description('Optimize wallet by consolidating UTXOs')
  .option('-n, --name <string>', 'wallet name to optimize')
  .option('--dry-run', 'show optimization plan without executing transactions')
  .action(walletOptimize.run)

// Define the wallet-health command
program
  .command('wallet-health')
  .description('Comprehensive wallet health analysis and monitoring')
  .option('-n, --name <string>', 'wallet name to analyze')
  .option('--detailed', 'show detailed health analysis')
  .option('--dust-analysis', 'show dust attack analysis')
  .option('--security', 'show security threat analysis')
  .option('--export', 'export health report to JSON file')
  .action(walletHealth.run)

// Define the wallet-classify command
program
  .command('wallet-classify')
  .description('Detailed UTXO classification analysis and filtering')
  .option('-n, --name <string>', 'wallet name to analyze')
  .option('--detailed', 'show detailed classification analysis')
  .option('--filter <terms>', 'filter by classification terms (comma-separated)')
  .option('--utxos', 'show individual UTXO details')
  .option('--export', 'export classification data to JSON file')
  .action(walletClassify.run)

// Define the wallet-security command
program
  .command('wallet-security')
  .description('Comprehensive security analysis and threat detection')
  .option('-n, --name <string>', 'wallet name to analyze')
  .option('--detailed', 'show detailed security analysis')
  .option('--threats', 'show detailed threat analysis')
  .option('--filter <terms>', 'filter by threat type or severity (comma-separated)')
  .option('--export', 'export security report to JSON file')
  .action(walletSecurity.run)

// Define the config command
program
  .command('config')
  .description('Configuration management for eCash CLI wallet')
  .argument('<action>', 'config action: get|set|list|reset|analytics-enable|analytics-disable|analytics-status')
  .option('--key <key>', 'configuration key (for get/set actions)')
  .option('--value <value>', 'configuration value (for set action)')
  .option('--wallet <name>', 'wallet name (for analytics actions)')
  .option('--defaults', 'show default values (for list action)')
  .option('--confirm', 'confirm reset operation (for reset action)')
  .action((action, options) => config.run(action, options))

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err.message)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message)
  process.exit(1)
})

program.parseAsync(process.argv)
