/* Focus CET-4: browser-local study scheduling. Intervals are explicit, not FSRS. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INTERVALS = Object.freeze([0, 1, 3, 7, 14, 30]);
  const RATINGS = ['again', 'hard', 'good', 'easy'];
  const MODES = ['card', 'quiz', 'spell'];
  const forbiddenIds = new Set(['__proto__', 'constructor', 'prototype']);
  const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
  const safeId = id => typeof id === 'string' && id.length > 0 && id.length <= 120 && !forbiddenIds.has(id);
  const idOf = word => String(word && (word.id == null ? word.word : word.id) || '');
  const int = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Math.floor(Number(n)))) : min;

  function dateParts(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const d = new Date(year, month - 1, day, 12);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) throw new RangeError('Invalid local date');
      return d;
    }
    const d = value == null ? new Date() : value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date');
    return d;
  }
  function dayKey(value) {
    const d = dateParts(value);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function addDays(value, days) {
    const d = dateParts(dayKey(value));
    d.setDate(d.getDate() + days);
    return dayKey(d);
  }
  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    try { return dayKey(value); } catch (_) { return ''; }
  }
  function uniqueIds(values) {
    return Array.isArray(values) ? [...new Set(values.filter(safeId))] : [];
  }
  function settings(value) {
    const v = value && typeof value === 'object' ? value : {};
    const dailyNew = Number(v.dailyNew);
    return {
      dailyNew: (typeof v.dailyNew === 'number' || typeof v.dailyNew === 'string') && Number.isInteger(dailyNew) && dailyNew >= 1 && dailyNew <= 10000 ? dailyNew : 50,
      planVersion: 2,
      quizVersion: 1,
      rounds: [3,5].includes(Number(v.rounds)) ? Number(v.rounds) : 3,
      audioRate: Number.isFinite(Number(v.audioRate)) && Number(v.audioRate) >= 0.5 && Number(v.audioRate) <= 1.5 ? Number(v.audioRate) : 0.85,
      autoPronounce: v.autoPronounce !== false,
      mode: MODES.includes(v.mode) ? v.mode : 'quiz'
    };
  }
  function validTimestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDay(value.slice(0, 10))) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  function exerciseRecords(value) {
    const records = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return records;
    for (const [id, record] of Object.entries(value)) {
      if (!safeId(id) || !record || typeof record !== 'object' || Array.isArray(record)) continue;
      const { kind, answers, score, total } = record;
      const completedAt = validTimestamp(record.completedAt);
      if (!['listening', 'reading'].includes(kind) || !Number.isInteger(total) || total < 1 || total > 20 || !completedAt) continue;
      if (!Array.isArray(answers) || answers.length !== total || !Array.from(answers).every(answer => answer === null || Number.isInteger(answer) && answer >= 0 && answer <= 3)) continue;
      if (!Number.isInteger(score) || score < 0 || score > total) continue;
      records[id] = { kind, answers: answers.slice(), score, total, completedAt, attempts: int(record.attempts) };
    }
    return records;
  }
  function normalizeState(raw) {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const state = { version: 1, cards: {}, activity: {}, settings: settings(input.settings), favorites: uniqueIds(input.favorites), exerciseRecords: exerciseRecords(input.exerciseRecords) };
    if (input.cards && typeof input.cards === 'object' && !Array.isArray(input.cards)) {
      for (const [id, card] of Object.entries(input.cards)) {
        if (!safeId(id) || !card || typeof card !== 'object' || Array.isArray(card)) continue;
        state.cards[id] = {
          stage: int(card.stage, 0, 5), due: validDay(card.due), lastReview: validDay(card.lastReview),
          lapses: int(card.lapses), reviews: int(card.reviews), known: card.known === true
        };
      }
    }
    if (input.activity && typeof input.activity === 'object' && !Array.isArray(input.activity)) {
      for (const [key, item] of Object.entries(input.activity)) {
        if (!validDay(key) || !item || typeof item !== 'object') continue;
        const attempts = int(item.attempts);
        state.activity[key] = { newIds: uniqueIds(item.newIds), reviewIds: uniqueIds(item.reviewIds), correct: int(item.correct, 0, attempts), attempts };
      }
    }
    return state;
  }
  function createState(initialSettings) { return normalizeState({ settings: initialSettings }); }
  function setSettings(state, patch) {
    const result = normalizeState(state);
    result.settings = settings({ ...result.settings, ...patch });
    return result;
  }
  function distinctWords(words) {
    const ids = new Set();
    return (Array.isArray(words) ? words : []).filter(word => {
      const id = idOf(word);
      if (!safeId(id) || ids.has(id)) return false;
      ids.add(id); return true;
    });
  }
  function buildSession(words, rawState, date) {
    const state = normalizeState(rawState), today = dayKey(date);
    const todayActivity = state.activity[today] || { newIds: [] };
    const list = distinctWords(words), allowed = new Set(list.map(idOf));
    const learnedToday = todayActivity.newIds.filter(id => allowed.has(id)).length;
    const remainingNew = Math.max(0, state.settings.dailyNew - learnedToday);
    const review = list.filter(word => {
      const card = state.cards[idOf(word)];
      return card && !card.known && card.reviews > 0 && (!card.due || card.due <= today);
    }).sort((a, b) => {
      const ca = state.cards[idOf(a)], cb = state.cards[idOf(b)];
      return ca.due.localeCompare(cb.due) || cb.lapses - ca.lapses || idOf(a).localeCompare(idOf(b));
    });
    const fresh = list.filter(word => {
      const card = state.cards[idOf(word)];
      return !card || (!card.known && card.reviews === 0);
    }).slice(0, remainingNew);
    const items = [...review.map(word => ({ id: idOf(word), kind: 'review' })), ...fresh.map(word => ({ id: idOf(word), kind: 'new' }))];
    return { date: today, items, reviewCount: review.length, newCount: fresh.length, remainingNew };
  }
  function rate(rawState, id, rating, options) {
    if (!safeId(String(id))) throw new TypeError('Invalid word id');
    if (!RATINGS.includes(rating)) throw new TypeError('Invalid rating');
    id = String(id); options = options || {};
    const state = normalizeState(rawState), today = dayKey(options.date);
    const previous = state.cards[id] || { stage: 0, due: '', lastReview: '', lapses: 0, reviews: 0, known: false };
    const first = previous.reviews === 0;
    let stage, due;
    if (rating === 'again') { stage = 0; due = today; }
    else if (rating === 'hard') { stage = Math.max(1, previous.stage); due = addDays(today, 1); }
    else if (previous.reviews > 0 && previous.lastReview === today && previous.stage > 0) {
      // Same-day retrieval rounds count as attempts, not separate long-term intervals.
      stage = previous.stage;
      due = previous.due || addDays(today, INTERVALS[stage]);
    }
    else {
      stage = Math.min(5, previous.stage + (rating === 'easy' ? 2 : 1));
      due = addDays(today, INTERVALS[stage]);
    }
    state.cards[id] = {
      stage, due, lastReview: today, lapses: previous.lapses + (rating === 'again' ? 1 : 0),
      reviews: previous.reviews + 1, known: false
    };
    const activity = state.activity[today] || { newIds: [], reviewIds: [], correct: 0, attempts: 0 };
    // A repeated attempt on a new word still consumes just one new-word slot.
    if (first) { if (!activity.newIds.includes(id)) activity.newIds.push(id); }
    else if (!activity.newIds.includes(id) && !activity.reviewIds.includes(id)) activity.reviewIds.push(id);
    activity.attempts++;
    const correct = typeof options.correct === 'boolean' ? options.correct : rating !== 'again';
    if (correct) activity.correct++;
    state.activity[today] = activity;
    return state;
  }
  function markKnown(rawState, id, known = true, date) {
    id = String(id);
    if (!safeId(id)) throw new TypeError('Invalid word id');
    const state = normalizeState(rawState);
    const previous = state.cards[id] || { stage: 0, due: '', lastReview: '', lapses: 0, reviews: 0, known: false };
    // Re-adding an already studied word schedules it for review today.
    state.cards[id] = { ...previous, known: !!known, due: !known && previous.reviews > 0 ? dayKey(date) : previous.due };
    return state;
  }
  function streak(rawState, date) {
    const state = normalizeState(rawState);
    let key = dayKey(date), total = 0;
    if (!(state.activity[key] && state.activity[key].attempts > 0)) key = addDays(key, -1);
    while (state.activity[key] && state.activity[key].attempts > 0) { total++; key = addDays(key, -1); }
    return total;
  }
  function counts(words, rawState, date) {
    const state = normalizeState(rawState), today = dayKey(date), list = distinctWords(words);
    const allowed = new Set(list.map(idOf));
    const activity = state.activity[today] || { newIds: [], reviewIds: [], attempts: 0, correct: 0 };
    let known = 0, learning = 0, mastered = 0, unseen = 0, due = 0;
    for (const word of list) {
      const card = state.cards[idOf(word)];
      if (card && card.known) known++;
      else if (!card || card.reviews === 0) unseen++;
      else {
        if (card.stage >= 4) mastered++; else learning++;
        if (!card.due || card.due <= today) due++;
      }
    }
    const todayNew = activity.newIds.filter(id => allowed.has(id)).length;
    const todayReview = activity.reviewIds.filter(id => allowed.has(id)).length;
    return {
      total: list.length, unseen, learning, mastered, known, due, todayNew, todayReview,
      todayAttempts: activity.attempts, todayCorrect: activity.correct,
      remainingNew: Math.max(0, state.settings.dailyNew - todayNew), streak: streak(state, today)
    };
  }
  function normalizeSpelling(value) {
    return String(value == null ? '' : value).normalize('NFKC').toLowerCase().trim()
      .replace(/[’‘ʼ`]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ');
  }
  function checkSpelling(input, target) {
    const expected = typeof target === 'string' ? [target] : target && typeof target === 'object' ? [target.word, ...(Array.isArray(target.aliases) ? target.aliases : [])] : [];
    const answer = normalizeSpelling(input);
    return !!answer && expected.some(word => typeof word === 'string' && answer === normalizeSpelling(word));
  }
  function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const r = Number(random()); const j = Math.floor(Math.max(0, Math.min(0.999999999, Number.isFinite(r) ? r : 0)) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function meaningText(word) {
    const v = word && (word.meaning == null ? word.translation : word.meaning);
    return Array.isArray(v) ? v.join('；') : String(v == null ? '' : v).trim();
  }
  const POS_PREFIX = /\b(?:adj|adv|aux|n|a|v[ti]?|prep|conj|pron|num|int)\.\s*/gi;
  function meaningParts(text) {
    // A comma inside a note such as “占(时间、空间等)” does not end a sense.
    return text.match(/(?:[^；;，,、\n/()（）]|[（(][^）)]*[）)])+/g) || [];
  }
  function shortMeaning(word) {
    const full = meaningText(word);
    const first = full.split(/\r?\n|\s+(?=(?:adj|adv|aux|n|a|v[ti]?|prep|conj|pron|num|int)\.)/i).find(line => line.trim()) || full;
    const prefix = first.match(/^(?:adj|adv|aux|n|a|v[ti]?|prep|conj|pron|num|int)\.\s*/i);
    const label = prefix ? prefix[0].trim() + ' ' : '';
    const senses = meaningParts(first.replace(POS_PREFIX, '')).map(s => s.trim()).filter(Boolean);
    let text = label;
    for (const sense of senses.slice(0, 3)) {
      const next = text + (text === label ? '' : '；') + sense;
      if (next.length > 40 && text !== label) break;
      text = next;
    }
    // Bundled definitions fit whole senses. Also bound imported custom definitions.
    return text.length > 40 ? text.slice(0, 39).replace(/[；;，,、\s]+$/, '') + '…' : text || full.slice(0, 40);
  }
  function meaningTokens(word) {
    return meaningParts(meaningText(word).replace(POS_PREFIX, '')).map(s => s
      .replace(/[（(][^）)]*[）)]/g, '').replace(/[^\u3400-\u9fff0-9]/g, '')
      .replace(/^(?:使|被|让|进行)(?=[\u3400-\u9fff]{2})/, '').replace(/([\u3400-\u9fff]{2,})[的地得]$/, '$1')).filter(s => s.length >= 2);
  }
  const SYNONYM_GROUPS = [
    ['促进', '推动', '推进'], ['提供', '供应', '供给'], ['允许', '准许', '许可', '容许'],
    ['显示', '表明', '说明', '表露'], ['获得', '取得', '得到'], ['达到', '实现', '达成'],
    ['增加', '增长', '增多'], ['减少', '降低', '减小'], ['拒绝', '回绝'], ['隐藏', '隐瞒', '掩藏'],
    ['方法', '方式', '办法', '途径'], ['目的', '目标', '宗旨'], ['重要', '重大', '关键'],
    ['困难', '艰难', '艰苦'], ['相同', '同样', '一样'], ['迅速', '快速', '飞快']
  ];
  function meaningsOverlap(a, b) {
    return a.some(left => b.some(right => left.includes(right) || right.includes(left) ||
      SYNONYM_GROUPS.some(group => group.includes(left) && group.includes(right))));
  }
  function primaryPos(word) {
    const pos = word && word.pos;
    const text = Array.isArray(pos) ? pos[0] : pos;
    const match = String(text || meaningText(word)).match(/\b(adj|adv|aux|n|a|v[ti]?|prep|conj|pron|num|int)\b/i);
    return match ? match[1].toLowerCase().replace(/^(?:v[ti]|aux)$/, 'v').replace(/^a$/, 'adj') : '';
  }
  function makeQuestion(word, words, options) {
    if (!word || !safeId(idOf(word)) || !meaningText(word)) throw new TypeError('A valid word with a meaning is required');
    const random = options && typeof options.random === 'function' ? options.random : Math.random;
    const correctId = idOf(word), correctText = shortMeaning(word), correctTokens = meaningTokens(word);
    const candidates = shuffle(distinctWords(words).filter(item => idOf(item) !== correctId && meaningText(item)), random);
    const ranked = candidates.map(item => ({
      item, text: shortMeaning(item), tokens: meaningTokens(item),
      samePos: primaryPos(item) === primaryPos(word)
    })).filter(item => !meaningsOverlap(item.tokens, correctTokens)).sort((a, b) => Number(b.samePos) - Number(a.samePos));
    const displayKey = text => text.replace(POS_PREFIX, '').replace(/[^\u3400-\u9fff0-9]/g, '');
    const choices = [{ id: correctId, text: correctText }], seen = new Set([displayKey(correctText)]), chosenTokens = [correctTokens];
    for (const entry of ranked) {
      const { text, tokens } = entry;
      const key = displayKey(text);
      if (!key || seen.has(key) || chosenTokens.some(selected => meaningsOverlap(selected, tokens))) continue;
      seen.add(key); chosenTokens.push(tokens); choices.push({ id: idOf(entry.item), text });
      if (choices.length === 4) break;
    }
    return { id: correctId, word: word.word, prompt: '选择这个单词的正确释义', options: shuffle(choices, random), answerId: correctId, fullMeaning: meaningText(word) };
  }
  return { INTERVALS, createState, normalizeState, dayKey, addDays, buildSession, rate, markKnown, setSettings, counts, makeQuestion, checkSpelling, normalizeSpelling, streak };
});
