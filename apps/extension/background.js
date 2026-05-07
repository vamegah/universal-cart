if (typeof importScripts === 'function') {
  importScripts('extension-config.js');
  importScripts('background-core.js');
}

const backgroundCore = typeof UniversalCartBackgroundCore !== 'undefined'
  ? UniversalCartBackgroundCore
  : require('./background-core');
const {
  DEFAULT_API_BASE_URL,
  DEFAULT_WEB_BASE_URL,
  authenticate,
  comparePreferredMerchant,
  getConfig,
  importFromProductInfo,
  logoutSession,
  syncRemoteCartCount,
} = backgroundCore;

const storage = chrome.storage.local;
const fetchImpl = (...args) => fetch(...args);

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addToCart') {
    importFromProductInfo({ storage, fetchImpl, productInfo: request.productInfo || { url: request.url } })
      .then(({ product, duplicate, count }) => sendResponse({ success: true, product, duplicate, count }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // indicates async response
  }

  if (request.action === 'getCartCount') {
    syncRemoteCartCount({ storage, fetchImpl })
      .then((count) => sendResponse({ count }))
      .catch((err) => sendResponse({ count: 0, error: err.message }));
    return true;
  }

  if (request.action === 'comparePreferredMerchant') {
    comparePreferredMerchant({ storage, fetchImpl, productInfo: request.productInfo, preferredStoreOverride: request.preferredStore })
      .then((comparison) => sendResponse({ success: true, comparison }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'getConfig') {
    getConfig(storage).then(sendResponse);
    return true;
  }

  if (request.action === 'saveConfig') {
    const updates = {
      apiBaseUrl: request.apiBaseUrl || DEFAULT_API_BASE_URL,
      webBaseUrl: request.webBaseUrl || DEFAULT_WEB_BASE_URL,
      authToken: request.authToken || '',
    };
    storage.set(updates, () => sendResponse({ success: true, config: updates }));
    return true;
  }

  if (request.action === 'login' || request.action === 'signup') {
    const mode = request.action === 'signup' ? 'signup' : 'login';
    authenticate({ storage, fetchImpl, mode, email: String(request.email || '').trim(), password: String(request.password || '') })
      .then((session) => sendResponse({ success: true, ...session }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'logout') {
    logoutSession({ storage, fetchImpl })
      .then(sendResponse)
      .catch(() => {
        storage.remove(['authToken', 'authUserEmail', 'cart'], () => sendResponse({ success: true }));
      });
    return true;
  }
});
