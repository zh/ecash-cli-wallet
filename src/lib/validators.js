/*
  Shared validation functions for CLI wallet commands.
  Extracted from send-xec.js and send-etokens.js to eliminate duplication.
*/

/**
 * Validate an eCash address.
 * @param {string} address - The address to validate
 * @throws {Error} If address is invalid
 */
export function validateAddress (address) {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid address: Address must be a non-empty string')
  }

  if (!address.startsWith('ecash:')) {
    throw new Error('Invalid address: Address must be an eCash address (ecash: prefix)')
  }

  if (address.length < 40 || address.length > 60) {
    throw new Error('Invalid address: Invalid eCash address length')
  }

  const addressPart = address.substring(6)
  if (!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(addressPart)) {
    throw new Error('Invalid address: Invalid eCash address format')
  }

  return true
}

/**
 * Validate an XEC amount.
 * @param {string|number} amount - The amount to validate
 * @throws {Error} If amount is invalid
 */
export function validateAmount (amount) {
  const numAmount = parseFloat(amount)

  if (isNaN(numAmount)) {
    throw new Error('Invalid amount: Amount must be a valid number')
  }

  if (numAmount <= 0) {
    throw new Error('Invalid amount: Amount must be greater than 0')
  }

  if (numAmount < 5.46) {
    throw new Error('Invalid amount: Amount must be at least 5.46 XEC (546 satoshis - dust limit)')
  }

  return true
}

/**
 * Validate a UTXO selection strategy.
 * @param {string} strategy - The strategy to validate
 * @throws {Error} If strategy is invalid
 */
export function validateStrategy (strategy) {
  if (!strategy || typeof strategy !== 'string') {
    throw new Error('Invalid strategy: Strategy must be a non-empty string')
  }

  const validStrategies = ['efficient', 'privacy', 'security']
  const normalizedStrategy = strategy.toLowerCase().trim()

  if (!validStrategies.includes(normalizedStrategy)) {
    throw new Error(`Invalid strategy: Invalid strategy '${strategy}'. Valid strategies: ${validStrategies.join(', ')}`)
  }

  return true
}

/**
 * Validate a token quantity with decimal precision.
 * @param {string|number} qty - The quantity to validate
 * @param {number} decimals - Max allowed decimal places
 * @returns {number} The parsed amount
 * @throws {Error} If quantity is invalid
 */
export function validateQuantity (qty, decimals) {
  const amount = parseFloat(qty)

  if (isNaN(amount)) {
    throw new Error('Invalid quantity: Quantity must be a valid number')
  }

  if (amount <= 0) {
    throw new Error('Invalid quantity: Quantity must be greater than 0')
  }

  const decimalPlaces = (qty.toString().split('.')[1] || '').length
  if (decimalPlaces > decimals) {
    throw new Error(`Invalid quantity: Too many decimal places. Token supports max ${decimals} decimals`)
  }

  const atoms = amount * Math.pow(10, decimals)
  if (atoms < 1) {
    const minAmount = 1 / Math.pow(10, decimals)
    throw new Error(`Invalid quantity: Amount too small. Minimum: ${minAmount}`)
  }

  return amount
}

/**
 * Validate a token ID (64-character hex string).
 * @param {string} tokenId - The token ID to validate
 * @throws {Error} If token ID is invalid
 */
export function validateTokenId (tokenId) {
  if (!tokenId || tokenId === '') {
    throw new Error('You must specify a token ID with the -t flag.')
  }

  if (typeof tokenId !== 'string' || tokenId.length !== 64) {
    throw new Error('Token ID must be a 64-character hex string.')
  }

  if (!/^[a-fA-F0-9]+$/.test(tokenId)) {
    throw new Error('Token ID must contain only hexadecimal characters.')
  }

  return true
}

/**
 * Validate a wallet name.
 * @param {string} name - The wallet name to validate
 * @throws {Error} If wallet name is missing
 */
export function validateWalletName (name) {
  if (!name || name === '') {
    throw new Error('You must specify a wallet name with the -n flag.')
  }

  return true
}
