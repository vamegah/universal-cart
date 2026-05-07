let latestProductInfo = null;

function getProductInfo() {
  latestProductInfo = window.UniversalCartProductDetection.getProductInfo(document, window.location);
  return latestProductInfo;
}

function createButton(text, color) {
  const element = document.createElement('button');
  element.innerText = text;
  element.style.backgroundColor = color;
  element.style.color = 'white';
  element.style.border = 'none';
  element.style.borderRadius = '8px';
  element.style.padding = '10px 12px';
  element.style.cursor = 'pointer';
  element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  element.style.font = '13px Arial, sans-serif';
  return element;
}

function renderComparisonStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.display = 'block';
  statusBox.style.color = isError ? '#991b1b' : '#065f46';
  statusBox.style.backgroundColor = isError ? '#fee2e2' : '#ecfdf5';
  statusBox.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
}

const panel = document.createElement('div');
panel.style.position = 'fixed';
panel.style.bottom = '20px';
panel.style.right = '20px';
panel.style.zIndex = '9999';
panel.style.display = 'flex';
panel.style.flexDirection = 'column';
panel.style.alignItems = 'flex-end';
panel.style.gap = '8px';

const statusBox = document.createElement('div');
statusBox.style.display = 'none';
statusBox.style.maxWidth = '260px';
statusBox.style.border = '1px solid #a7f3d0';
statusBox.style.borderRadius = '8px';
statusBox.style.padding = '8px 10px';
statusBox.style.font = '12px Arial, sans-serif';
statusBox.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';

const buttonRow = document.createElement('div');
buttonRow.style.display = 'flex';
buttonRow.style.gap = '8px';

const button = createButton('+ Add to Universal Cart', '#3b82f6');
const compareButton = createButton('Check preferred store', '#0f766e');

buttonRow.appendChild(compareButton);
buttonRow.appendChild(button);
panel.appendChild(statusBox);
panel.appendChild(buttonRow);
document.body.appendChild(panel);

if (window.UniversalCartProductDetection.observeProductChanges) {
  window.UniversalCartProductDetection.observeProductChanges(document, window.location, (productInfo) => {
    latestProductInfo = productInfo;
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProductInfo') {
    sendResponse({ productInfo: latestProductInfo || getProductInfo() });
  }
});

button.addEventListener('click', async () => {
  const productInfo = getProductInfo();
  if (!productInfo.title) {
    alert('Could not detect product. Please copy the URL and paste on the Universal Cart website.');
    return;
  }

  // Send to background script
  chrome.runtime.sendMessage(
    { action: 'addToCart', url: productInfo.url, productInfo },
    (response) => {
      if (response && response.success) {
        button.innerText = response.duplicate ? 'Cart updated' : 'Added';
        if (response.duplicate) {
          renderComparisonStatus('This product was already in your Universal Cart, so the existing cart item was updated.');
        }
        setTimeout(() => { button.innerText = '+ Add to Universal Cart'; }, 2000);
      } else {
        alert(response?.error || 'Failed to add product. Make sure you are signed in and the backend is running.');
      }
    }
  );
});

compareButton.addEventListener('click', () => {
  const productInfo = getProductInfo();
  if (!productInfo.title) {
    renderComparisonStatus('Could not detect product details on this page.', true);
    return;
  }

  compareButton.disabled = true;
  compareButton.innerText = 'Checking...';
  chrome.runtime.sendMessage(
    { action: 'comparePreferredMerchant', productInfo },
    (response) => {
      compareButton.disabled = false;
      compareButton.innerText = 'Check preferred store';
      if (!response?.success) {
        renderComparisonStatus(response?.error || 'Unable to compare preferred store.', true);
        return;
      }

      const comparison = response.comparison;
      const confidence = Math.round((comparison.confidence || 0) * 100);
      const price = comparison.destinationPrice != null ? ` at $${Number(comparison.destinationPrice).toFixed(2)}` : '';
      const priceComparison = comparison.priceComparison?.label ? ` ${comparison.priceComparison.label}` : '';
      const checkout = comparison.availabilityStatus ? ` ${comparison.availabilityStatus}` : '';
      renderComparisonStatus(`${comparison.matchType} match at ${comparison.preferredStore}${price} (${confidence}% confidence).${priceComparison}${checkout}`);
    }
  );
});
