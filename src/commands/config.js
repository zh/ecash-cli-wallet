/*
  Configuration management for eCash CLI wallet.
*/

// Local libraries
import ConfigManager from '../lib/config-manager.js'
import WalletUtil from '../lib/wallet-util.js'

class Config {
  constructor () {
    // Encapsulate dependencies
    this.configManager = new ConfigManager()
    this.walletUtil = new WalletUtil()

    // Bind 'this' object to all subfunctions
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.configGet = this.configGet.bind(this)
    this.configSet = this.configSet.bind(this)
    this.configList = this.configList.bind(this)
    this.configReset = this.configReset.bind(this)
    this.analyticsEnable = this.analyticsEnable.bind(this)
    this.analyticsDisable = this.analyticsDisable.bind(this)
    this.analyticsStatus = this.analyticsStatus.bind(this)
    this.avalancheEnable = this.avalancheEnable.bind(this)
    this.avalancheDisable = this.avalancheDisable.bind(this)
    this.avalancheStatus = this.avalancheStatus.bind(this)
    this.avalancheDefaultFinality = this.avalancheDefaultFinality.bind(this)
    this.displayConfigValue = this.displayConfigValue.bind(this)
    this.displayAllConfig = this.displayAllConfig.bind(this)
    this.displayConfigHelp = this.displayConfigHelp.bind(this)
  }

  async run (action, flags) {
    try {
      this.validateFlags(action, flags)

      // Route to appropriate subcommand
      switch (action) {
        case 'get':
          return await this.configGet(flags)
        case 'set':
          return await this.configSet(flags)
        case 'list':
          return await this.configList(flags)
        case 'reset':
          return await this.configReset(flags)
        case 'analytics-enable':
          return await this.analyticsEnable(flags)
        case 'analytics-disable':
          return await this.analyticsDisable(flags)
        case 'analytics-status':
          return await this.analyticsStatus(flags)
        case 'avalanche-enable':
          return await this.avalancheEnable(flags)
        case 'avalanche-disable':
          return await this.avalancheDisable(flags)
        case 'avalanche-status':
          return await this.avalancheStatus(flags)
        case 'avalanche-default-finality':
          return await this.avalancheDefaultFinality(flags)
        default:
          this.displayConfigHelp()
          return false
      }
    } catch (err) {
      console.error('Error managing configuration:', err.message)
      return 0
    }
  }

  validateFlags (action, flags = {}) {
    // Validate action
    const validActions = [
      'get', 'set', 'list', 'reset',
      'analytics-enable', 'analytics-disable', 'analytics-status',
      'avalanche-enable', 'avalanche-disable', 'avalanche-status', 'avalanche-default-finality'
    ]

    if (!action || !validActions.includes(action)) {
      throw new Error(`Invalid action. Valid actions: ${validActions.join(', ')}`)
    }

    // Validate required parameters for specific actions
    if (action === 'get' && (!flags.key || flags.key === '')) {
      throw new Error('You must specify a configuration key with the --key flag for get action.')
    }

    if (action === 'set') {
      if (!flags.key || flags.key === '') {
        throw new Error('You must specify a configuration key with the --key flag for set action.')
      }
      if (flags.value === undefined || flags.value === '') {
        throw new Error('You must specify a configuration value with the --value flag for set action.')
      }
    }

    return true
  }

  // Get configuration value
  async configGet (flags) {
    try {
      console.log(`Getting configuration for '${flags.key}'...\n`)

      const value = await this.configManager.getConfig(flags.key)

      if (value === undefined) {
        console.log(`Configuration key '${flags.key}' is not set.`)
        console.log('Use --help to see available configuration keys.')
        return false
      }

      this.displayConfigValue(flags.key, value)
      return true
    } catch (err) {
      console.error(`Failed to get configuration: ${err.message}`)
      return false
    }
  }

  // Set configuration value
  async configSet (flags) {
    try {
      console.log(`Setting configuration '${flags.key}' = '${flags.value}'...\n`)

      // Parse value to appropriate type
      const parsedValue = this.parseConfigValue(flags.value)

      await this.configManager.setConfig(flags.key, parsedValue)

      console.log('Configuration updated successfully.')
      console.log(`${flags.key} = ${JSON.stringify(parsedValue)}`)

      // Show restart notice for certain configurations
      if (this.requiresRestart(flags.key)) {
        console.log()
        console.log('NOTE: This change may require restarting wallet operations to take effect.')
      }

      return true
    } catch (err) {
      console.error(`Failed to set configuration: ${err.message}`)
      return false
    }
  }

  // List all configuration
  async configList (flags) {
    try {
      console.log('Current Configuration:\n')

      if (flags.defaults) {
        const defaultConfig = this.configManager.getDefaultConfig()
        this.displayAllConfig(defaultConfig, 'Default Configuration')
      } else {
        const currentConfig = await this.configManager.getConfig()
        this.displayAllConfig(currentConfig, 'Current Configuration')
      }

      console.log()
      console.log('Configuration file location:')
      console.log(`   ${this.configManager.getConfigPath()}`)

      return true
    } catch (err) {
      console.error(`Failed to list configuration: ${err.message}`)
      return false
    }
  }

  // Reset configuration to defaults
  async configReset (flags) {
    try {
      if (!flags.confirm) {
        console.log('This will reset all configuration to default values.')
        console.log('To confirm, run the command with --confirm flag:')
        console.log('   node xec-wallet.js config reset --confirm')
        return false
      }

      console.log('Resetting configuration to defaults...\n')

      await this.configManager.resetConfig()

      console.log('Configuration reset to defaults successfully.')

      // Show what was reset
      const defaultConfig = this.configManager.getDefaultConfig()
      console.log()
      console.log('New configuration:')
      this.displayAllConfig(defaultConfig, 'Reset Configuration')

      return true
    } catch (err) {
      console.error(`Failed to reset configuration: ${err.message}`)
      return false
    }
  }

  // Enable analytics globally or for specific wallet
  async analyticsEnable (flags) {
    try {
      if (flags.wallet) {
        console.log(`Enabling analytics for wallet '${flags.wallet}'...\n`)

        // Check if wallet exists
        if (!(await this.walletUtil.walletExists(flags.wallet))) {
          throw new Error(`Wallet '${flags.wallet}' not found`)
        }

        // Update wallet-specific analytics configuration
        await this.walletUtil.updateWalletAnalyticsConfig(flags.wallet, {
          enabled: true,
          enabledAt: new Date().toISOString()
        })

        console.log(`Analytics enabled for wallet '${flags.wallet}'.`)
      } else {
        console.log('Enabling analytics globally...\n')

        await this.configManager.setConfig('analytics.enabled', true)

        console.log('Analytics enabled globally for all wallets.')
        console.log('Individual wallets can still override this setting.')
      }

      console.log()
      console.log('Analytics features now available:')
      console.log('   - wallet-balance --detailed')
      console.log('   - wallet-health')
      console.log('   - wallet-classify')
      console.log('   - wallet-security')
      console.log('   - Smart coin selection in send operations')

      return true
    } catch (err) {
      console.error(`Failed to enable analytics: ${err.message}`)
      return false
    }
  }

  // Disable analytics globally or for specific wallet
  async analyticsDisable (flags) {
    try {
      if (flags.wallet) {
        console.log(`Disabling analytics for wallet '${flags.wallet}'...\n`)

        // Check if wallet exists
        if (!(await this.walletUtil.walletExists(flags.wallet))) {
          throw new Error(`Wallet '${flags.wallet}' not found`)
        }

        // Update wallet-specific analytics configuration
        await this.walletUtil.updateWalletAnalyticsConfig(flags.wallet, {
          enabled: false,
          disabledAt: new Date().toISOString()
        })

        console.log(`Analytics disabled for wallet '${flags.wallet}'.`)
      } else {
        console.log('Disabling analytics globally...\n')

        await this.configManager.setConfig('analytics.enabled', false)

        console.log('Analytics disabled globally for all wallets.')
        console.log('Individual wallets can still enable analytics if needed.')
      }

      console.log()
      console.log('Analytics features are no longer available.')
      console.log('Basic wallet operations will continue to work normally.')

      return true
    } catch (err) {
      console.error(`Failed to disable analytics: ${err.message}`)
      return false
    }
  }

  // Show analytics status
  async analyticsStatus (flags) {
    try {
      console.log('Analytics Status:\n')

      // Global analytics status
      const globalEnabled = await this.configManager.isAnalyticsEnabled()
      console.log(`Global Setting: ${globalEnabled ? 'ENABLED' : 'DISABLED'}`)

      // Environment variable overrides
      if (process.env.ECASH_CLI_ANALYTICS_ENABLED) {
        console.log(`Environment Override: ${process.env.ECASH_CLI_ANALYTICS_ENABLED}`)
      }

      console.log()

      // Wallet-specific status
      const wallets = await this.walletUtil.listWallets()
      if (wallets.length > 0) {
        console.log('Per-Wallet Settings:')
        console.log('-'.repeat(25))

        for (const wallet of wallets) {
          const walletEnabled = await this.walletUtil.isWalletAnalyticsEnabled(wallet.name)
          const status = walletEnabled ? 'ENABLED' : 'DISABLED'
          const override = wallet.analyticsEnabled !== null ? ' (wallet override)' : ''
          console.log(`   ${wallet.name.padEnd(20)}: ${status}${override}`)
        }
      } else {
        console.log('No wallets found.')
      }

      console.log()
      console.log('Available Analytics Commands:')
      console.log('-'.repeat(32))
      if (globalEnabled || wallets.some(w => w.analyticsEnabled)) {
        console.log('   wallet-balance --detailed    - Enhanced balance with analytics')
        console.log('   wallet-health                - Comprehensive health analysis')
        console.log('   wallet-classify              - UTXO classification analysis')
        console.log('   wallet-security              - Security threat assessment')
        console.log('   send-xec --strategy <type>   - Smart coin selection')
      } else {
        console.log('   (No analytics commands available - analytics is disabled)')
        console.log()
        console.log('Enable analytics with:')
        console.log('   node xec-wallet.js config analytics-enable')
      }

      return true
    } catch (err) {
      console.error(`Failed to show analytics status: ${err.message}`)
      return false
    }
  }

  // Enable Avalanche features
  async avalancheEnable (flags) {
    try {
      console.log('Enabling Avalanche features...\n')

      await this.configManager.setConfig('avalanche.enabled', true)

      console.log('Avalanche features enabled.')
      console.log()
      console.log('Avalanche Pre-Consensus provides instant transaction finality (~3 seconds).')
      console.log('Use the --finality flag with transaction commands to wait for confirmation.')
      console.log()
      console.log('Example:')
      console.log('   xec-wallet send-xec -n mywallet -a ecash:qp... -q 100 --finality')

      return true
    } catch (err) {
      console.error(`Failed to enable Avalanche: ${err.message}`)
      return false
    }
  }

  // Disable Avalanche features
  async avalancheDisable (flags) {
    try {
      console.log('Disabling Avalanche features...\n')

      await this.configManager.setConfig('avalanche.enabled', false)

      console.log('Avalanche features disabled.')
      console.log('Transactions will use standard block confirmation (~10 minutes).')

      return true
    } catch (err) {
      console.error(`Failed to disable Avalanche: ${err.message}`)
      return false
    }
  }

  // Show Avalanche status
  async avalancheStatus (flags) {
    try {
      console.log('Avalanche Configuration:\n')

      const avalancheConfig = await this.configManager.getConfig('avalanche')

      console.log(`  Enabled: ${avalancheConfig.enabled}`)
      console.log(`  Default Await Finality: ${avalancheConfig.defaultAwaitFinality}`)
      console.log(`  Finality Timeout: ${avalancheConfig.finalityTimeout}ms`)
      console.log(`  Show Finality Status: ${avalancheConfig.showFinalityStatus}`)

      console.log()
      if (avalancheConfig.enabled) {
        console.log('Avalanche Pre-Consensus is ENABLED.')
        console.log('Use --finality flag with transactions for instant confirmation (~3 sec).')
        if (avalancheConfig.defaultAwaitFinality) {
          console.log('Default Finality: ON (all transactions wait for confirmation)')
        }
      } else {
        console.log('Avalanche Pre-Consensus is DISABLED.')
        console.log('Enable with: xec-wallet config avalanche-enable')
      }

      return true
    } catch (err) {
      console.error(`Failed to show Avalanche status: ${err.message}`)
      return false
    }
  }

  // Set default finality behavior
  async avalancheDefaultFinality (flags) {
    try {
      // Get the value from the flags
      const valueArg = flags.value

      if (valueArg === undefined || valueArg === '') {
        console.log('Usage: xec-wallet config avalanche-default-finality --value <true|false>')
        console.log()
        console.log('When enabled, all transactions will automatically wait for Avalanche finality.')
        return false
      }

      const value = valueArg.toLowerCase() === 'true'

      console.log(`Setting Avalanche default finality to ${value}...\n`)

      await this.configManager.setConfig('avalanche.defaultAwaitFinality', value)

      console.log(`Avalanche default finality: ${value ? 'ON' : 'OFF'}`)

      if (value) {
        console.log('All transactions will now wait for Avalanche finality by default.')
        console.log('This provides instant confirmation (~3 seconds) for all sends.')
      } else {
        console.log('Transactions will not wait for finality by default.')
        console.log('Use --finality flag to enable per-transaction.')
      }

      return true
    } catch (err) {
      console.error(`Failed to set default finality: ${err.message}`)
      return false
    }
  }

  // Display a single configuration value
  displayConfigValue (key, value) {
    console.log(`Configuration: ${key}`)
    console.log(`Value: ${JSON.stringify(value, null, 2)}`)
    console.log(`Type: ${typeof value}`)
  }

  // Display all configuration values
  displayAllConfig (config, title = 'Configuration') {
    console.log(`${title}:`)
    console.log('='.repeat(title.length + 1))

    const flattened = this.configManager.flattenConfig(config)

    Object.entries(flattened).forEach(([key, value]) => {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value)
      console.log(`   ${key.padEnd(30)}: ${displayValue}`)
    })
  }

  // Parse configuration value from string to appropriate type
  parseConfigValue (value) {
    // Handle boolean values
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false

    // Handle null
    if (value.toLowerCase() === 'null') return null

    // Handle numbers
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value)
    }

    // Handle JSON objects/arrays
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value)
      } catch (err) {
        // If JSON parsing fails, treat as string
      }
    }

    // Default to string
    return value
  }

  // Check if configuration change requires restart
  requiresRestart (key) {
    const restartKeys = [
      'analytics.enabled',
      'analytics.debug',
      'performance.utxoCacheSize',
      'performance.analyticsCacheSize'
    ]

    return restartKeys.some(restartKey => key.startsWith(restartKey))
  }

  // Display configuration help
  displayConfigHelp () {
    console.log('Configuration Management Help')
    console.log('='.repeat(35))
    console.log()
    console.log('Usage:')
    console.log('   node xec-wallet.js config <action> [options]')
    console.log()
    console.log('Actions:')
    console.log('   get                        Get configuration value')
    console.log('   set                        Set configuration value')
    console.log('   list                       List all configuration')
    console.log('   reset                      Reset to default configuration')
    console.log('   analytics-enable           Enable analytics features')
    console.log('   analytics-disable          Disable analytics features')
    console.log('   analytics-status           Show analytics status')
    console.log('   avalanche-enable           Enable Avalanche finality features')
    console.log('   avalanche-disable          Disable Avalanche finality features')
    console.log('   avalanche-status           Show Avalanche configuration')
    console.log('   avalanche-default-finality Set default finality behavior')
    console.log()
    console.log('Options:')
    console.log('   --key <key>           Configuration key (for get/set)')
    console.log('   --value <value>       Configuration value (for set)')
    console.log('   --wallet <name>       Wallet name (for analytics commands)')
    console.log('   --defaults            Show default values (for list)')
    console.log('   --confirm             Confirm reset operation')
    console.log()
    console.log('Examples:')
    console.log('   node xec-wallet.js config get --key analytics.enabled')
    console.log('   node xec-wallet.js config set --key analytics.enabled --value true')
    console.log('   node xec-wallet.js config list')
    console.log('   node xec-wallet.js config analytics-enable')
    console.log('   node xec-wallet.js config analytics-enable --wallet my-wallet')
    console.log('   node xec-wallet.js config analytics-status')
    console.log('   node xec-wallet.js config avalanche-enable')
    console.log('   node xec-wallet.js config avalanche-status')
    console.log('   node xec-wallet.js config avalanche-default-finality --value true')
    console.log()
    console.log('Common Configuration Keys:')
    console.log('   analytics.enabled              Enable/disable analytics')
    console.log('   analytics.defaultStrategy      Default coin selection strategy')
    console.log('   avalanche.enabled              Enable/disable Avalanche features')
    console.log('   avalanche.defaultAwaitFinality Wait for finality by default')
    console.log('   avalanche.finalityTimeout      Finality timeout in milliseconds')
    console.log('   display.showHealthScores       Show health scores in balance')
    console.log('   display.showPrivacyScores      Show privacy scores in balance')
    console.log('   thresholds.minHealthScore      Minimum health score threshold')
    console.log('   thresholds.minPrivacyScore     Minimum privacy score threshold')
    console.log('   security.dustAttackThreshold   Dust attack detection threshold')
  }
}

export default Config
