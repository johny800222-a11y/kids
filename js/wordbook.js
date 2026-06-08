/**
 * wordbook.js — Word Book + Flashcard
 * Data from: data/words_zh_en.json (loaded by Translator)
 */

const WordBook = (() => {
  const CAT_COLORS = ['#FF6B6B','#4ECDC4','#A29BFE','#FD9644','#6BCB77','#FFE66D','#74B9FF','#FD79A8','#00B894','#FDCB6E'];
  let allWords      = [];
  let filtered      = [];
  let currentCat    = '全部';
  let searchQuery   = '';
  let learned       = new Set(JSON.parse(localStorage.getItem('kt_learned') || '[]'));
  let favorites     = new Set(JSON.parse(localStorage.getItem('kt_favorites') || '[]'));
  let fcWords       = [];
  let fcIndex       = 0;
  let fcFlipped     = false;
  let selectedWord  = null;

  const $ = id => document.getElementById(id);

  // ── Init ────────────────────────────────────────────────
  async function init() {
    // Wait for Translator dict
    let tries = 0;
    while (!Translator.getDict() && tries < 20) {
      await new Promise(r => setTimeout(r, 200));
      tries++;
    }
    allWords = (Translator.getDict() || []).map((w, i) => ({ ...w, id: i }));

    buildCategoryBar();
    renderList();
    updateStats();

    $('wb-search').addEventListener('input', e => { searchQuery = e.target.value; renderList(); });
    $('flashcard-btn').addEventListener('click', openFlashcard);
    $('fc-close-btn').addEventListener('click', closeFlashcard);
    $('fc-card').addEventListener('click', flipCard);
    $('fc-next-btn').addEventListener('click', () => navigate(1));
    $('fc-prev-btn').addEventListener('click', () => navigate(-1));
    $('fc-speak-btn').addEventListener('click', () => {
      if (fcWords[fcIndex]) Translator.speak(fcWords[fcIndex].en, 'en');
    });
    $('mark-learned-btn').addEventListener('click', markCurrentLearned);
  }

  // ── Category bar ─────────────────────────────────────────
  function buildCategoryBar() {
    const cats = ['全部', ...new Set(allWords.map(w => w.cat).filter(Boolean))].sort((a,b) => a === '全部' ? -1 : a.localeCompare(b, 'zh'));
    const container = $('cat-scroll');
    container.innerHTML = cats.map((cat, i) => {
      const color = CAT_COLORS[i % CAT_COLORS.length];
      return `<button class="cat-chip ${cat === currentCat ? 'active' : ''}"
        data-cat="${cat}" style="color:${color};border-color:${color};${cat === currentCat ? `background:${color}` : ''}"
        onclick="WordBook.selectCat('${cat}')">${cat}</button>`;
    }).join('');
  }

  function selectCat(cat) {
    currentCat = cat;
    buildCategoryBar();
    renderList();
  }

  // ── Render word list ──────────────────────────────────────
  function renderList() {
    filtered = allWords.filter(w => {
      const matchCat  = currentCat === '全部' || w.cat === currentCat;
      const matchSearch = !searchQuery || w.en.includes(searchQuery.toLowerCase()) || (w.zh && w.zh.includes(searchQuery));
      return matchCat && matchSearch;
    });

    $('wb-total-count').textContent = filtered.length;

    $('word-list').innerHTML = filtered.map(w => `
      <div class="word-row" onclick="WordBook.openDetail(${w.id})">
        <div class="dot ${learned.has(w.id) ? 'learned' : ''}"></div>
        <div>
          <div class="en">${w.en}</div>
          <div class="zh">${w.zh || ''}</div>
        </div>
        <div class="actions">
          <span onclick="event.stopPropagation();Translator.speak('${w.en.replace(/'/g,"\\'")}','en')" class="star" title="朗讀">🔊</span>
          <span onclick="event.stopPropagation();WordBook.toggleFav(${w.id})" class="star">${favorites.has(w.id) ? '⭐' : '☆'}</span>
        </div>
      </div>
    `).join('');
  }

  function updateStats() {
    $('wb-learned-count').textContent = learned.size;
    $('wb-total-count').textContent = allWords.length;
  }

  // ── Word detail modal ─────────────────────────────────────
  function openDetail(id) {
    const w = allWords.find(x => x.id === id);
    if (!w) return;
    selectedWord = w;

    let html = `
      <div class="word-detail-card">
        <div class="word-detail-en">${w.en}
          <button class="icon-btn" onclick="Translator.speak('${w.en.replace(/'/g,"\\'")}','en')">🔊</button>
        </div>
        <div class="word-detail-zh">${w.zh || ''}</div>
      </div>`;

    if (w.ex_en || w.ex_zh) {
      html += `<div class="example-box">`;
      if (w.ex_en) html += `
        <div class="ex-row">
          <span class="ex-tag en">EN</span>
          <span class="ex-text">${w.ex_en}</span>
          <button class="icon-btn" onclick="Translator.speak('${w.ex_en.replace(/'/g,"\\'")}','en')">🔊</button>
        </div>`;
      if (w.ex_zh) html += `
        <div class="ex-row">
          <span class="ex-tag zh">中</span>
          <span class="ex-text">${w.ex_zh}</span>
        </div>`;
      html += `</div>`;
    }

    $('word-detail-content').innerHTML = html;
    $('mark-learned-btn').textContent = learned.has(id) ? '取消學習' : '標記為已學習 ✓';
    $('word-modal').classList.remove('hidden');
    $('word-modal').onclick = e => { if (e.target === $('word-modal')) closeDetail(); };
  }

  function closeDetail() { $('word-modal').classList.add('hidden'); }

  function markCurrentLearned() {
    if (!selectedWord) return;
    const id = selectedWord.id;
    if (learned.has(id)) learned.delete(id); else learned.add(id);
    saveLearned();
    renderList();
    updateStats();
    $('mark-learned-btn').textContent = learned.has(id) ? '取消學習' : '標記為已學習 ✓';
  }

  function toggleFav(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    localStorage.setItem('kt_favorites', JSON.stringify([...favorites]));
    renderList();
  }

  function saveLearned() {
    localStorage.setItem('kt_learned', JSON.stringify([...learned]));
  }

  // ── Flashcard ─────────────────────────────────────────────
  function openFlashcard() {
    fcWords   = filtered.length ? filtered : allWords;
    fcIndex   = 0;
    fcFlipped = false;
    renderCard();
    $('flashcard-modal').classList.remove('hidden');
  }

  function closeFlashcard() { $('flashcard-modal').classList.add('hidden'); }

  function renderCard() {
    const w = fcWords[fcIndex];
    if (!w) return;
    $('fc-en').textContent = w.en;
    $('fc-ex-en').textContent = w.ex_en || '';
    $('fc-zh').textContent = w.zh || '';
    $('fc-ex-zh').textContent = w.ex_zh || '';
    $('fc-progress').textContent = `${fcIndex + 1} / ${fcWords.length}`;
    $('fc-progress-fill').style.width = `${((fcIndex + 1) / fcWords.length * 100).toFixed(1)}%`;
    $('fc-card').classList.remove('flipped');
    fcFlipped = false;
    $('fc-prev-btn').style.visibility = fcIndex === 0 ? 'hidden' : 'visible';
    $('fc-next-btn').style.visibility = fcIndex >= fcWords.length - 1 ? 'hidden' : 'visible';
  }

  function flipCard() {
    fcFlipped = !fcFlipped;
    $('fc-card').classList.toggle('flipped', fcFlipped);
    if (!fcFlipped) Translator.speak(fcWords[fcIndex].en, 'en');
  }

  function navigate(dir) {
    fcIndex = Math.max(0, Math.min(fcWords.length - 1, fcIndex + dir));
    renderCard();
  }

  return { init, selectCat, openDetail, closeDetail, toggleFav };
})();
