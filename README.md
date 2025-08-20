# eCash CLI Wallet

A command-line interface (CLI) wallet for eCash (XEC) cryptocurrency using the minimal-xec-wallet library.

## Features

- 🆕 Create new XEC wallets with mnemonic phrases
- 📋 List existing wallets
- 💰 Check XEC and eToken balances (SLP/ALP protocols)
- 📍 Display addresses with QR codes
- 📤 Send XEC transactions
- 🪙 Send eTokens (SLP and ALP tokens)
- 📊 View eToken information and transaction history
- ⚡ UTXO optimization for better transaction efficiency
- 🔐 Secure JSON wallet storage

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

## Command Reference

### wallet-create
Create a new XEC wallet.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-d, --description <string>` - Wallet description (optional)

**Example:**

```bash
node xec-wallet.js wallet-create -n trading-wallet -d "Wallet for trading activities"
```

### wallet-list
List all existing wallets.

**Example:**

```bash
node xec-wallet.js wallet-list
```

### wallet-balance
Check XEC and eToken balances for a wallet.

**Options:**

- `-n, --name <string>` - Wallet name (required)

**Example:**

```bash
node xec-wallet.js wallet-balance -n my-wallet
```

**Output includes:**

- XEC balance (confirmed/unconfirmed/total)
- SLP token balances
- ALP token balances
- UTXO breakdown for fee calculation debugging

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
Send XEC to an address.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-a, --addr <string>` - Recipient eCash address (required)
- `-q, --qty <string>` - Amount in XEC (required)

**Example:**

```bash
node xec-wallet.js send-xec -n my-wallet -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 50.5
```

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
Send eTokens (SLP or ALP) to an address.

**Options:**

- `-n, --name <string>` - Wallet name (required)
- `-t, --tokenId <string>` - 64-character hex token ID (required)
- `-a, --addr <string>` - Recipient eCash address (required)
- `-q, --qty <string>` - Amount of tokens to send (required)

**Example:**

```bash
node xec-wallet.js send-etokens -n my-wallet -t a436c8e1b6bee3139a4d16a43e81c00c6e44be3a4df39e8c228985e6e5158b94 -a ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl -q 100.5
```

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
  "description": "Wallet description",
  "created": "2025-08-18T10:30:00.000Z"
}
```

## Security Notes

- 🔐 Mnemonic phrases are stored in plaintext JSON files
- ⚠️ Keep your `.wallets/` directory secure
- 💡 Consider using file system encryption for production use
- 🚫 Never share your mnemonic phrase or private keys

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
- Added full eToken transaction support (send, history, info)
- Implemented UTXO optimization for better fee efficiency
- Enhanced balance display with token categorization
- Added comprehensive error handling for token operations

## License

MIT