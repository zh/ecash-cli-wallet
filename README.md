# eCash CLI Wallet

A command-line interface (CLI) wallet for eCash (XEC) cryptocurrency using the minimal-xec-wallet library with advanced UTXO analytics and coin selection features.

## Features

### Core Wallet Operations

- Create new XEC wallets with mnemonic phrases (12 or 24 words)
- Import existing wallets from mnemonic phrases
- CashTab compatibility mode for importing CashTab wallets
- List existing wallets
- Check XEC and eToken balances (SLP/ALP protocols)
- Display addresses with QR codes and HD derivation support
- Send XEC transactions with smart coin selection strategies
- Send eTokens (SLP and ALP tokens) with optimized UTXO selection
- View eToken information and transaction history
- UTXO optimization for better transaction efficiency
- Secure JSON wallet storage with analytics configuration

### Advanced Analytics Features

- **Smart Coin Selection**: Multiple strategies (efficient, privacy, security)
- **Comprehensive UTXO Classification**: Value-based and age-based analysis
- **Wallet Health Monitoring**: Real-time health scoring and analysis
- **Security Threat Detection**: Dust attacks, suspicious patterns, privacy leaks
- **Privacy Scoring**: Round number detection and privacy analysis
- **Dedicated Security Analysis**: Comprehensive threat assessment and recommendations
- **Configurable Analytics**: Global and per-wallet settings management
- **Detailed Classification Reporting**: Filterable views and export capabilities
- **Performance Optimization**: Smart UTXO management and consolidation strategies

## Installation

This CLI wallet requires the minimal-xec-wallet library. Make sure it's built and available in the parent directory.

```bash
# Install dependencies
npm install

# (optional) Make CLI executable
chmod +x xec-wallet.js
```

If you make CLI executable, no need to add `node` in front of every command.

## Usage

### Create a New Wallet

Generate a new XEC wallet with a mnemonic phrase:

```bash
node xec-wallet.js wallet-create -n my-wallet -d "Personal XEC wallet"
```

**⚠️ Important**: Save the mnemonic phrase securely! It's your only way to recover the wallet.

### List Existing Wallets

View all created wallets:

```bash
node xec-wallet.js wallet-list
```

### Check Wallet Balance

Get the XEC balance for a wallet:

```bash
node xec-wallet.js wallet-balance -n my-wallet
```

### View Addresses and QR Codes

Display wallet addresses with optional QR codes:

```bash
# Show addresses only
node xec-wallet.js wallet-addrs -n my-wallet

# Show addresses with QR codes
node xec-wallet.js wallet-addrs -n my-wallet -q

# Show additional HD address at index 1
node xec-wallet.js wallet-addrs -n my-wallet --index 1 -q
```

### Send XEC

Send XEC to another address:

```bash
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100
```

## Analytics Configuration

The CLI wallet includes advanced UTXO analytics features that can be enabled/disabled globally or per-wallet.

### Enable Analytics

Enable analytics globally for all wallets:

```bash
node xec-wallet.js config analytics-enable
```

Enable analytics for a specific wallet only:

```bash
node xec-wallet.js config analytics-enable --wallet my-wallet
```

### Check Analytics Status

View current analytics configuration:

```bash
node xec-wallet.js config analytics-status
```

### Disable Analytics

Disable analytics globally:
```bash
node xec-wallet.js config analytics-disable
```

Disable analytics for a specific wallet:
```bash
node xec-wallet.js config analytics-disable --wallet my-wallet
```

### Environment Variables

Analytics can also be controlled via environment variables:

```bash
# Enable analytics via environment
export ECASH_CLI_ANALYTICS_ENABLED=true
node xec-wallet.js wallet-balance -n my-wallet --detailed

# Disable analytics via environment
export ECASH_CLI_ANALYTICS_ENABLED=false
```

## Command Reference

### wallet-create

Create a new XEC wallet.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-d, --description <string>` - Wallet description (optional)
- `-m, --mnemonic <string>` - Use existing mnemonic phrase (12 or 24 words)
- `--cashtab` - Use CashTab-compatible derivation path for importing CashTab mnemonics

**Examples:**

```bash
# Create new wallet with generated mnemonic
node xec-wallet.js wallet-create -n trading-wallet -d "Wallet for trading activities"

# Create wallet from existing mnemonic
node xec-wallet.js wallet-create -n restored-wallet -m "word1 word2 ... word12"

# Create CashTab-compatible wallet (for importing CashTab mnemonics)
node xec-wallet.js wallet-create -n cashtab-wallet --cashtab -m "existing cashtab mnemonic..."
```

**Important Notes:**

- **Derivation Paths**: Standard wallets use `m/44'/899'/0'/0/0`, CashTab uses `m/44'/1899'/0'/0/0`
- **Security Warning**: Using mnemonic via command line exposes it in process history
- **CashTab Compatibility**: Only use `--cashtab` when importing existing CashTab mnemonics

### wallet-list
List all existing wallets.

**Example:**

```bash
node xec-wallet.js wallet-list
```

### wallet-balance
Check XEC and eToken balances for a wallet with optional analytics.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `--detailed` - Show detailed analytics information (when analytics enabled)
- `--analytics` - Show analytics data (when analytics enabled)
- `--export-analytics` - Export analytics data to JSON file (when analytics enabled)

**Examples:**

```bash
# Basic balance
node xec-wallet.js wallet-balance -n my-wallet

# Enhanced balance with analytics (requires analytics enabled)
node xec-wallet.js wallet-balance -n my-wallet --detailed

# Full analytics display
node xec-wallet.js wallet-balance -n my-wallet --analytics

# Export analytics data
node xec-wallet.js wallet-balance -n my-wallet --export-analytics
```

**Basic Output includes:**

- XEC balance (confirmed/unconfirmed/total)
- SLP token balances
- ALP token balances
- UTXO breakdown for fee calculation debugging

**Analytics Output includes (when enabled):**

- Wallet health score and status
- UTXO classifications (age and value based)
- Security threat analysis
- Privacy scoring
- Dust attack detection
- Actionable recommendations

### wallet-addrs
Display wallet addresses and QR codes.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-q, --qr` - Show QR codes (optional)
- `--xec` - Show only XEC address (default)
- `--wif` - Show WIF private key for sweeping
- `--index <number>` - Show additional HD address at index (optional)

**Examples:**

```bash
# Basic addresses
node xec-wallet.js wallet-addrs -n my-wallet

# With QR codes
node xec-wallet.js wallet-addrs -n my-wallet -q

# Show WIF private key
node xec-wallet.js wallet-addrs -n my-wallet --wif

# Additional HD address
node xec-wallet.js wallet-addrs -n my-wallet --index 5 -q
```

### send-xec

Send XEC to an address with optional smart coin selection.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-a, --addr <string>` - Recipient eCash address (required)
- `-q, --qty <string>` - Amount in XEC (required)
- `--strategy <strategy>` - UTXO selection strategy: efficient|privacy|security (requires analytics)

**Examples:**

```bash
# Basic XEC transaction
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 50.5

# Use efficient strategy (minimize fees)
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100 --strategy efficient

# Use privacy strategy (maximize privacy)
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100 --strategy privacy

# Use security strategy (avoid problematic UTXOs)
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100 --strategy security
```

**Strategy Details:**

- **efficient**: Minimizes transaction size and fees by selecting optimal UTXOs
- **privacy**: Maximizes transaction privacy by avoiding round numbers and suspicious UTXOs  
- **security**: Avoids potentially problematic UTXOs flagged by security analysis

**Requirements:**

- Strategy selection requires analytics to be enabled for the wallet
- Analytics can be enabled with: `node xec-wallet.js config analytics-enable`

### etoken-info
Get detailed information about an eToken including metadata and wallet balance.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-t, --tokenId <string>` - 64-character hex token ID (required)

**Example:**

```bash
node xec-wallet.js etoken-info -n my-wallet -t a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94
```

### etoken-tx-history
View transaction history for a specific eToken.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-t, --tokenId <string>` - 64-character hex token ID (required)

**Example:**

```bash
node xec-wallet.js etoken-tx-history -n my-wallet -t a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94
```

### send-etokens

Send eTokens (SLP or ALP) to an address with optional smart coin selection.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-t, --tokenId <string>` - 64-character hex token ID (required)
- `-a, --addr <string>` - Recipient eCash address (required)
- `-q, --qty <string>` - Amount of tokens to send (required)
- `--strategy <strategy>` - UTXO selection strategy: efficient|privacy|security (requires analytics)

**Examples:**

```bash
# Basic eToken transaction
node xec-wallet.js send-etokens -n my-wallet -t a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94 -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100.5

# Use efficient strategy for optimal fee management
node xec-wallet.js send-etokens -n my-wallet -t a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94 -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 50 --strategy efficient
```

**Smart Coin Selection:**

eToken transactions benefit significantly from smart coin selection as they require both token UTXOs and pure XEC UTXOs for fees. The strategy system helps optimize UTXO selection for better transaction success rates.

### wallet-optimize
Optimize wallet by consolidating UTXOs to improve transaction efficiency.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `--dry-run` - Show optimization plan without executing (optional)

**Examples:**

```bash
# See optimization plan
node xec-wallet.js wallet-optimize -n my-wallet --dry-run

# Execute optimization
node xec-wallet.js wallet-optimize -n my-wallet
```

### wallet-health

Comprehensive wallet health analysis and monitoring.

**Options:**

- `-n, --name <string>` - Wallet name to analyze (required)
- `--detailed` - Show detailed health analysis
- `--dust-analysis` - Show dust attack analysis
- `--security` - Show security threat analysis
- `--export` - Export health report to JSON file

**Examples:**

```bash
# Basic health overview
node xec-wallet.js wallet-health -n my-wallet

# Detailed health analysis
node xec-wallet.js wallet-health -n my-wallet --detailed

# Focus on dust attack analysis
node xec-wallet.js wallet-health -n my-wallet --dust-analysis

# Focus on security threats
node xec-wallet.js wallet-health -n my-wallet --security

# Export health report
node xec-wallet.js wallet-health -n my-wallet --export
```

**Health Analysis Includes:**

- Overall wallet health score and status
- UTXO distribution analysis
- Security threat detection (dust attacks, suspicious patterns)
- Privacy scoring and analysis
- Actionable recommendations for optimization

### wallet-classify

Detailed UTXO classification analysis and filtering.

**Options:**

- `-n, --name <string>` - Wallet name to analyze (required)
- `--detailed` - Show detailed classification analysis
- `--filter <terms>` - Filter by classification terms (comma-separated)
- `--utxos` - Show individual UTXO details
- `--export` - Export classification data to JSON file

**Examples:**

```bash
# Full classification analysis
node xec-wallet.js wallet-classify -n my-wallet

# Detailed classification breakdown
node xec-wallet.js wallet-classify -n my-wallet --detailed

# Filter by classification terms
node xec-wallet.js wallet-classify -n my-wallet --filter "dust,suspicious"

# Show individual UTXO details
node xec-wallet.js wallet-classify -n my-wallet --utxos

# Export classification data
node xec-wallet.js wallet-classify -n my-wallet --export
```

**Classification Categories:**

- **Value-based**: dust, micro, small, medium, large, whale
- **Age-based**: fresh, recent, mature, aged, ancient, unconfirmed
- **Health-based**: healthy, at-risk, suspicious, stuck, dust

### wallet-security

Comprehensive security analysis and threat detection.

**Options:**

- `-n, --name <string>` - Wallet name to analyze (required)
- `--detailed` - Show detailed security analysis
- `--threats` - Show detailed threat analysis
- `--filter <terms>` - Filter by threat type or severity (comma-separated)
- `--export` - Export security report to JSON file

**Examples:**

```bash
# Basic security overview
node xec-wallet.js wallet-security -n my-wallet

# Detailed security analysis
node xec-wallet.js wallet-security -n my-wallet --detailed

# Focus on threat details
node xec-wallet.js wallet-security -n my-wallet --threats

# Filter by threat severity
node xec-wallet.js wallet-security -n my-wallet --filter "high,critical"

# Export security report
node xec-wallet.js wallet-security -n my-wallet --export
```

**Security Analysis Includes:**

- **Dust Attack Detection**: Identifies potential dust attack attempts
- **Privacy Leak Analysis**: Detects address reuse and privacy vulnerabilities
- **Suspicious Pattern Detection**: Flags unusual transaction patterns
- **Threat Severity Assessment**: Prioritizes security issues by risk level
- **Security Recommendations**: Actionable steps to improve wallet security

### config

Configuration management for eCash CLI wallet.

**Syntax:**

```
node xec-wallet.js config <action> [options]
```

**Actions:**

- `get` - Get configuration value
- `set` - Set configuration value  
- `list` - List all configuration
- `reset` - Reset to default configuration
- `analytics-enable` - Enable analytics features
- `analytics-disable` - Disable analytics features
- `analytics-status` - Show analytics status

**Options:**

- `--key <key>` - Configuration key (for get/set actions)
- `--value <value>` - Configuration value (for set action)
- `--wallet <name>` - Wallet name (for analytics actions)
- `--defaults` - Show default values (for list action)
- `--confirm` - Confirm reset operation (for reset action)

**Examples:**

```bash
# View analytics status
node xec-wallet.js config analytics-status

# Enable analytics globally
node xec-wallet.js config analytics-enable

# Enable analytics for specific wallet
node xec-wallet.js config analytics-enable --wallet my-wallet

# Get specific configuration
node xec-wallet.js config get --key analytics.enabled

# Set configuration value
node xec-wallet.js config set --key analytics.defaultStrategy --value efficient

# List all configuration
node xec-wallet.js config list

# List with defaults
node xec-wallet.js config list --defaults

# Reset to defaults (requires --confirm)
node xec-wallet.js config reset --confirm
```

## Wallet Storage

Wallets are stored as JSON files in the `.wallets/` directory. Each wallet contains:

```json
{
  "wallet": {
    "mnemonic": "twelve word mnemonic phrase...",
    "privateKey": "hex_private_key",
    "publicKey": "hex_public_key", 
    "xecAddress": "ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl",
    "hdPath": "m/44'/899'/0'/0/0"
  },
  "derived": {
    "m/44'/899'/0'/0/0": "ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl",
    "m/44'/899'/0'/0/1": "ecash:qr2zqxyzabcdef123456789abcdef123456789abc",
    "m/44'/899'/0'/0/2": "ecash:qs3axyzabcdef123456789abcdef123456789def",
    "...": "... (up to index 9)"
  },
  "description": "Wallet description",
  "created": "2025-08-18T10:30:00.000Z",
  "compatibility": {
    "derivationPath": "m/44'/899'/0'/0/0",
    "standard": "eCash BIP44",
    "cashtabCompatible": false
  },
  "analytics": {
    "enabled": null,
    "classificationConfig": {},
    "lastConfigUpdate": "2025-08-22T10:30:00.000Z"
  },
  "schemaVersion": "2.0.0",
  "lastUpdated": "2025-08-22T10:30:00.000Z"
}
```

**Wallet Structure Details:**

- **`wallet`**: Core wallet information including mnemonic, keys, and primary address
- **`derived`**: HD addresses for indices 0-9, providing pre-computed addresses for recovery and rotation
- **`description`**: User-provided wallet description
- **`compatibility`**: Derivation path compatibility information
  - `derivationPath`: The HD path used for the main address
  - `standard`: "eCash BIP44" (standard) or "CashTab" (CashTab-compatible)  
  - `cashtabCompatible`: Boolean indicating CashTab compatibility mode
- **`analytics`**: Analytics configuration (enabled/disabled, classification settings)
- **`schemaVersion`**: Wallet file format version
- **`lastUpdated`**: Timestamp of last wallet modification

**Derivation Path Standards:**

- **Standard eCash**: Uses coin type `899` (e.g., `m/44'/899'/0'/0/0`)
- **CashTab Compatible**: Uses coin type `1899` (e.g., `m/44'/1899'/0'/0/0`)

## Security Notes

- Mnemonic phrases are stored in plaintext JSON files
- Keep your `.wallets/` directory secure
- Consider using file system encryption for production use
- Never share your mnemonic phrase or private keys

## Analytics and Security Features

### UTXO Classification

The wallet analyzes your UTXOs using multiple classification systems:

**Value-based Classification:**
- **Dust**: < 0.01 XEC (potentially from attacks)
- **Micro**: 0.01 - 1 XEC
- **Small**: 1 - 100 XEC
- **Medium**: 100 - 10,000 XEC
- **Large**: 10,000 - 1,000,000 XEC
- **Whale**: > 1,000,000 XEC

**Age-based Classification:**
- **Fresh**: < 1 block confirmation
- **Recent**: 1-6 block confirmations
- **Mature**: 7-144 blocks (1 day)
- **Aged**: 144-4320 blocks (1 month)
- **Ancient**: > 4320 blocks (> 1 month)
- **Unconfirmed**: 0 confirmations

### Security Threat Detection

- **Dust Attack Detection**: Identifies potential dust attacks
- **Suspicious UTXO Patterns**: Detects unusual transaction patterns
- **Privacy Analysis**: Evaluates transaction privacy levels
- **Round Number Detection**: Identifies potentially suspicious round amounts

### Wallet Health Scoring

Health scores are calculated based on multiple factors:
- UTXO distribution and size
- Confirmation status
- Security threats present
- Privacy considerations
- Age diversity of UTXOs

**Health Status Levels:**
- **Healthy**: No issues detected, good UTXO distribution
- **At Risk**: Minor issues that should be monitored
- **Suspicious**: Potential security threats detected
- **Stuck**: UTXOs that may be difficult to spend

### Coin Selection Strategies

Advanced coin selection for optimized transactions available with `--strategy` parameter:

**Strategy Types:**

- **efficient**: Minimizes transaction size and fees by selecting optimal UTXOs for cost-effectiveness
- **privacy**: Maximizes transaction privacy by avoiding round numbers, suspicious UTXOs, and patterns that could compromise anonymity  
- **security**: Avoids potentially problematic UTXOs flagged by security analysis, including dust attacks and suspicious patterns

**Usage Examples:**

```bash
# Use efficient strategy for cost optimization
node xec-wallet.js send-xec -n wallet --strategy efficient -a address -q 100

# Use privacy strategy for maximum anonymity
node xec-wallet.js send-xec -n wallet --strategy privacy -a address -q 100

# Use security strategy to avoid threats
node xec-wallet.js send-xec -n wallet --strategy security -a address -q 100
```

**Requirements:**

- Analytics must be enabled for the wallet to use strategies
- Strategies apply to both XEC and eToken transactions
- Fallback to standard selection if analytics are unavailable

## eToken Support

### Supported Protocols

- **SLP (Simple Ledger Protocol)** - Original eCash token standard
- **ALP (Arbitrarily Lockable Protocol)** - Advanced token protocol with enhanced features

### Token Operations

- View token information and metadata
- Check token balances for your wallet
- Send tokens to other addresses
- View complete transaction history for specific tokens
- Automatic protocol detection (SLP/ALP)

### Token ID Format
eTokens are identified by 64-character hexadecimal token IDs:
```
a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94
```

### Fee Requirements
eToken transactions require XEC for fees:

- Keep at least 1-2 XEC in your wallet for transaction fees
- UTXOs with tokens lock XEC that can't be used for fees
- Use `wallet-optimize` to consolidate UTXOs for better fee efficiency

## Address Formats

- **XEC Address**: `ecash:` prefix - for receiving XEC coins
- **eToken Address**: Same as XEC address - tokens use the same address format

## Block Explorers

View transactions on these eCash block explorers:

- https://explorer.e.cash/
- https://3xpl.com/ecash/

## Troubleshooting

### eToken Transaction Failures

**"Insufficient XEC for transaction fees"**

- eToken transactions need pure XEC UTXOs for fees
- Solution: Send 1-2 XEC to your wallet from an external source
- Alternative: Use `wallet-optimize` to consolidate UTXOs

**"ALP transaction failed due to dust outputs"**

- ALP tokens require larger XEC UTXOs to avoid dust issues
- Solution: Send more XEC to wallet, then try `wallet-optimize`

**"Token not found or not supported"**

- Check token ID format (must be 64-character hex)
- Verify token exists by checking on block explorer
- Ensure wallet has synced recent transactions

### UTXO Management

**When to optimize UTXOs:**

- Before sending large eToken amounts
- When getting frequent "insufficient XEC" errors
- When wallet has many small UTXOs (dust)

**Safe optimization:**

- Only pure XEC UTXOs are consolidated
- Token UTXOs remain untouched and safe
- Use `--dry-run` first to see the plan

### General Issues

**Wallet not found:**
- Check wallet name spelling
- Use `wallet-list` to see available wallets

**Network errors:**
- Check internet connection
- eCash network may be temporarily unavailable

## Dependencies

- **minimal-xec-wallet**: Core XEC wallet functionality (requires v1.0.5+ for eToken support)
- **commander**: CLI argument parsing
- **qrcode-terminal**: QR code generation in terminal
- **qrcode**: QR code generation library

## Development

The CLI follows the same patterns as psf-slp-wallet but enhanced for XEC and eToken operations:

- No server configuration (chronik handles infrastructure automatically)
- Comprehensive eToken support (SLP and ALP protocols)
- Simple JSON file storage
- Direct minimal-xec-wallet integration
- Hybrid token management for cross-protocol compatibility

### Recent Updates
- **v2.0.0**: Added comprehensive UTXO analytics and health monitoring system
  - Advanced UTXO classification (value-based and age-based)
  - Security threat detection and dust attack analysis
  - Wallet health scoring and monitoring
  - Configurable analytics settings (global and per-wallet)
  - New analytics commands: `wallet-health`, `wallet-classify`, `config`
  - Enhanced balance display with analytics integration
- **v1.x.x**: Full eToken transaction support (send, history, info)
  - Implemented UTXO optimization for better fee efficiency
  - Enhanced balance display with token categorization
  - Added comprehensive error handling for token operations

## License

MIT