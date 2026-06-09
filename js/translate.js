/**
 * translate.js — Translation Service
 * Offline:  local JSON dictionary (single words, instant)
 * Online:   MyMemory API — free, no key, sentence-aware
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
  function getEnMap() {
    if (_enMap) return _enMap;
    _enMap = new Map();
    (_dict || []).forEach(w => {
      if (!w.en || !w.zh) return;
      const en = w.en.toLowerCase();
      if (!_enMap.has(en)) _enMap.set(en, w.zh);
      // slash variants: "be/am/is/are"
      en.split('/').forEach(part => {
        const p = part.trim();
        if (p && !_enMap.has(p)) _enMap.set(p, w.zh);
      });
      // parenthetical: "eye(s)" → "eye"
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
      if (!_zhMap.has(w.zh)) _zhMap.set(w.zh, enBase);
      w.zh.split('；').forEach(part => {
        const base = part
          .replace(/…\S*/g, '')
          .replace(/[（()）a-zA-Z0-9 .,!?、：: ]/g, '')
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

  // ── Offline lookup (single words / short phrases) ───────
  function lookupOffline(text, srcLang, tgtLang) {
    if (!_dict) return null;
    const q    = text.trim();
    const qLow = q.toLowerCase();

    if (srcLang === 'en' && tgtLang === 'zh') {
      const map = getEnMap();
      if (map.has(qLow)) return map.get(qLow);

      // word-by-word for short multi-word input
      const tokens = qLow.split(/\s+/);
      if (tokens.length > 1) {
        const parts = tokens.map(t => {
          const clean = t.replace(/[^a-z]/g, '');
          return map.get(clean) || clean;
        }).filter(Boolean);
        return parts.join('');
      }

      // prefix fallback
      const hit = _dict.find(w => w.en.toLowerCase().startsWith(qLow));
      return hit ? hit.zh : null;
    }

    if (srcLang === 'zh' && tgtLang === 'en') {
      const map = getZhMap();
      if (map.has(q)) return map.get(q);

      // greedy longest-match segmentation
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
        if (!matched) i++;
      }
      if (result.length > 0) return result.join(' ');
      return null;
    }

    return null;
  }

  // ── Online: MyMemory API (free, no key needed) ──────────
  // Handles full sentence grammar properly
  async function translateOnline(text, srcLang, tgtLang) {
    // MyMemory uses zh-CN/en/th style codes
    const codeMap = { zh: 'zh-CN', en: 'en', th: 'th' };
    const src = codeMap[srcLang] || srcLang;
    const tgt = codeMap[tgtLang] || tgtLang;
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const result = data.responseData?.translatedText;
      // MyMemory returns "QUERY LENGTH LIMIT..." on abuse — treat as failure
      if (result && !result.startsWith('QUERY LENGTH')) return result;
      return null;
    } catch { return null; }
  }

  // ── Main translate ──────────────────────────────────────
  // Strategy:
  //   Sentences (>4 chars / has spaces): online first → offline fallback
  //   Single words:                      offline first → online fallback
  async function translate(text, srcLang, tgtLang) {
    if (!text.trim()) return '';
    if (srcLang === tgtLang) return text;

    const isSentence = text.trim().includes(' ') || text.trim().replace(/\s/g,'').length > 4;

    if (isSentence && _online) {
      // Online gives correct grammar for sentences
      const online = await translateOnline(text, srcLang, tgtLang);
      if (online) return online;
    }

    // Offline dictionary (instant, works without internet)
    const offline = lookupOffline(text, srcLang, tgtLang);
    if (offline) return offline;

    // Single-word online fallback
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
