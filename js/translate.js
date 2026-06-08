/**
 * translate.js — Translation Service
 * Offline: local JSON dictionary
 * Online:  LibreTranslate public API
 */

const LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇹🇼' },
  { code: 'en', name: '英文', flag: '🇺🇸' },
  { code: 'th', name: '泰文', flag: '🇹🇭' },
];

const Translator = (() => {
  let _dict = null;   // loaded from words_zh_en.json
  let _online = false;

  // ── Load offline dictionary ─────────────────────────────
  async function init() {
    try {
      const res = await fetch('data/words_zh_en.json');
      _dict = await res.json();   // array of {en, zh, cat, ex_en?, ex_zh?}
      console.log(`✅ Dictionary loaded: ${_dict.length} words`);
    } catch (e) {
      console.warn('Dictionary not loaded', e);
      _dict = [];
    }

    // Check online status
    window.addEventListener('online',  () => { _online = true;  updateOnlineUI(); });
    window.addEventListener('offline', () => { _online = false; updateOnlineUI(); });
    _online = navigator.onLine;
    updateOnlineUI();
  }

  function updateOnlineUI() {
    const dot   = document.getElementById('online-dot');
    const badge = document.getElementById('online-badge');
    if (dot)   dot.classList.toggle('online', _online);
    if (badge) badge.classList.toggle('hidden', !_online);
  }

  // ── Detect language heuristic ───────────────────────────
  function detectLang(text) {
    if (/[฀-๿]/.test(text)) return 'th';
    if (/[一-鿿㐀-䶿]/.test(text)) return 'zh';
    return 'en';
  }

  // ── Offline lookup ──────────────────────────────────────
  function lookupOffline(text, srcLang, tgtLang) {
    if (!_dict) return null;
    const q = text.trim().toLowerCase();

    if (srcLang === 'en' && tgtLang === 'zh') {
      const hit = _dict.find(w => w.en === q || w.en.startsWith(q));
      return hit ? hit.zh : null;
    }
    if (srcLang === 'zh' && tgtLang === 'en') {
      const hit = _dict.find(w => w.zh === q || w.zh.startsWith(q));
      return hit ? hit.en : null;
    }
    return null;
  }

  // ── Online translation via LibreTranslate ───────────────
  async function translateOnline(text, srcLang, tgtLang) {
    const API = 'https://libretranslate.com/translate';
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: srcLang, target: tgtLang, format: 'text', api_key: '' }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return data.translatedText || null;
    } catch { return null; }
  }

  // ── Main translate function ─────────────────────────────
  async function translate(text, srcLang, tgtLang) {
    if (!text.trim()) return '';
    if (srcLang === tgtLang) return text;

    // 1. Try offline first
    const offline = lookupOffline(text, srcLang, tgtLang);
    if (offline) return offline;

    // 2. Online fallback
    if (_online) {
      const online = await translateOnline(text, srcLang, tgtLang);
      if (online) return online;
    }

    return '（找不到翻譯）';
  }

  // ── TTS ─────────────────────────────────────────────────
  function speak(text, langCode) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = langCode === 'zh' ? 'zh-TW' : langCode === 'th' ? 'th-TH' : 'en-US';
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  }

  return { init, translate, speak, detectLang, getLangs: () => LANGUAGES, isOnline: () => _online, getDict: () => _dict };
})();
