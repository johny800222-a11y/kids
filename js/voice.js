/**
 * voice.js — Speech Recognition + Translation (voice tab)
 */

const VoiceModule = (() => {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let srcLang = 'zh';
  let tgtLang = 'en';

  const $ = id => document.getElementById(id);

  function init() {
    if (!SpeechRec) {
      $('mic-status').textContent = '⚠️ 此瀏覽器不支援語音辨識（請用 Chrome 或 iOS Safari）';
      return;
    }
    $('mic-btn').addEventListener('click', toggle);
    $('speak-voice-btn').addEventListener('click', () => {
      Translator.speak($('voice-translated').textContent, tgtLang);
    });
  }

  function setSrcLang(code) { srcLang = code; }
  function setTgtLang(code) { tgtLang = code; }

  function toggle() {
    isListening ? stop() : start();
  }

  function start() {
    recognition = new SpeechRec();
    recognition.lang = srcLang === 'zh' ? 'zh-TW' : srcLang === 'th' ? 'th-TH' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isListening = true;
      $('mic-btn').classList.add('listening');
      $('mic-btn').textContent = '⏹️';
      $('mic-status').textContent = '聆聽中… 說完後點停止';
      showPulse(true);
    };

    recognition.onresult = async (e) => {
      let transcript = '';
      for (const r of e.results) transcript += r[0].transcript;
      $('voice-recognized').textContent = transcript;
      $('voice-recognized-card').classList.remove('hidden');

      if (e.results[e.results.length - 1].isFinal) {
        const result = await Translator.translate(transcript, srcLang, tgtLang);
        $('voice-translated').textContent = result;
        $('voice-result-card').classList.remove('hidden');
        Translator.speak(result, tgtLang);
      }
    };

    recognition.onerror = (e) => {
      $('mic-status').textContent = `錯誤: ${e.error}`;
      stop();
    };

    recognition.onend = () => stop();

    recognition.start();
  }

  function stop() {
    isListening = false;
    if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
    $('mic-btn').classList.remove('listening');
    $('mic-btn').textContent = '🎤';
    $('mic-status').textContent = '點一下開始說話';
    showPulse(false);
  }

  function showPulse(show) {
    const el = $('pulse-rings');
    if (show) {
      el.innerHTML = [0, 1, 2].map(i =>
        `<div class="pulse-ring" style="animation-delay:${i * 0.3}s"></div>`
      ).join('');
    } else {
      el.innerHTML = '';
    }
  }

  return { init, setSrcLang, setTgtLang };
})();


/**
 * ConvModule — Real-time conversation translation
 * Person A (bottom) ↔ Person B (top, flipped)
 */
const ConvModule = (() => {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recA = null, recB = null;
  let isListeningA = false, isListeningB = false;
  const langA = 'zh', langB = 'en';

  const $ = id => document.getElementById(id);

  function init() {
    updateBadge();
    window.addEventListener('online',  updateBadge);
    window.addEventListener('offline', updateBadge);

    $('conv-btn-a').addEventListener('click', () => togglePerson('a'));
    $('conv-btn-b').addEventListener('click', () => togglePerson('b'));
  }

  function updateBadge() {
    const badge = $('conv-status-badge');
    badge.textContent = navigator.onLine ? '🟢 線上模式' : '🔴 需要網路';
  }

  function togglePerson(person) {
    if (person === 'a') {
      if (isListeningA) stopPerson('a');
      else { stopPerson('b'); startPerson('a'); }
    } else {
      if (isListeningB) stopPerson('b');
      else { stopPerson('a'); startPerson('b'); }
    }
  }

  function startPerson(person) {
    if (!SpeechRec) return alert('請使用 Chrome 或 iOS Safari');
    const isA = person === 'a';
    const srcLang = isA ? langA : langB;
    const tgtLang = isA ? langB : langA;
    const btn = $(isA ? 'conv-btn-a' : 'conv-btn-b');
    const bubble = $(isA ? 'conv-bubble-a' : 'conv-bubble-b');

    const rec = new SpeechRec();
    rec.lang = srcLang === 'zh' ? 'zh-TW' : 'en-US';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onstart = () => {
      if (isA) isListeningA = true; else isListeningB = true;
      btn.querySelector('.sb-label').textContent = '說話中… 點我停止';
      btn.style.opacity = '.7';
    };

    rec.onresult = async (e) => {
      const transcript = e.results[0][0].transcript;
      const translated = await Translator.translate(transcript, srcLang, tgtLang);

      bubble.innerHTML = `<p class="orig">${transcript}</p><p class="trans">${translated}</p>`;
      bubble.classList.remove('hidden');
      Translator.speak(translated, tgtLang);
      stopPerson(person);
    };

    rec.onerror = () => stopPerson(person);
    rec.onend   = () => stopPerson(person);
    rec.start();

    if (isA) recA = rec; else recB = rec;
  }

  function stopPerson(person) {
    const isA = person === 'a';
    if (isA) { isListeningA = false; if (recA) { try { recA.stop(); } catch {} recA = null; } }
    else     { isListeningB = false; if (recB) { try { recB.stop(); } catch {} recB = null; } }

    const btn   = document.getElementById(isA ? 'conv-btn-a' : 'conv-btn-b');
    const label = isA ? '中文 — 點我說話' : '英文 — 點我說話';
    btn.querySelector('.sb-label').textContent = label;
    btn.style.opacity = '1';
  }

  return { init };
})();
