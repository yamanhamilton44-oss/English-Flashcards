// ========== State ==========
const STATE_KEY = 'englishmaster_state';
let state = loadState();
let allWords = [];
let flatWords = []; // [{ word, levelIndex, globalIdx }]
let currentView = 'home';
let fcIndex = 0;
let fcList = [];
let fcFlipped = false;
let reviewQueue = [];
let reviewIndex = 0;
let reviewCorrect = 0;
let reviewWrong = 0;

function defaultState() {
  return {
    settings: { dark: true, tts: true, ttsRate: 1.0 },
    progress: {},  // globalIdx -> { fav, diff, reviewed, correct, wrong, lastReview }
    stats: { totalReviews: 0, correct: 0, wrong: 0, bestStreak: 0, daily: {} },
    achievements: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Merge with defaults for any missing keys
      const def = defaultState();
      return { ...def, ...s, settings: { ...def.settings, ...s.settings }, stats: { ...def.stats, ...s.stats } };
    }
  } catch (e) { /* ignore */ }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ========== Data Init ==========
function initData() {
  flatWords = [];
  WORD_DATABASE.forEach((level, li) => {
    level.words.forEach((w, wi) => {
      flatWords.push({ word: w, levelIndex: li, globalIdx: flatWords.length });
    });
  });
  allWords = WORD_DATABASE;
  populateLevelTabs();
  populateFlashcardLevelSelect();
  populateReviewLevelSelect();
  updateHomeStats();
  updateWordList();
  updateFlashcardView();
  updateAchievements();
  updateStatsView();
  updateReviewSetup();
}

// ========== Navigation ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'home') updateHomeStats();
  if (view === 'dictionary') updateWordList();
  if (view === 'flashcard') updateFlashcardView();
  if (view === 'stats') updateStatsView();
  if (view === 'achievements') updateAchievements();
}

// ========== Toast ==========
function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ========== Confetti ==========
function fireConfetti() {
  const colors = ['#6c63ff', '#ff6b9d', '#00d4aa', '#ffa726', '#f1c40f', '#e74c3c'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (Math.random() * 8 + 4) + 'px';
    el.style.height = (Math.random() * 8 + 4) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.animationDuration = (Math.random() * 2 + 2) + 's';
    el.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ========== TTS ==========
function speak(text, callback) {
  if (!state.settings.tts) { if (callback) callback(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = state.settings.ttsRate;
  u.onend = () => { if (callback) callback(); };
  window.speechSynthesis.speak(u);
}

// ========== Progress Helpers ==========
function getProg(idx) {
  if (!state.progress[idx]) state.progress[idx] = { fav: false, diff: false, reviewed: 0, correct: 0, wrong: 0, lastReview: 0 };
  return state.progress[idx];
}

function getWord(idx) { return flatWords[idx]; }

function getLevelColor(li) { return allWords[li] ? allWords[li].color : '#6c63ff'; }
function getLevelName(li) { return allWords[li] ? allWords[li].name : ''; }
function getLevelBadge(li) { return allWords[li] ? allWords[li].name.split(' ')[0] : ''; }

// ========== PART OF SPEECH ==========
const POS_TR = {
  noun: 'isim', verb: 'fiil', adjective: 'sıfat', adverb: 'zarf',
  preposition: 'edat', conjunction: 'bağlaç', interjection: 'ünlem',
  pronoun: 'zamir', phrase: 'ifade'
};

// ========== HOME ==========
function updateHomeStats() {
  const total = flatWords.length;
  const learned = Object.values(state.progress).filter(p => p.reviewed > 0).length;
  const favCount = Object.values(state.progress).filter(p => p.fav).length;
  document.getElementById('stat-total-words').textContent = total;
  document.getElementById('stat-learned').textContent = learned;
  document.getElementById('stat-favorites').textContent = favCount;
  document.getElementById('stat-streak').textContent = state.stats.bestStreak;
  document.getElementById('streak-count').textContent = state.stats.bestStreak;

  // Word of day
  const idx = Math.floor(Math.random() * flatWords.length);
  const w = flatWords[idx];
  document.getElementById('wod-english').textContent = w.word.english;
  document.getElementById('wod-turkish').textContent = w.word.turkish;
  document.getElementById('wod-speak').onclick = () => speak(w.word.english);
}

// ========== DICTIONARY ==========
let dictFilter = { level: 'all', search: '', fav: false, diff: false, learned: false, pos: 'all' };

function populateLevelTabs() {
  const container = document.getElementById('level-tabs');
  let html = '<button class="level-tab active" data-level="all">Tümü</button>';
  allWords.forEach((l, i) => {
    html += `<button class="level-tab" data-level="${i}" style="border-color:${l.color}">${l.name.split(' - ')[0]}</button>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.level-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      dictFilter.level = tab.dataset.level;
      updateWordList();
    });
  });
}

function updateWordList() {
  const container = document.getElementById('word-list');
  let words = flatWords;
  if (dictFilter.level !== 'all') words = words.filter(w => w.levelIndex === parseInt(dictFilter.level));
  if (dictFilter.search) {
    const q = dictFilter.search.toLowerCase();
    words = words.filter(w => w.word.english.toLowerCase().includes(q) || w.word.turkish.toLowerCase().includes(q));
  }
  if (dictFilter.fav) words = words.filter(w => getProg(w.globalIdx).fav);
  if (dictFilter.diff) words = words.filter(w => getProg(w.globalIdx).diff);
  if (dictFilter.learned) words = words.filter(w => getProg(w.globalIdx).reviewed > 0);
  if (dictFilter.pos !== 'all') words = words.filter(w => w.word.partOfSpeech === dictFilter.pos);

  if (words.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted)">Kelime bulunamadı</p>';
    return;
  }
  let html = '';
  words.forEach(w => {
    const p = getProg(w.globalIdx);
    html += `
      <div class="word-item" data-idx="${w.globalIdx}">
        <span class="word-level-badge" style="background:${getLevelColor(w.levelIndex)}">${getLevelBadge(w.levelIndex)}</span>
        <span class="word-english">${w.word.english}</span>
        <span class="word-turkish">${w.word.turkish}</span>
        <span class="word-pos">${POS_TR[w.word.partOfSpeech] || w.word.partOfSpeech}</span>
        <div class="word-actions">
          <button class="${p.fav ? 'fav-active' : ''}" data-action="fav" title="Favori"><i class="${p.fav ? 'fas' : 'far'} fa-star"></i></button>
          <button class="${p.diff ? 'diff-active' : ''}" data-action="diff" title="Zor"><i class="fas fa-exclamation-triangle"></i></button>
          <button data-action="play" title="Dinle"><i class="fas fa-volume-up"></i></button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.word-item').forEach(item => {
    const idx = parseInt(item.dataset.idx);
    item.querySelector('[data-action="fav"]').addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(idx);
      updateWordList();
    });
    item.querySelector('[data-action="diff"]').addEventListener('click', e => {
      e.stopPropagation();
      toggleDiff(idx);
      updateWordList();
    });
    item.querySelector('[data-action="play"]').addEventListener('click', e => {
      e.stopPropagation();
      speak(flatWords[idx].word.english);
    });
    item.addEventListener('click', () => {
      openFlashcard(idx);
    });
  });
}

// Search input
document.getElementById('search-input').addEventListener('input', e => {
  dictFilter.search = e.target.value;
  updateWordList();
});
document.getElementById('filter-favorites').addEventListener('change', e => {
  dictFilter.fav = e.target.checked;
  updateWordList();
});
document.getElementById('filter-difficult').addEventListener('change', e => {
  dictFilter.diff = e.target.checked;
  updateWordList();
});
document.getElementById('filter-learned').addEventListener('change', e => {
  dictFilter.learned = e.target.checked;
  updateWordList();
});
document.getElementById('filter-pos').addEventListener('change', e => {
  dictFilter.pos = e.target.value;
  updateWordList();
});

// ========== FLASHCARD ==========
function populateFlashcardLevelSelect() {
  const sel = document.getElementById('fc-level-select');
  let html = '<option value="all">Tüm Seviyeler</option>';
  allWords.forEach((l, i) => {
    html += `<option value="${i}">${l.name}</option>`;
  });
  sel.innerHTML = html;
  sel.addEventListener('change', () => buildFcList());
}

function buildFcList() {
  const level = document.getElementById('fc-level-select').value;
  const onlyFav = document.getElementById('fc-only-favorites').checked;
  const onlyDiff = document.getElementById('fc-only-difficult').checked;
  let words = [...flatWords];
  if (level !== 'all') words = words.filter(w => w.levelIndex === parseInt(level));
  if (onlyFav) words = words.filter(w => getProg(w.globalIdx).fav);
  if (onlyDiff) words = words.filter(w => getProg(w.globalIdx).diff);
  fcList = words;
  fcIndex = 0;
  fcFlipped = false;
  updateFlashcardView();
}

document.getElementById('fc-only-favorites').addEventListener('change', buildFcList);
document.getElementById('fc-only-difficult').addEventListener('change', buildFcList);

function openFlashcard(idx) {
  switchView('flashcard');
  fcList = flatWords.filter(w => w.globalIdx === idx);
  fcIndex = 0;
  buildFcList(); // rebuild to include filter context if coming from dictionary
  // Re-set to the specific word
  fcList = [flatWords[idx]];
  fcIndex = 0;
  fcFlipped = false;
  updateFlashcardView();
}

function updateFlashcardView() {
  if (fcList.length === 0) {
    document.getElementById('fc-english').textContent = 'Kart yok';
    document.getElementById('fc-turkish').textContent = 'Filtrelere uygun kelime bulunamadı';
    document.getElementById('fc-phonetics').textContent = '';
    document.getElementById('fc-example').textContent = '';
    document.getElementById('fc-example-tr').textContent = '';
    document.getElementById('fc-pos').textContent = '';
    document.getElementById('fc-index').textContent = '0 / 0';
    document.getElementById('fc-index-back').textContent = '0 / 0';
    document.getElementById('fc-level').textContent = '';
    document.getElementById('fc-level-back').textContent = '';
    document.getElementById('fc-progress-fill').style.width = '0%';
    return;
  }
  const item = fcList[fcIndex];
  const w = item.word;
  const p = getProg(item.globalIdx);
  document.getElementById('fc-english').textContent = w.english;
  document.getElementById('fc-turkish').textContent = w.turkish;
  document.getElementById('fc-phonetics').textContent = w.phonetics || '';
  document.getElementById('fc-example').textContent = '"' + (w.example || '') + '"';
  document.getElementById('fc-example-tr').textContent = '"' + (w.exampleTurkish || '') + '"';
  document.getElementById('fc-pos').textContent = POS_TR[w.partOfSpeech] || w.partOfSpeech;
  document.getElementById('fc-index').textContent = (fcIndex + 1) + ' / ' + fcList.length;
  document.getElementById('fc-index-back').textContent = (fcIndex + 1) + ' / ' + fcList.length;
  const badge = getLevelBadge(item.levelIndex);
  document.getElementById('fc-level').textContent = badge;
  document.getElementById('fc-level-back').textContent = badge;
  document.getElementById('fc-level').style.background = getLevelColor(item.levelIndex);
  document.getElementById('fc-level-back').style.background = getLevelColor(item.levelIndex);
  document.getElementById('fc-progress-fill').style.width = ((fcIndex + 1) / fcList.length * 100) + '%';
  document.getElementById('card-inner').classList.toggle('flipped', fcFlipped);
  // Update fav/diff buttons
  const favBtn = document.getElementById('fc-fav');
  favBtn.innerHTML = p.fav ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  favBtn.style.color = p.fav ? '#f1c40f' : '';
  const diffBtn = document.getElementById('fc-diff');
  diffBtn.style.color = p.diff ? '#e74c3c' : '';
}

// Flashcard controls
document.getElementById('flashcard').addEventListener('click', () => {
  fcFlipped = !fcFlipped;
  document.getElementById('card-inner').classList.toggle('flipped', fcFlipped);
});

document.getElementById('fc-flip').addEventListener('click', () => {
  fcFlipped = !fcFlipped;
  document.getElementById('card-inner').classList.toggle('flipped', fcFlipped);
});

document.getElementById('fc-prev').addEventListener('click', () => {
  if (fcIndex > 0) { fcIndex--; fcFlipped = false; updateFlashcardView(); }
});

document.getElementById('fc-next').addEventListener('click', () => {
  if (fcIndex < fcList.length - 1) { fcIndex++; fcFlipped = false; updateFlashcardView(); }
});

document.getElementById('fc-fav').addEventListener('click', () => {
  if (fcList.length === 0) return;
  toggleFav(fcList[fcIndex].globalIdx);
  updateFlashcardView();
});

document.getElementById('fc-diff').addEventListener('click', () => {
  if (fcList.length === 0) return;
  toggleDiff(fcList[fcIndex].globalIdx);
  updateFlashcardView();
});

document.getElementById('fc-speak').addEventListener('click', () => {
  if (fcList.length === 0) return;
  speak(fcList[fcIndex].word.english);
});

document.getElementById('fc-shuffle').addEventListener('click', () => {
  fcList = fcList.sort(() => Math.random() - 0.5);
  fcIndex = 0;
  fcFlipped = false;
  updateFlashcardView();
});

function toggleFav(idx) {
  const p = getProg(idx);
  p.fav = !p.fav;
  saveState();
}

function toggleDiff(idx) {
  const p = getProg(idx);
  p.diff = !p.diff;
  saveState();
}

// ========== REVIEW ==========
function populateReviewLevelSelect() {
  const sel = document.getElementById('review-level');
  let html = '<option value="all">Tüm Seviyeler</option>';
  allWords.forEach((l, i) => {
    html += `<option value="${i}">${l.name}</option>`;
  });
  sel.innerHTML = html;
}

document.getElementById('review-start').addEventListener('click', startReview);

document.getElementById('review-card').addEventListener('click', () => {
  document.getElementById('review-card-inner').classList.toggle('flipped');
});

function startReview() {
  const level = document.getElementById('review-level').value;
  const count = parseInt(document.getElementById('review-count').value) || 20;
  const onlyDiff = document.getElementById('review-only-difficult').checked;
  let words = flatWords.filter(w => getProg(w.globalIdx).diff || getProg(w.globalIdx).reviewed > 0);
  if (onlyDiff) words = words.filter(w => getProg(w.globalIdx).diff);
  if (level !== 'all') words = words.filter(w => w.levelIndex === parseInt(level));
  if (words.length === 0) {
    showToast('Tekrar için uygun kelime bulunamadı');
    return;
  }
  words = words.sort(() => Math.random() - 0.5).slice(0, Math.min(count, words.length));
  reviewQueue = words;
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewWrong = 0;
  document.getElementById('review-setup').classList.add('hidden');
  document.getElementById('review-active').classList.remove('hidden');
  document.getElementById('review-complete').classList.add('hidden');
  updateReviewCard();
}

function updateReviewCard() {
  if (reviewIndex >= reviewQueue.length) {
    finishReview();
    return;
  }
  const item = reviewQueue[reviewIndex];
  const w = item.word;
  document.getElementById('rev-english').textContent = w.english;
  document.getElementById('rev-turkish').textContent = w.turkish;
  document.getElementById('rev-example').textContent = '"' + (w.example || '') + '"';
  document.getElementById('review-card-inner').classList.remove('flipped');
  document.getElementById('rev-progress').textContent = (reviewIndex + 1) + ' / ' + reviewQueue.length;
  document.getElementById('rev-progress-fill').style.width = ((reviewIndex + 1) / reviewQueue.length * 100) + '%';
  speak(w.english);
}

document.getElementById('rev-hard').addEventListener('click', () => recordReview(false));
document.getElementById('rev-good').addEventListener('click', () => recordReview(true));
document.getElementById('rev-easy').addEventListener('click', () => recordReview(true));
document.getElementById('rev-again').addEventListener('click', () => {
  document.getElementById('review-setup').classList.remove('hidden');
  document.getElementById('review-active').classList.add('hidden');
  document.getElementById('review-complete').classList.add('hidden');
});

function recordReview(correct) {
  if (reviewIndex >= reviewQueue.length) return;
  const item = reviewQueue[reviewIndex];
  const p = getProg(item.globalIdx);
  p.reviewed++;
  if (correct) { p.correct++; reviewCorrect++; } else { p.wrong++; reviewWrong++; }
  p.lastReview = Date.now();
  state.stats.totalReviews++;
  state.stats.correct += correct ? 1 : 0;
  state.stats.wrong += correct ? 0 : 1;
  // Track daily
  const today = new Date().toISOString().split('T')[0];
  if (!state.stats.daily[today]) state.stats.daily[today] = { correct: 0, wrong: 0, total: 0 };
  state.stats.daily[today].total++;
  state.stats.daily[today].correct += correct ? 1 : 0;
  state.stats.daily[today].wrong += correct ? 0 : 1;
  saveState();
  reviewIndex++;
  updateReviewCard();
}

function finishReview() {
  document.getElementById('review-active').classList.add('hidden');
  document.getElementById('review-complete').classList.remove('hidden');
  document.getElementById('rev-result-correct').textContent = reviewCorrect;
  document.getElementById('rev-result-wrong').textContent = reviewWrong;
  updateStreak();
  checkAchievements();
  if (reviewCorrect > 0) fireConfetti();
  showToast('Tekrar tamamlandı! ' + reviewCorrect + ' doğru, ' + reviewWrong + ' yanlış');
}

function updateStreak() {
  // Simple streak: count consecutive days with reviews
  const days = Object.keys(state.stats.daily).sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let check = new Date(today);
  for (const day of days) {
    const d = new Date(day);
    const diff = Math.round((check - d) / (1000 * 60 * 60 * 24));
    if (diff === streak) {
      if (state.stats.daily[day].total > 0) streak++;
      else break;
    } else if (diff > streak) break;
  }
  state.stats.bestStreak = Math.max(state.stats.bestStreak, streak);
  saveState();
}

// ========== STATS ==========
function updateStatsView() {
  document.getElementById('s-total-reviews').textContent = state.stats.totalReviews;
  document.getElementById('s-correct').textContent = state.stats.correct;
  document.getElementById('s-wrong').textContent = state.stats.wrong;
  const total = state.stats.correct + state.stats.wrong;
  document.getElementById('s-accuracy').textContent = total > 0 ? '%' + Math.round(state.stats.correct / total * 100) : '%0';
  document.getElementById('s-best-streak').textContent = state.stats.bestStreak;

  // Level distribution
  const distContainer = document.getElementById('level-distribution');
  distContainer.innerHTML = '';
  allWords.forEach((l, li) => {
    const words = flatWords.filter(w => w.levelIndex === li);
    const reviewed = words.filter(w => getProg(w.globalIdx).reviewed > 0).length;
    const pct = words.length > 0 ? Math.round(reviewed / words.length * 100) : 0;
    distContainer.innerHTML += `
      <div class="level-dist-item">
        <span style="font-size:12px;width:30px">${l.name.split(' ')[0]}</span>
        <div class="level-dist-bar"><div class="level-dist-fill" style="width:${pct}%;background:${l.color}"></div></div>
        <span style="font-size:12px;min-width:40px;text-align:right">${reviewed}/${words.length}</span>
      </div>`;
  });

  // Weekly chart (simple text)
  const weeklyContainer = document.getElementById('weekly-chart');
  const today = new Date().toISOString().split('T')[0];
  let weeklyHtml = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayData = state.stats.daily[key] || { total: 0, correct: 0 };
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    weeklyHtml += `
      <div class="level-dist-item">
        <span style="font-size:11px;width:30px">${days[d.getDay()]}</span>
        <div class="level-dist-bar"><div class="level-dist-fill" style="width:${Math.min(100, dayData.total * 5)}%;background:var(--accent-1)"></div></div>
        <span style="font-size:11px;min-width:20px;text-align:right">${dayData.total}</span>
      </div>`;
  }
  weeklyContainer.innerHTML = weeklyHtml || '<p>Henüz veri yok</p>';

  // Most reviewed
  const mostContainer = document.getElementById('most-reviewed');
  const sorted = Object.entries(state.progress)
    .filter(([_, p]) => p.reviewed > 0)
    .sort(([, a], [, b]) => b.reviewed - a.reviewed)
    .slice(0, 10);
  if (sorted.length === 0) {
    mostContainer.innerHTML = '<p>Henüz veri yok</p>';
  } else {
    mostContainer.innerHTML = sorted.map(([idx, p]) => {
      const w = flatWords[idx];
      if (!w) return '';
      return `<div class="stat-row"><span>${w.word.english}</span><span>${p.reviewed} tekrar</span></div>`;
    }).join('');
  }
}

// ========== ACHIEVEMENTS ==========
const ACHIEVEMENTS = [
  { id: 'first_review', icon: 'fa-star', title: 'İlk Adım', desc: 'İlk tekrarını yap', color: '#ffa726' },
  { id: 'ten_reviews', icon: 'fa-rocket', title: 'Ezberci', desc: '10 tekrar yap', color: '#6c63ff' },
  { id: 'hundred_reviews', icon: 'fa-crown', title: 'Kelime Avcısı', desc: '100 tekrar yap', color: '#f1c40f' },
  { id: 'thousand_reviews', icon: 'fa-dragon', title: 'Kelime Ustası', desc: '1000 tekrar yap', color: '#e74c3c' },
  { id: 'five_streak', icon: 'fa-fire', title: 'Alev Almaya Başla', desc: '5 gün üst üste tekrar', color: '#ff6b9d' },
  { id: 'ten_streak', icon: 'fa-volcano', title: 'Yanıyorum', desc: '10 gün üst üste tekrar', color: '#ff5722' },
  { id: 'first_fav', icon: 'fa-heart', title: 'Beğendim', desc: 'İlk favori kelimeni ekle', color: '#e91e63' },
  { id: 'five_fav', icon: 'fa-heart', title: 'Koleksiyoncu', desc: '5 favori kelime', color: '#e91e63' },
  { id: 'first_diff', icon: 'fa-exclamation', title: 'Meydan Okuyan', desc: 'İlk zor kelime', color: '#e74c3c' },
  { id: 'all_learned', icon: 'fa-check-double', title: 'Tamamla', desc: 'Tüm seviyelerden en az 1 kelime öğren', color: '#00d4aa' },
  { id: 'all_levels', icon: 'fa-layer-group', title: 'Kaşif', desc: 'Tüm seviyeleri ziyaret et', color: '#6c63ff' },
  { id: 'perfect_review', icon: 'fa-perfect', title: 'Mükemmel', desc: 'Bir tekrar oturumunu tam puanla bitir', color: '#00d4aa' }
];

function checkAchievements() {
  const progs = Object.values(state.progress);
  const reviewedCount = progs.filter(p => p.reviewed > 0).length;
  const totalReviews = state.stats.totalReviews;
  const favCount = progs.filter(p => p.fav).length;
  const diffCount = progs.filter(p => p.diff).length;
  const streak = state.stats.bestStreak;

  const conditions = {
    first_review: totalReviews >= 1,
    ten_reviews: totalReviews >= 10,
    hundred_reviews: totalReviews >= 100,
    thousand_reviews: totalReviews >= 1000,
    five_streak: streak >= 5,
    ten_streak: streak >= 10,
    first_fav: favCount >= 1,
    five_fav: favCount >= 5,
    first_diff: diffCount >= 1,
    all_learned: allWords.every((_, li) => flatWords.some(w => w.levelIndex === li && getProg(w.globalIdx).reviewed > 0)),
    all_levels: true, // always true since user can navigate
    perfect_review: reviewWrong === 0 && reviewCorrect > 0 && reviewIndex === reviewQueue.length && reviewQueue.length > 0
  };

  let newUnlock = false;
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements.includes(a.id) && conditions[a.id]) {
      state.achievements.push(a.id);
      newUnlock = true;
    }
  });

  if (newUnlock) {
    saveState();
    updateAchievements();
    fireConfetti();
    setTimeout(() => showToast('Yeni başarım kazandın!'), 1000);
  }
}

function updateAchievements() {
  const container = document.getElementById('achievements-grid');
  container.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = state.achievements.includes(a.id);
    return `
      <div class="glass achievement-card ${unlocked ? '' : 'locked'}">
        <i class="fas ${a.icon}" style="color:${a.color}"></i>
        <h4>${unlocked ? a.title : '???'}</h4>
        <p>${unlocked ? a.desc : 'Henüz kazanılmadı'}</p>
      </div>`;
  }).join('');
}

// ========== SETTINGS ==========
document.getElementById('setting-dark').addEventListener('change', e => {
  state.settings.dark = e.target.checked;
  document.documentElement.setAttribute('data-theme', state.settings.dark ? 'dark' : 'light');
  saveState();
});

document.getElementById('setting-tts').addEventListener('change', e => {
  state.settings.tts = e.target.checked;
  saveState();
});

document.getElementById('setting-tts-rate').addEventListener('input', e => {
  state.settings.ttsRate = parseFloat(e.target.value);
  document.getElementById('setting-tts-rate-val').textContent = state.settings.ttsRate.toFixed(1) + 'x';
  saveState();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'englishmaster-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Veri dışa aktarıldı');
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      state = { ...defaultState(), ...data, settings: { ...defaultState().settings, ...data.settings }, stats: { ...defaultState().stats, ...data.stats } };
      saveState();
      showToast('Veri içe aktarıldı');
      updateAll();
    } catch (err) {
      showToast('Geçersiz dosya');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Tüm veriler silinecek! Emin misin?')) {
    state = defaultState();
    saveState();
    updateAll();
    showToast('Veriler sıfırlandı');
  }
});

function updateAll() {
  updateHomeStats();
  updateWordList();
  updateFlashcardView();
  updateStatsView();
  updateAchievements();
  updateStreak();
}

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (currentView) {
    case 'flashcard':
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); document.getElementById('fc-flip').click(); }
      if (e.key === 'ArrowLeft') document.getElementById('fc-prev').click();
      if (e.key === 'ArrowRight') document.getElementById('fc-next').click();
      if (e.key.toLowerCase() === 'f') document.getElementById('fc-fav').click();
      if (e.key.toLowerCase() === 'd') document.getElementById('fc-diff').click();
      if (e.key.toLowerCase() === 's') document.getElementById('fc-speak').click();
      break;
    case 'review':
      if (e.key === '1') document.getElementById('rev-hard').click();
      if (e.key === '2') document.getElementById('rev-good').click();
      if (e.key === '3') document.getElementById('rev-easy').click();
      if (e.key === ' ' || e.key === 'Enter') {
        const card = document.getElementById('review-card');
        if (!document.getElementById('review-active').classList.contains('hidden')) {
          document.getElementById('review-card-inner').classList.toggle('flipped');
        }
      }
      break;
  }

  // Global nav shortcuts
  if (e.altKey) {
    const views = ['home', 'dictionary', 'flashcard', 'review', 'stats', 'achievements', 'settings'];
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < views.length) switchView(views[idx]);
  }
});

// ========== Init ==========
document.documentElement.setAttribute('data-theme', state.settings.dark ? 'dark' : 'light');
document.getElementById('setting-dark').checked = state.settings.dark;
document.getElementById('setting-tts').checked = state.settings.tts;
document.getElementById('setting-tts-rate').value = state.settings.ttsRate;
document.getElementById('setting-tts-rate-val').textContent = state.settings.ttsRate.toFixed(1) + 'x';

initData();
