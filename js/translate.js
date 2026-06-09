/**
 * translate.js — Translation Service
 * Offline: local JSON dictionary (with sentence-level tokenization)
 * Online: LibreTranslate public API
 */

const LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇹🇼' },
  { code: 'en', name: '英文', flag: '🇺🇸' },
  { code: 'th', name: '泰文', flag: '🇹🇭' },
];

const Translator = (() => {
  let _dict   = null;
  let _online = false;
  let _enMap  = null;   // en (lowercase) → zh
  let _zhMap  = null;   // zh base        → en base

  // ── Load offline dictionary ─────────────────────────────
  async function init() {
    try {
      const res = await fetch('data/words_zh_en.json');
      _dict = await res.json();
      console.log(`✅ Dictionary loaded: ${_dict.length} words`);
    } catch (e) {
      console.warn('Dictionary not loaded', e);
      _dict = [];
    }

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

  // ── Build en→zh map (lazy) ──────────────────────────────
  // Handles slash variants "be/am/is/are" and parentheticals "eye(s)"
  function getEnMap() {
    if (_enMap) return _enMap;
    _enMap = new Map();
    (_dict || []).forEach(w => {
      if (!w.en || !w.zh) return;
      const en = w.en.toLowerCase();
      if (!_enMap.has(en)) _enMap.set(en, w.zh);
      // slash variants: "be/am/is/are" → also "be", "am", "is", "are"
      en.split('/').forEach(part => {
        const p = part.trim();
        if (p && !_enMap.has(p)) _enMap.set(p, w.zh);
      });
      // parenthetical: "eye(s)" → also "eye"
      const bare = en.replace(/\(.*?\)/g, '').trim();
      if (bare && !_enMap.has(bare)) _enMap.set(bare, w.zh);
    });
    return _enMap;
  }

  // ── Build zh→en map (lazy) ──────────────────────────────
  // Extracts pure Chinese base from entries like "在…地點；在…時刻" → "在"
  function getZhMap() {
    if (_zhMap) return _zhMap;
    _zhMap = new Map();
    (_dict || []).forEach(w => {
      if (!w.zh || !w.en) return;
      const enBase = w.en.split('/')[0].split('(')[0].trim().toLowerCase();
      // Full zh value
      if (!_zhMap.has(w.zh)) _zhMap.set(w.zh, enBase);
      // Each ；-separated segment, stripped of "…X" descriptors and non-CJK chars
      w.zh.split('；').forEach(part => {
        const base = part
          .replace(/…\S*/g, '')                       // remove "…地點" style suffixes
          .replace(/[（()）a-zA-Z0-9 .,!?、：: ]/g, '') // remove ASCII / punctuation
          .trim();
        if (base && !_zhMap.has(base)) _zhMap.set(base, enBase);
      });
    });
    return _zhMap;
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
    const q    = text.trim();
    const qLow = q.toLowerCase();

    // ── English → Chinese ──────────────────────────────
    if (srcLang === 'en' && tgtLang === 'zh') {
      const map = getEnMap();

      // Exact match
      if (map.has(qLow)) return map.get(qLow);

      // Sentence: translate word-by-word and join
      const tokens = qLow.split(/\s+/);
      if (tokens.length > 1) {
        const parts = tokens.map(t => {
          const clean = t.replace(/[^a-z]/g, '');
          return map.get(clean) || clean;   // keep original if not found
        }).filter(Boolean);
        return parts.join('');
      }

      // Single-word prefix fallback
      const hit = _dict.find(w => w.en.toLowerCase().startsWith(qLow));
      return hit ? hit.zh : null;
    }

    // ── Chinese → English ──────────────────────────────
    if (srcLang === 'zh' && tgtLang === 'en') {
      const map = getZhMap();

      // Exact match
      if (map.has(q)) return map.get(q);

      // Greedy longest-match segmentation (max look-ahead: 6 chars)
      const result = [];
      let i = 0;
      while (i < q.length) {
        let matched = false;
        for (let len = Math.min(q.length - i, 6); len >= 1; len--) {
          const chunk = q.slice(i, i + len);
          if (map.has(chunk)) {
            result.push(map.get(chunk));
            i += len;
            matched = true;
            break;
          }
        }
        if (!matched) i++; // skip unmatched punctuation / particle
      }
      if (result.length > 0) return result.join(' ');
      return null;
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

    // 1. Try offline dictionary first
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
