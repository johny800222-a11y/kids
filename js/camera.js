/**
 * camera.js — Camera + OCR (Tesseract.js via CDN)
 * Tesseract.js is loaded lazily when user opens camera tab
 */

const CameraModule = (() => {
  let stream   = null;
  let running  = false;
  let tgtLang  = 'en';
  let Tesseract = null;   // loaded lazily

  const $ = id => document.getElementById(id);

  function init() {
    $('camera-toggle-btn').addEventListener('click', toggleCamera);
    $('capture-btn').addEventListener('click', captureAndTranslate);
    $('speak-camera-btn').addEventListener('click', () => {
      Translator.speak($('camera-translated').textContent, tgtLang);
    });
  }

  async function loadTesseract() {
    if (window.Tesseract) { Tesseract = window.Tesseract; return; }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    Tesseract = window.Tesseract;
  }

  async function toggleCamera() {
    if (running) {
      stopCamera();
    } else {
      await startCamera();
    }
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const video = $('camera-video');
      video.srcObject = stream;
      $('camera-placeholder').classList.add('hidden');
      running = true;
      $('camera-toggle-btn').textContent = '關閉相機';
      $('camera-toggle-btn').classList.replace('mint', 'coral');
      $('capture-btn').disabled = false;
    } catch (e) {
      alert('無法開啟相機：' + e.message);
    }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const video = $('camera-video');
    video.srcObject = null;
    $('camera-placeholder').classList.remove('hidden');
    running = false;
    $('camera-toggle-btn').textContent = '開啟相機';
    $('camera-toggle-btn').classList.replace('coral', 'mint');
    $('capture-btn').disabled = true;
  }

  async function captureAndTranslate() {
    const video  = $('camera-video');
    const canvas = $('camera-canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);

    $('capture-btn').disabled = true;
    $('capture-btn').textContent = '辨識中…';

    try {
      await loadTesseract();

      // Run OCR with Chinese + English
      const result = await Tesseract.recognize(canvas, 'chi_tra+chi_sim+eng', {
        logger: () => {}
      });
      const detected = result.data.text.trim().replace(/\n+/g, ' ');
      if (!detected) {
        $('capture-btn').textContent = '📸 擷取翻譯';
        $('capture-btn').disabled = false;
        alert('未偵測到文字，請靠近文字後再試');
        return;
      }

      $('camera-detected').textContent = detected;
      const srcLang = Translator.detectLang(detected);
      const translated = await Translator.translate(detected, srcLang, tgtLang);
      $('camera-translated').textContent = translated;
      $('camera-result-card').classList.remove('hidden');
    } catch (e) {
      alert('OCR 失敗：' + e.message);
    } finally {
      $('capture-btn').textContent = '📸 擷取翻譯';
      $('capture-btn').disabled = false;
    }
  }

  function setTgtLang(code) { tgtLang = code; }

  return { init, stopCamera, setTgtLang };
})();
