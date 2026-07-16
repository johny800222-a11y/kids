/**
 * quiz.js — Fill-in-the-blank word quiz
 * 10 questions per round, 4 difficulty levels
 */

const QuizModule = (() => {
  const LEVELS = [
    { id: 1, name: '初級', emoji: '🌱', desc: '基礎單字',
      cats: new Set(['基礎', '身體', '數字', '動物', 'family']) },
    { id: 2, name: '中級', emoji: '🌿', desc: '生活單字',
      cats: new Set(['時間', '家庭', '食物', '學校', '人物', '自然']) },
    { id: 3, name: '高級', emoji: '🌳', desc: '進階單字',
      cats: new Set(['運動', '情感', '地方', '職業', '方向', '交通', '節慶']) },
    { id: 4, name: '挑戰', emoji: '🔥', desc: '高頻 5000',
      cats: new Set(['高頻5000']) }
  ];

  const Q_PER_ROUND = 10;
  let questions    = [];
  let current      = 0;
  let score        = 0;
  let currentLevel = null;
  let answered     = false;
  let bestScores   = JSON.parse(localStorage.getItem('kt_quiz_best') || '{}');

  const $ = id => document.getElementById(id);

  // ── Init ────────────────────────────────────────────────
  async function init() {
    let tries = 0;
    while (!Translator.getDict() && tries < 20) {
      await new Promise(r => setTimeout(r, 200));
      tries++;
    }
    buildLevelList();
    bindEvents();
  }

  // ── Level selection UI ───────────────────────────────────
  function buildLevelList() {
    const dict = Translator.getDict() || [];
    $('level-list').innerHTML = LEVELS.map(lv => {
      const count = dict.filter(w => lv.cats.has(w.cat)).length;
      const best  = bestScores[lv.id] || 0;
      return `
        <div class="level-card" onclick="QuizModule.startLevel(${lv.id})">
          <span class="level-emoji">${lv.emoji}</span>
          <div class="level-info">
            <div class="level-name">${lv.name}</div>
            <div class="level-desc">${lv.desc}（${count} 字）</div>
          </div>
          <div class="level-best">${best ? `最高 ${best}/10 ⭐` : '未挑戰'}</div>
        </div>`;
    }).join('');
  }

  // ── Start level ──────────────────────────────────────────
  function startLevel(levelId) {
    const lv = LEVELS.find(l => l.id === levelId);
    if (!lv) return;
    currentLevel = lv;

    const dict = Translator.getDict() || [];
    const pool = dict.filter(w =>
      lv.cats.has(w.cat) && w.en && w.zh &&
      w.en.length >= 3 &&
      !/[\s/().]/.test(w.en)
    );

    const shuffled = pool.sort(() => Math.random() - 0.5);
    questions = shuffled.slice(0, Q_PER_ROUND).map(w => ({
      word: w, ...makeBlank(w.en)
    }));

    current  = 0;
    score    = 0;
    answered = false;

    showScreen('play');
    renderQuestion();
  }

  // ── Make fill-in-the-blank ───────────────────────────────
  function makeBlank(word) {
    const len = word.length;
    const hideCount = len <= 4 ? 1 : len <= 6 ? 2 : 3;
    const maxStart = len - hideCount - 1;
    const startPos = Math.max(1, Math.floor(Math.random() * maxStart) + 1);
    return {
      before:    word.slice(0, startPos),
      hidden:    word.slice(startPos, startPos + hideCount),
      after:     word.slice(startPos + hideCount),
      hideCount,
      display:   word.slice(0, startPos) + '_'.repeat(hideCount) + word.slice(startPos + hideCount)
    };
  }

  // ── Render question ──────────────────────────────────────
  function renderQuestion() {
    const q = questions[current];
    answered = false;

    $('quiz-q-num').textContent           = current + 1;
    $('quiz-score-live').textContent      = `✅ ${score}`;
    $('quiz-progress-fill').style.width   = `${(current / Q_PER_ROUND) * 100}%`;
    $('quiz-zh').textContent              = q.word.zh;

    renderBlankBoxes(q);

    const inp = $('quiz-input');
    inp.value       = '';
    inp.placeholder = `輸入 ${q.hideCount} 個字母`;
    inp.className   = 'quiz-input';
    inp.disabled    = false;
    inp.focus();

    $('quiz-feedback').classList.add('hidden');
    $('quiz-submit-btn').classList.remove('hidden');
    $('quiz-next-btn').classList.add('hidden');
  }

  function renderBlankBoxes(q) {
    const box = $('quiz-blank-display');
    let html = '';
    for (const ch of q.before)
      html += `<span class="lb lb-filled">${ch}</span>`;
    for (let i = 0; i < q.hideCount; i++)
      html += `<span class="lb lb-blank" id="qb-${i}">_</span>`;
    for (const ch of q.after)
      html += `<span class="lb lb-filled">${ch}</span>`;
    box.innerHTML = html;
  }

  // ── Submit answer ────────────────────────────────────────
  function submitAnswer() {
    if (answered) return;
    const q      = questions[current];
    const input  = $('quiz-input').value.trim().toLowerCase();
    const correct = q.hidden.toLowerCase();
    const isCorrect = input === correct;

    answered = true;
    if (isCorrect) score++;

    $('quiz-input').disabled = true;
    $('quiz-submit-btn').classList.add('hidden');
    $('quiz-next-btn').classList.remove('hidden');

    for (let i = 0; i < q.hideCount; i++) {
      const el = document.getElementById(`qb-${i}`);
      if (el) {
        el.textContent = q.hidden[i];
        el.className   = `lb lb-blank ${isCorrect ? 'lb-ok' : 'lb-err'}`;
      }
    }

    const fb = $('quiz-feedback');
    fb.classList.remove('hidden');
    $('quiz-fb-icon').textContent = isCorrect ? '✅' : '❌';
    $('quiz-fb-text').textContent = isCorrect ? `正確！${q.word.en}` : `答案：${q.word.en}`;
    $('quiz-score-live').textContent = `✅ ${score}`;

    q.userAnswer = input;
    q.isCorrect  = isCorrect;

    Translator.speak(q.word.en, 'en');
  }

  // ── Next / finish ────────────────────────────────────────
  function nextQuestion() {
    current++;
    if (current >= Q_PER_ROUND) showResult();
    else renderQuestion();
  }

  // ── Result screen ────────────────────────────────────────
  function showResult() {
    $('quiz-progress-fill').style.width = '100%';

    if (!bestScores[currentLevel.id] || score > bestScores[currentLevel.id]) {
      bestScores[currentLevel.id] = score;
      localStorage.setItem('kt_quiz_best', JSON.stringify(bestScores));
    }

    const pct   = score / Q_PER_ROUND;
    const cases = [
      [1.0,  '🏆', '完美！全對！'],
      [0.8,  '🎉', '太棒了！'],
      [0.6,  '👍', '不錯喔！繼續加油'],
      [0.4,  '😊', '繼續練習！'],
      [-1,   '💪', '多練習幾次加油！']
    ];
    const [, emoji, title] = cases.find(([t]) => pct >= t);

    $('quiz-res-emoji').textContent = emoji;
    $('quiz-res-title').textContent = title;
    $('quiz-res-score').textContent = score;

    $('quiz-res-list').innerHTML = questions.map((q, i) => `
      <div class="res-row ${q.isCorrect ? 'res-ok' : 'res-err'}">
        <span>${i + 1}.</span>
        <span>${q.word.zh}</span>
        <span class="res-en">${q.word.en}</span>
        <button class="icon-btn res-speak" data-word="${q.word.en}" title="朗讀英文">🔊</button>
        <span>${q.isCorrect ? '✅' : '❌'}</span>
      </div>`).join('');

    // Speak buttons in result list
    $('quiz-res-list').addEventListener('click', e => {
      const btn = e.target.closest('.res-speak');
      if (btn) Translator.speak(btn.dataset.word, 'en');
    });

    showScreen('result');
  }

  // ── Screen switching ─────────────────────────────────────
  function showScreen(name) {
    ['level', 'play', 'result'].forEach(s => {
      $(`quiz-${s}`).classList.toggle('hidden', s !== name);
    });
  }

  // ── Events ───────────────────────────────────────────────
  function bindEvents() {
    $('quiz-back-btn').addEventListener('click', () => showScreen('level'));

    $('quiz-speak-zh').addEventListener('click', () => {
      const q = questions[current];
      if (q) Translator.speak(q.word.zh, 'zh');
    });
    $('quiz-speak-en').addEventListener('click', () => {
      const q = questions[current];
      if (q) Translator.speak(q.word.en, 'en');
    });
    $('quiz-hint-en').addEventListener('click', () => {
      const q = questions[current];
      if (q) Translator.speak(q.word.en, 'en');
    });

    $('quiz-submit-btn').addEventListener('click', submitAnswer);
    $('quiz-next-btn').addEventListener('click', nextQuestion);
    $('quiz-retry-btn').addEventListener('click', () => startLevel(currentLevel.id));
    $('quiz-new-level-btn').addEventListener('click', () => {
      buildLevelList();
      showScreen('level');
    });

    $('quiz-input').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (!answered) submitAnswer();
      else nextQuestion();
    });

    $('quiz-input').addEventListener('input', () => {
      if (answered) return;
      const val = $('quiz-input').value;
      const q   = questions[current];
      if (!q) return;
      for (let i = 0; i < q.hideCount; i++) {
        const el = document.getElementById(`qb-${i}`);
        if (el) el.textContent = val[i] || '_';
      }
    });
  }

  return { init, startLevel };
})();
