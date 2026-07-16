/**
 * app.js — Main App Controller
 * Handles tab switching, language picker, and wires up all modules
 */

const App = (() => {
  // ── State ────────────────────────────────────────────────
  const state = {
    text:   { src: 'zh', tgt: 'en' },
    voice:  { src: 'zh', tgt: 'en' },
    camera: { tgt: 'en' },
  };
  let debounceTimer   = null;
  let langPickerTarget = null; // { mode, which }
  const $ = id => document.getElementById(id);

  // ── Boot ─────────────────────────────────────────────────
  async function boot() {
    await Translator.init();
    VoiceModule.init();
    CameraModule.init();
    ConvModule.init();
    await WordBook.init();
    await QuizModule.init();

    setupTabs();
    setupTextTranslation();
    setupLangPicker();

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ── Tabs ─────────────────────────────────────────────────
  function setupTabs() {
    const TITLES = {
      text:   '✏️ 文字翻譯',
      camera: '📷 相機翻譯',
      voice:  '🎙️ 語音翻譯',
      conv:   '💬 對話翻譯',
      words:  '📚 單字書',
      quiz:   '✍️ 單字填空',
    };
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('page-' + page).classList.add('active');
        $('page-title').textContent = TITLES[page] || '';
        if (page !== 'camera') CameraModule.stopCamera();
      });
    });
  }

  // ── Text translation ─────────────────────────────────────
  function setupTextTranslation() {
    $('input-text').addEventListener('input', () => {
      const count = $('input-text').value.length;
      $('char-count').textContent = count + ' 字';
      clearTimeout(debounceTimer);
      if (!count) { $('output-card').classList.add('hidden'); return; }
      debounceTimer = setTimeout(doTranslate, 400);
    });

    $('swap-btn').addEventListener('click', () => {
      [state.text.src, state.text.tgt] = [state.text.tgt, state.text.src];
      const inp = $('input-text').value;
      $('input-text').value          = $('output-text').textContent;
      $('output-text').textContent   = inp;
      updateLangButtons();
      doTranslate();
    });

    $('copy-btn').addEventListener('click', () => {
      navigator.clipboard?.writeText($('output-text').textContent);
      $('copy-btn').textContent = '✅';
      setTimeout(() => $('copy-btn').textContent = '📋', 1200);
    });

    $('speak-output-btn').addEventListener('click', () => {
      Translator.speak($('output-text').textContent, state.text.tgt);
    });

    $('src-lang-btn').addEventListener('click', () => openLangPicker('text',  'src'));
    $('tgt-lang-btn').addEventListener('click', () => openLangPicker('text',  'tgt'));
    $('v-src-lang-btn').addEventListener('click', () => openLangPicker('voice', 'src'));
    $('v-tgt-lang-btn').addEventListener('click', () => openLangPicker('voice', 'tgt'));
  }

  async function doTranslate() {
    const text = $('input-text').value.trim();
    if (!text) return;
    $('translating-spinner').classList.remove('hidden');
    const result = await Translator.translate(text, state.text.src, state.text.tgt);
    $('output-text').textContent       = result;
    $('output-card').classList.remove('hidden');
    $('output-lang-label').textContent = getLangDisplay(state.text.tgt);
    $('translating-spinner').classList.add('hidden');
  }

  function updateLangButtons() {
    $('src-lang-btn').textContent   = getLangDisplay(state.text.src);
    $('tgt-lang-btn').textContent   = getLangDisplay(state.text.tgt);
    $('v-src-lang-btn').textContent = getLangDisplay(state.voice.src);
    $('v-tgt-lang-btn').textContent = getLangDisplay(state.voice.tgt);
  }

  function getLangDisplay(code) {
    const l = Translator.getLangs().find(x => x.code === code);
    return l ? `${l.flag} ${l.name}` : code;
  }

  // ── Language picker ───────────────────────────────────────
  function setupLangPicker() {
    $('lang-modal').addEventListener('click', e => {
      if (e.target === $('lang-modal')) closeLangPicker();
    });
  }

  function openLangPicker(mode, which) {
    langPickerTarget = { mode, which };
    const current = state[mode]?.[which] || state.camera.tgt;
    $('lang-list').innerHTML = Translator.getLangs().map(l => `
      <div class="lang-option ${l.code === current ? 'selected' : ''}" onclick="App.selectLang('${l.code}')">
        <span class="lang-flag">${l.flag}</span>
        <span>${l.name}</span>
        ${l.code === current ? '<span style="margin-left:auto">✓</span>' : ''}
      </div>
    `).join('');
    $('lang-modal').classList.remove('hidden');
  }

  function selectLang(code) {
    if (!langPickerTarget) return;
    const { mode, which } = langPickerTarget;
    if (state[mode]) state[mode][which] = code;
    if (mode === 'voice') {
      VoiceModule.setSrcLang(state.voice.src);
      VoiceModule.setTgtLang(state.voice.tgt);
    }
    if (mode === 'camera') CameraModule.setTgtLang(code);
    updateLangButtons();
    closeLangPicker();
    if (mode === 'text') doTranslate();
  }

  function closeLangPicker() { $('lang-modal').classList.add('hidden'); }

  return { boot, selectLang };
})();

document.addEventListener('DOMContentLoaded', App.boot);
