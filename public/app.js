const form = document.getElementById('search-form');
const queryInput = document.getElementById('search-query');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const clearHistoryButton = document.getElementById('clear-history');
const detailCard = document.getElementById('detail-card');
const detailTitle = document.getElementById('detail-title');
const detailLink = document.getElementById('detail-link');
const detailCover = document.getElementById('detail-cover');
const detailCode = document.getElementById('detail-code');
const detailQr = document.getElementById('detail-qr');
const resolutionSelect = document.getElementById('resolution');
const customWidth = document.getElementById('custom-width');
const customHeight = document.getElementById('custom-height');
const downloadButton = document.getElementById('download');
const messageEl = document.getElementById('message');
const canvas = document.getElementById('canvas');

const historyKey = 'spotify-search-history';
let selectedItem = null;

function loadHistory() {
  const stored = localStorage.getItem(historyKey);
  return stored ? JSON.parse(stored) : [];
}

function saveHistory(entries) {
  localStorage.setItem(historyKey, JSON.stringify(entries.slice(0, 10)));
}

function renderHistory() {
  const history = loadHistory();
  historyEl.innerHTML = '';
  if (!history.length) {
    historyEl.textContent = 'Keine Suchbegriffe gespeichert.';
    return;
  }

  history.forEach((term) => {
    const button = document.createElement('button');
    button.textContent = term;
    button.addEventListener('click', () => {
      queryInput.value = term;
      performSearch(term);
    });
    historyEl.appendChild(button);
  });
}

async function performSearch(query) {
  const checkedTypes = Array.from(form.elements['type'])
    .filter((el) => el.checked)
    .map((el) => el.value);

  const types = checkedTypes.length ? checkedTypes.join(',') : 'album,artist,playlist,track';
  statusEl.textContent = 'Suche läuft …';
  resultsEl.innerHTML = '';
  messageEl.textContent = '';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(types)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unbekannter Fehler.');
    }

    statusEl.textContent = `${data.count} Ergebnisse für "${data.query}"`;
    renderResults(data.results);
    updateHistory(query);
  } catch (error) {
    statusEl.textContent = 'Fehler bei der Suche.';
    resultsEl.innerHTML = `<p class="message">${error.message}</p>`;
  }
}

function renderResults(items) {
  if (!items.length) {
    resultsEl.innerHTML = '<p class="message">Keine Treffer gefunden.</p>';
    return;
  }

  resultsEl.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'result';

    const cover = document.createElement('img');
    cover.src = item.coverUrl || '/placeholder.svg';
    cover.alt = `${item.type} Cover`;

    const meta = document.createElement('div');
    meta.className = 'result__meta';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const subtitle = document.createElement('p');
    subtitle.textContent = item.subtitle || '';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.type;

    meta.append(title, subtitle, badge);

    const actions = document.createElement('div');
    actions.className = 'result__actions';
    const open = document.createElement('a');
    open.href = item.url;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = 'Spotify-Link';

    const select = document.createElement('button');
    select.textContent = 'Cover + Code anzeigen';
    select.addEventListener('click', () => selectItem(item));

    actions.append(open, select);
    card.append(cover, meta, actions);
    resultsEl.appendChild(card);
  });
}

function updateHistory(query) {
  const history = loadHistory();
  const filtered = [query, ...history.filter((entry) => entry !== query)];
  saveHistory(filtered);
  renderHistory();
}

function parseResolution() {
  const preset = resolutionSelect.value;
  const [presetW, presetH] = preset.split('x').map((n) => parseInt(n, 10));
  const width = Number(customWidth.value) || presetW;
  const height = Number(customHeight.value) || presetH;
  return { width, height };
}

function selectItem(item) {
  selectedItem = item;
  detailCard.hidden = false;
  detailTitle.textContent = item.name;
  detailLink.href = item.url;
  detailLink.textContent = 'Auf Spotify öffnen';
  detailCover.src = item.coverUrl || '/placeholder.svg';
  detailCode.src = item.codeUrl || '';
  
  // Generiere QR-Code für die URL
  detailQr.innerHTML = '';
  if (item.url) {
    new QRCode(detailQr, {
      text: item.url,
      width: 200,
      height: 200,
      colorDark: '#0b1020',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
  
  messageEl.textContent = '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    img.src = src;
  });
}

function generateQRCodeImage(text, size = 200) {
  return new Promise((resolve, reject) => {
    const tempDiv = document.createElement('div');
    try {
      new QRCode(tempDiv, {
        text,
        width: size,
        height: size,
        colorDark: '#0b1020',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });
      
      const qrCanvas = tempDiv.querySelector('canvas');
      if (qrCanvas) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('QR-Code konnte nicht generiert werden.'));
        img.src = qrCanvas.toDataURL();
      } else {
        reject(new Error('QR-Code Canvas nicht gefunden.'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function generateComposite() {
  if (!selectedItem) {
    messageEl.textContent = 'Bitte zuerst ein Element auswählen.';
    return;
  }

  messageEl.textContent = 'Generiere Bild …';
  const { width, height } = parseResolution();

  if (!width || !height) {
    messageEl.textContent = 'Ungültige Auflösung.';
    return;
  }

  try {
    const [coverImg, codeImg, qrImg] = await Promise.all([
      loadImage(selectedItem.coverUrl || '/placeholder.svg'),
      loadImage(selectedItem.codeUrl),
      generateQRCodeImage(selectedItem.url, 300),
    ]);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = Math.round(width * 0.08);
    const gap = Math.round(width * 0.04);
    const availableWidth = width - margin * 2;
    const coverHeight = Math.min(height * 0.55, availableWidth);
    const coverWidth = coverHeight; // keep cover square
    const centerX = width / 2;

    // Cover zentriert
    const coverX = centerX - coverWidth / 2;
    const coverY = margin;
    ctx.drawImage(coverImg, coverX, coverY, coverWidth, coverHeight);

    // --- Spotify Code: directly below cover, left-aligned with cover
    const spotifyAspectRatio = codeImg.width / codeImg.height;
    // Max width for codes is the cover width (per requirement)
    let spotifyCodeWidth = coverWidth;
    let spotifyCodeHeight = spotifyCodeWidth / spotifyAspectRatio;

    // If spotify code would be taller than the cover, limit by height and recompute width
    if (spotifyCodeHeight > coverHeight) {
      spotifyCodeHeight = coverHeight;
      spotifyCodeWidth = spotifyCodeHeight * spotifyAspectRatio;
    }

    // Position spotify code directly under cover, left-aligned with it
    const spotifyX = coverX;
    const spotifyY = coverY + coverHeight + gap;

    // --- QR code below spotify code, left-aligned with cover
    // Start with QR size limited by cover dimensions
    let qrSize = Math.min(coverHeight, Math.round(coverWidth * 0.22));

    // Compute vertical space remaining after spotify code (respect bottom margin)
    const verticalSpaceAfterSpotify = height - spotifyY - spotifyCodeHeight - margin;

    // If we don't have enough vertical space for QR + margin, scale both spotify code and qr down proportionally
    if (verticalSpaceAfterSpotify < qrSize + gap) {
      // compute scale factor for the two stacked blocks (spotify + gap + qr) to fit
      const totalNeeded = spotifyCodeHeight + gap + qrSize;
      const available = height - spotifyY - margin;
      const scale = Math.max(0.3, available / totalNeeded);
      spotifyCodeHeight = Math.round(spotifyCodeHeight * scale);
      spotifyCodeWidth = Math.round(spotifyCodeWidth * scale);
      qrSize = Math.round(qrSize * scale);
    }

    // Ensure QR doesn't exceed coverWidth horizontally when combined with text area
    const minTextArea = Math.round(Math.min(availableWidth * 0.25, 120));
    if (qrSize > availableWidth - minTextArea - gap) {
      qrSize = Math.max(48, availableWidth - minTextArea - gap);
    }

    // Recompute spotifyX/Y in case sizes changed
    // Draw spotify code (full width up to spotifyCodeWidth)
    ctx.drawImage(codeImg, spotifyX, spotifyY, spotifyCodeWidth, spotifyCodeHeight);

    // QR-code below spotify code, left-aligned with cover
    const qrX = coverX;
    const qrY = spotifyY + spotifyCodeHeight + gap;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Title & subtitle to the right of QR, vertically centered next to QR
    const textX = qrX + qrSize + gap;
    const textAreaWidth = Math.max(0, availableWidth - (qrSize + gap));
    const textCenterY = qrY + qrSize / 2;

    ctx.fillStyle = '#0b1020';
    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.round(Math.max(12, width * 0.028))}px Inter, Arial, sans-serif`;
    // Draw title slightly above center
    ctx.fillText(selectedItem.name, textX, textCenterY - Math.round(width * 0.01));

    if (selectedItem.subtitle) {
      ctx.fillStyle = '#334155';
      ctx.font = `${Math.round(Math.max(10, width * 0.018))}px Inter, Arial, sans-serif`;
      ctx.fillText(selectedItem.subtitle, textX, textCenterY + Math.round(width * 0.02));
    }

    // Safety clamp: ensure nothing draws outside right/bottom edges
    // (All sizes positioned relative to coverX and margins; extra check to avoid overflow)
    // If text would overflow horizontally, reduce text size (simple approach)
    const maxTextWidth = textAreaWidth;
    // No reliable measureText fallback here to avoid reflow; keep conservative font sizing already applied.

    canvas.hidden = false;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `spotify-${selectedItem.type}-${selectedItem.id || 'motiv'}.png`;
    link.click();

    messageEl.textContent = 'Bild wurde generiert und heruntergeladen.';
  } catch (error) {
    messageEl.textContent = error.message;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  performSearch(queryInput.value.trim());
});

downloadButton.addEventListener('click', generateComposite);
clearHistoryButton.addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
});

renderHistory();
