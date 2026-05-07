document.addEventListener('DOMContentLoaded', () => {
  const cartCountSpan = document.getElementById('cartCount');
  const openCartBtn = document.getElementById('openCartBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const webBaseUrlInput = document.getElementById('webBaseUrl');
  const authTokenInput = document.getElementById('authToken');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const compareBtn = document.getElementById('compareBtn');
  const currentPageStatus = document.getElementById('currentPageStatus');
  const comparisonResult = document.getElementById('comparisonResult');
  const accountStatus = document.getElementById('accountStatus');
  const status = document.getElementById('status');

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
    if (message) {
      setTimeout(() => {
        status.textContent = '';
        status.classList.remove('error');
      }, 3000);
    }
  }

  function setAuthLoading(isLoading) {
    loginBtn.disabled = isLoading;
    signupBtn.disabled = isLoading;
    logoutBtn.disabled = isLoading;
  }

  function renderSession(email) {
    if (email) {
      accountStatus.textContent = `Signed in as ${email}`;
      accountStatus.classList.remove('signed-out');
      logoutBtn.style.display = 'inline-block';
    } else {
      accountStatus.textContent = 'Signed out';
      accountStatus.classList.add('signed-out');
      logoutBtn.style.display = 'none';
    }
  }

  function renderComparison(comparison) {
    const confidence = Math.round((comparison.confidence || 0) * 100);
    comparisonResult.replaceChildren();

    const summary = document.createElement('div');
    summary.textContent = `${comparison.matchType} match at ${comparison.preferredStore}`;
    comparisonResult.appendChild(summary);

    const confidenceLine = document.createElement('div');
    confidenceLine.textContent = `Confidence: ${confidence}%`;
    comparisonResult.appendChild(confidenceLine);

    if (comparison.destinationPrice != null) {
      const priceLine = document.createElement('div');
      priceLine.textContent = `Price: $${Number(comparison.destinationPrice).toFixed(2)}`;
      comparisonResult.appendChild(priceLine);
    }

    if (comparison.priceComparison?.label) {
      const priceComparisonLine = document.createElement('div');
      priceComparisonLine.className = comparison.priceComparison.cheaperAtPreferred ? 'success' : 'muted';
      priceComparisonLine.textContent = comparison.priceComparison.label;
      comparisonResult.appendChild(priceComparisonLine);
    }

    const checkoutLine = document.createElement('div');
    checkoutLine.className = comparison.checkoutPathAvailable ? 'success' : 'muted';
    checkoutLine.textContent = comparison.availabilityStatus ||
      (comparison.checkoutPathAvailable ? 'Checkout path available' : 'No checkout path detected yet');
    comparisonResult.appendChild(checkoutLine);

    if (comparison.destinationUrl) {
      const link = document.createElement('a');
      link.href = comparison.destinationUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Open matched product';
      comparisonResult.appendChild(link);
    }
  }

  function updateCount() {
    chrome.runtime.sendMessage({ action: 'getCartCount' }, (response) => {
      if (response && response.count !== undefined) {
        cartCountSpan.textContent = response.count;
      }
      if (response?.error) {
        setStatus(response.error, true);
      }
    });
  }

  function requestCurrentPageProduct(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        callback(null, 'No active tab found');
        return;
      }

      chrome.tabs.sendMessage(tabId, { action: 'getProductInfo' }, (response) => {
        if (chrome.runtime.lastError) {
          callback(null, 'Open a product page where the extension content script is available');
          return;
        }
        callback(response?.productInfo || null);
      });
    });
  }

  updateCount();
  chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
    if (!response) return;
    apiBaseUrlInput.value = response.apiBaseUrl || '';
    webBaseUrlInput.value = response.webBaseUrl || '';
    authTokenInput.value = response.authToken || '';
    emailInput.value = response.authUserEmail || '';
    renderSession(response.authUserEmail || (response.authToken ? 'token user' : ''));
  });

  requestCurrentPageProduct((productInfo, error) => {
    if (error) {
      currentPageStatus.textContent = error;
      return;
    }
    currentPageStatus.textContent = productInfo?.title
      ? productInfo.title
      : 'Could not detect product details on this page.';
  });

  saveSettingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      {
        action: 'saveConfig',
        apiBaseUrl: apiBaseUrlInput.value.trim(),
        webBaseUrl: webBaseUrlInput.value.trim(),
        authToken: authTokenInput.value.trim(),
      },
      (response) => {
        setStatus(response?.success ? 'Settings saved' : 'Unable to save settings', !response?.success);
        chrome.runtime.sendMessage({ action: 'getConfig' }, (config) => {
          renderSession(config?.authUserEmail || (config?.authToken ? 'token user' : ''));
        });
      }
    );
  });

  function submitAuth(action) {
    setAuthLoading(true);
    chrome.runtime.sendMessage(
      {
        action,
        email: emailInput.value.trim(),
        password: passwordInput.value,
      },
      (response) => {
        setAuthLoading(false);
        if (!response?.success) {
          setStatus(response?.error || 'Authentication failed', true);
          return;
        }
        passwordInput.value = '';
        authTokenInput.value = '';
        renderSession(response.authUserEmail);
        setStatus(action === 'signup' ? 'Account created' : 'Signed in');
        chrome.runtime.sendMessage({ action: 'getConfig' }, (config) => {
          authTokenInput.value = config?.authToken || '';
        });
        updateCount();
      }
    );
  }

  loginBtn.addEventListener('click', () => submitAuth('login'));
  signupBtn.addEventListener('click', () => submitAuth('signup'));
  passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitAuth('login');
  });
  logoutBtn.addEventListener('click', () => {
    setAuthLoading(true);
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      setAuthLoading(false);
      if (!response?.success) {
        setStatus('Unable to sign out', true);
        return;
      }
      authTokenInput.value = '';
      renderSession('');
      updateCount();
      setStatus('Signed out');
    });
  });

  compareBtn.addEventListener('click', () => {
    compareBtn.disabled = true;
    comparisonResult.textContent = '';
    requestCurrentPageProduct((productInfo, error) => {
      if (error || !productInfo?.title) {
        compareBtn.disabled = false;
        setStatus(error || 'Could not detect product details on this page', true);
        return;
      }

      chrome.runtime.sendMessage(
        { action: 'comparePreferredMerchant', productInfo },
        (response) => {
          compareBtn.disabled = false;
          if (!response?.success) {
            setStatus(response?.error || 'Unable to compare preferred store', true);
            return;
          }
          renderComparison(response.comparison);
        }
      );
    });
  });

  refreshBtn.addEventListener('click', updateCount);
  openCartBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
      chrome.tabs.create({ url: response?.webBaseUrl || 'http://localhost:3000' });
    });
  });
});
