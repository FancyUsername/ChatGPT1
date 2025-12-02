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
    const [coverImg, codeImg] = await Promise.all([
      loadImage(selectedItem.coverUrl || '/placeholder.svg'),
      loadImage(selectedItem.codeUrl),
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
    const coverWidth = coverHeight;
    const codeHeight = Math.min(height * 0.14, coverHeight * 0.6);
    const centerX = width / 2;

    const coverX = centerX - coverWidth / 2;
    const coverY = margin;
    ctx.drawImage(coverImg, coverX, coverY, coverWidth, coverHeight);

    const codeWidth = (codeImg.width / codeImg.height) * codeHeight;
    const codeX = centerX - codeWidth / 2;
    const codeY = coverY + coverHeight + gap;
    ctx.drawImage(codeImg, codeX, codeY, codeWidth, codeHeight);

    ctx.fillStyle = '#0b1020';
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(width * 0.035)}px Inter, Arial, sans-serif`;
    const titleY = codeY + codeHeight + gap;
    ctx.fillText(selectedItem.name, centerX, titleY);

    if (selectedItem.subtitle) {
      ctx.fillStyle = '#334155';
      ctx.font = `${Math.round(width * 0.025)}px Inter, Arial, sans-serif`;
      ctx.fillText(selectedItem.subtitle, centerX, titleY + Math.round(width * 0.04));
    }

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
