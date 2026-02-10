/*
  Shared wallet loading and initialization helper.
  Replaces the duplicated wallet init pattern across 7+ command files.
*/

import MinimalXecWallet from 'minimal-xec-wallet'
import WalletUtil from './wallet-util.js'

const walletUtil = new WalletUtil()

/**
 * Load and initialize a wallet, with optional analytics support.
 *
 * @param {string} walletName - Name of the wallet to load
 * @param {Object} [options] - Options
 * @param {boolean} [options.analytics=false] - Whether to enable analytics
 * @param {Function} [options.WalletClass] - Wallet constructor (for testing)
 * @returns {Promise<Object>} Initialized wallet instance
 */
export async function loadWallet (walletName, { analytics = false, WalletClass = MinimalXecWallet } = {}) {
  const walletData = await walletUtil.loadWallet(walletName)
  const baseOpts = walletData.wallet?.hdPath ? { hdPath: walletData.wallet.hdPath } : {}

  if (!analytics) {
    const wallet = new WalletClass(walletData.wallet.mnemonic, baseOpts)
    await wallet.walletInfoPromise
    await wallet.initialize()
    return wallet
  }

  try {
    const analyticsOptions = await walletUtil.getAnalyticsOptions(walletName)
    const wallet = new WalletClass(walletData.wallet.mnemonic, analyticsOptions)
    await wallet.walletInfoPromise
    await wallet.initialize()

    if (wallet.utxos?.hasAnalytics?.()) return wallet

    // Analytics not available - fallback to plain wallet
    console.warn('Warning: Analytics not available, falling back to standard wallet')
    const plain = new WalletClass(walletData.wallet.mnemonic, baseOpts)
    await plain.walletInfoPromise
    await plain.initialize()
    return plain
  } catch (err) {
    console.warn(`Warning: Could not initialize analytics (${err.message}), falling back to standard wallet`)
    const plain = new WalletClass(walletData.wallet.mnemonic, baseOpts)
    await plain.walletInfoPromise
    await plain.initialize()
    return plain
  }
}

/**
 * Load wallet with analytics enabled (convenience wrapper).
 * Used by analytics-dependent commands like wallet-health, wallet-security, etc.
 *
 * @param {string} walletName - Name of the wallet to load
 * @param {Object} [options] - Options
 * @param {Function} [options.WalletClass] - Wallet constructor (for testing)
 * @returns {Promise<Object>} Initialized wallet instance with analytics
 * @throws {Error} If analytics are not available after initialization
 */
export async function loadWalletWithAnalytics (walletName, { WalletClass = MinimalXecWallet } = {}) {
  const walletData = await walletUtil.loadWalletWithAnalytics(walletName)
  const analyticsOptions = await walletUtil.getAnalyticsOptions(walletName)

  const wallet = new WalletClass(walletData.wallet.mnemonic, analyticsOptions)
  await wallet.walletInfoPromise
  await wallet.initialize()

  if (!wallet.utxos?.hasAnalytics?.()) {
    throw new Error('Analytics are not available for this wallet. Please ensure analytics are enabled and the wallet has been initialized.')
  }

  return wallet
}

export { walletUtil }
