// ── State ──────────────────────────────────────────────────────────────────
const STATE = {
  apiKey: '',
  mode: 'notify',           // 'notify' | 'auto'
  selectedTimes: new Set([6, 8, 10, 12, 14, 17, 20]),
  posts: [],
  alarms: [],
  statsGenerated: 0,
  statsScheduled: 0,
  activeTopics: new Set(['DSA', 'System Design', 'AI/ML', 'Python', 'Java', 'LeetCode']),
  customRules: '',
  notifPermission: Notification?.permission || 'default',
  isGenerating: false,  // Prevent concurrent API calls
};

const TIMES = [
  '06:00','07:00','08:00','09:00','10:00','11:00',
  '12:00','13:00','14:00','15:00','17:00','19:00',
  '20:00','22:00'
];
const TIME_LABELS = [
  '6 AM','7 AM','8 AM','9 AM','10 AM','11 AM',
  '12 PM','1 PM','2 PM','3 PM','5 PM','7 PM',
  '8 PM','10 PM'
];

const TOPICS = [
  'DSA', 'System Design', 'AI/ML', 'Python', 'Java',
  'LeetCode', 'Database', 'Coding Tips', 'Machine Learning',
  'LLMs', 'Backend Dev', 'DevOps', 'Open Source'
];

const DEFAULT_RULES = `You are a viral Tech Twitter personality. Your audience: developers, CS students, ML engineers.

CONTENT RULES:
- Topics: DSA, LeetCode, System Design, AI/ML, Python, Java, Database, Backend, Open Source
- Mix post types: insights, sarcasm, hot takes, trending news takes, quick tips
- SARCASM style: dry wit, developer humor, relatable pain points (e.g. "Spent 3 hours debugging. It was a missing semicolon. I'm fine.")
- HOOK style: start with a number or bold claim ("Most devs don't know this about Big O...")
- TRENDING style: take a current AI/tech trend and give a hot take
- INSIGHT style: teach something in ≤3 sentences
- Keep posts 200-260 characters
- Use 1-2 emojis max
- No hashtags unless they add value
- Be opinionated, not generic
- Sound human, not corporate`;

// ── Save/Load ──────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('xposter', JSON.stringify({
    apiKey: STATE.apiKey,
    mode: STATE.mode,
    selectedTimes: [...STATE.selectedTimes],
    statsGenerated: STATE.statsGenerated,
    statsScheduled: STATE.statsScheduled,
    activeTopics: [...STATE.activeTopics],
    customRules: STATE.customRules,
    alarms: STATE.alarms,
  }));
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('xposter') || '{}');
    if (d.apiKey) STATE.apiKey = d.apiKey;
    if (d.mode) STATE.mode = d.mode;
    if (d.selectedTimes) STATE.selectedTimes = new Set(d.selectedTimes);
    if (d.statsGenerated) STATE.statsGenerated = d.statsGenerated;
    if (d.statsScheduled) STATE.statsScheduled = d.statsScheduled;
    if (d.activeTopics) STATE.activeTopics = new Set(d.activeTopics);
    if (d.customRules !== undefined) STATE.customRules = d.customRules;
    if (d.alarms) STATE.alarms = d.alarms;


    const savedGeminiKey =
  localStorage.getItem('gemini_key');

if (savedGeminiKey) {
  STATE.apiKey = savedGeminiKey;
}
  } catch(e) {}
}

// ── Service Worker & Notifications ────────────────────────────────────────
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch(e) { console.warn('SW failed:', e); }
  }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) { toast('Notifications not supported on this browser'); return; }
  const perm = await Notification.requestPermission();
  STATE.notifPermission = perm;
  if (perm === 'granted') {
    toast('🔔 Notifications enabled!');
    renderSettings();
    startAlarmClock();
  } else {
    toast('Notifications blocked — enable in browser settings');
  }
}

function startAlarmClock() {
  // Tick every 30 seconds, send alarms to SW
  setInterval(() => {
    if (navigator.serviceWorker.controller && STATE.alarms.length > 0) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_ALARMS',
        alarms: STATE.alarms,
      });
    } else {
      // Fallback: check in-page if SW not controlling
      checkAlarmsInPage();
    }
  }, 30000);
}

function checkAlarmsInPage() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  STATE.alarms.forEach(alarm => {
    if (alarm.time === hhmm && alarm.post && STATE.notifPermission === 'granted') {
      new Notification('⏰ Time to post on X!', {
        body: alarm.post.substring(0, 100) + '…',
        icon: '/icon-192.png',
        tag: `alarm-${alarm.time}`,
      });
    }
  });
}

// ── Google AI Studio API ──────────────────────────────────────────────────
// ── Google AI Studio API ──────────────────────────────────────────────────
async function callGoogleAI(prompt) {
  const key = STATE.apiKey;

  if (!key) {
    throw new Error('NO_KEY');
  }

  const rules = STATE.customRules || DEFAULT_RULES;
  const topics = [...STATE.activeTopics].join(', ');
  const times = getSelectedTimes();

  const fullPrompt = `${rules}

ACTIVE TOPICS FOR TODAY:
${topics}

Generate exactly ${times.length} tweets.

${prompt}

IMPORTANT:
Return ONLY valid JSON.

Example:

[
  {
    "post":"tweet text",
    "type":"hook",
    "time":"06:00",
    "topic":"DSA"
  }
]
`;

  // const resp = await fetch(
  //   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,

  const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1500,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!resp.ok) {
    const errorText = await resp.text();

    console.error(
      'Gemini API Error:',
      errorText
    );

    throw new Error(
      `Gemini Error ${resp.status}: ${errorText}`
    );
  }

  const data = await resp.json();

  console.log(
    'Gemini Response:',
    data
  );

  const raw =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) {
    throw new Error(
      'Gemini returned empty content'
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    const clean =
      raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    return JSON.parse(clean);
  }
}
// ── Generate posts ─────────────────────────────────────────────────────────
async function generatePosts() {
  if (STATE.isGenerating) { toast('⏳ Already generating... please wait'); return; }
  if (!STATE.apiKey) { switchTab('settings'); toast('⚠️ Add your Google AI API key first'); return; }
  const times = getSelectedTimes();
  if (times.length === 0) { toast('Select at least one time slot'); return; }

  STATE.isGenerating = true;
  const btn = document.getElementById('gen-btn');
  const btnText = document.getElementById('gen-btn-text');
  btn.disabled = true;
  btnText.textContent = 'Generating with Google AI…';

  // Show skeletons
  const list = document.getElementById('posts-list');
  list.innerHTML = times.map(() => `
    <div class="skel">
      <div class="skel-line" style="width:35%"></div>
      <div class="skel-line" style="width:90%"></div>
      <div class="skel-line" style="width:70%"></div>
      <div class="skel-line" style="width:45%"></div>
    </div>
  `).join('');

  document.getElementById('posts-section').style.display = 'block';

  try {
    const topics = [...STATE.activeTopics].join(', ');
    STATE.posts = await callGoogleAI(
      `Generate ${times.length} viral tech tweets for today. Topics to cover: ${topics}. Times: ${times.join(', ')}. Mix the post types — include at least one sarcasm and one trending type.`
    );

    // Map times in order if not already set
    STATE.posts.forEach((p, i) => { if (!p.time || !TIMES.includes(p.time)) p.time = times[i] || times[0]; });

    // Set alarms
    STATE.alarms = STATE.posts.map(p => ({ time: p.time, post: p.post }));
    save();

    STATE.statsGenerated += STATE.posts.length;
    if (STATE.mode === 'auto') STATE.statsScheduled += STATE.posts.length;

    renderPosts();
    renderStats();
    save();

    if (STATE.mode === 'auto') {
      toast(`✅ ${STATE.posts.length} posts scheduled!`);
    } else {
      toast(`✅ ${STATE.posts.length} posts ready to review`);
    }
  } catch(e) {
    const errMsg = e.message;
    if (errMsg.includes('429') || errMsg.includes('Too Many')) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><div>Rate limit hit. Wait a few seconds and try again</div></div>`;
    } else if (errMsg === 'NO_KEY') {
      list.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div>Add your Google AI API key in Settings</div></div>`;
    } else {
      list.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div>${errMsg || 'Generation failed — check API key & try again'}</div></div>`;
    }
  } finally {
    STATE.isGenerating = false;
  }

  btn.disabled = false;
  btnText.textContent = 'Regenerate posts';
}

// ── Render posts ───────────────────────────────────────────────────────────
function renderPosts() {
  const list = document.getElementById('posts-list');
  if (!STATE.posts.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📝</div><div>No posts yet — hit Generate</div></div>`;
    return;
  }

  list.innerHTML = STATE.posts.map((p, i) => {
    const typeClass = `type-${p.type || 'insight'}`;
    const timeLabel = TIME_LABELS[TIMES.indexOf(p.time)] || p.time;
    const isAuto = STATE.mode === 'auto';
    const charLen = (p.post || '').length;
    return `
      <div class="post-card" id="pc-${i}">
        <div class="post-top">
          <div class="post-meta">
            <span class="post-idx">#${i + 1}</span>
            <span class="time-pill">🕐 ${timeLabel}</span>
            <span class="type-pill ${typeClass}">${p.type || 'insight'}</span>
          </div>
        </div>
        ${p.trending ? `<div class="trending-row"><span class="trend-badge">🔥 Trending take</span></div>` : ''}
        <div class="post-text" id="pt-${i}">${esc(p.post)}</div>
        <div class="post-footer">
          <span class="char-ct ${charLen > 280 ? 'over' : ''}" id="cc-${i}">${charLen}/280</span>
          <div class="post-btns">
            <button class="pbtn" onclick="editPost(${i})" id="eb-${i}">✏️ Edit</button>
            ${isAuto
              ? `<button class="pbtn pbtn-sched">📅 Scheduled</button>`
              : `<button class="pbtn pbtn-post" onclick="postNow(${i})" id="pb-${i}">📤 Post</button>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function editPost(i) {
  const el = document.getElementById(`pt-${i}`);
  const eb = document.getElementById(`eb-${i}`);
  if (el.tagName === 'TEXTAREA') {
    STATE.posts[i].post = el.value;
    STATE.alarms[i] = { time: STATE.posts[i].time, post: el.value };
    save();
    const div = document.createElement('div');
    div.className = 'post-text';
    div.id = `pt-${i}`;
    div.textContent = STATE.posts[i].post;
    el.replaceWith(div);
    eb.textContent = '✏️ Edit';
    updateChar(i, STATE.posts[i].post.length);
  } else {
    const ta = document.createElement('textarea');
    ta.className = 'post-edit-ta';
    ta.id = `pt-${i}`;
    ta.value = STATE.posts[i].post;
    ta.oninput = () => updateChar(i, ta.value.length);
    el.replaceWith(ta);
    ta.focus();
    eb.textContent = '✅ Save';
  }
}

function updateChar(i, len) {
  const el = document.getElementById(`cc-${i}`);
  if (el) { el.textContent = `${len}/280`; el.className = `char-ct ${len > 280 ? 'over' : ''}`; }
}

function postNow(i) {
  const text = STATE.posts[i].post;
  navigator.clipboard.writeText(text).catch(() => {});
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  const btn = document.getElementById(`pb-${i}`);
  if (btn) { btn.textContent = '✅ Done'; btn.className = 'pbtn pbtn-done'; btn.onclick = null; }
  STATE.statsScheduled++;
  renderStats();
  save();
  toast('Copied & opening X…');
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
  document.getElementById('stat-gen').textContent = STATE.statsGenerated;
  document.getElementById('stat-sched').textContent = STATE.statsScheduled;
  document.getElementById('stat-slots').textContent = STATE.selectedTimes.size;
}

// ── Time slots ────────────────────────────────────────────────────────────
function buildTimeGrid() {
  const g = document.getElementById('time-grid');
  g.innerHTML = TIMES.map((t, i) => `
    <div class="tslot ${STATE.selectedTimes.has(i) ? 'on' : ''}" onclick="toggleTime(${i}, this)">${TIME_LABELS[i]}</div>
  `).join('');
}

function toggleTime(i, el) {
  if (STATE.selectedTimes.has(i)) STATE.selectedTimes.delete(i);
  else STATE.selectedTimes.add(i);
  el.classList.toggle('on');
  renderStats();
  save();
}

function getSelectedTimes() {
  return [...STATE.selectedTimes].sort((a, b) => a - b).map(i => TIMES[i]);
}

// ── Topic tags ────────────────────────────────────────────────────────────
function buildTopicTags() {
  const c = document.getElementById('topic-tags');
  c.innerHTML = TOPICS.map(t => `
    <span class="rtag ${STATE.activeTopics.has(t) ? 'on' : ''}" onclick="toggleTopic('${t}', this)">${t}</span>
  `).join('');
}

function toggleTopic(t, el) {
  if (STATE.activeTopics.has(t)) STATE.activeTopics.delete(t);
  else STATE.activeTopics.add(t);
  el.classList.toggle('on');
  save();
}

// ── Mode ──────────────────────────────────────────────────────────────────
function setMode(m) {
  STATE.mode = m;
  document.getElementById('mode-notify').classList.toggle('active', m === 'notify');
  document.getElementById('mode-auto').classList.toggle('active', m === 'auto');
  save();
}

// ── Tabs / nav ────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.getElementById(`nav-${tab}`).classList.add('active');
}

// ── Settings ──────────────────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('notif-status');
  if (!el) return;
  if (STATE.notifPermission === 'granted') {
    el.textContent = '✅ Notifications enabled';
    el.style.color = 'var(--green)';
    document.getElementById('notif-btn-row').style.display = 'none';
  } else {
    el.textContent = '🔕 Notifications off';
    el.style.color = 'var(--amber)';
    document.getElementById('notif-btn-row').style.display = 'block';
  }
  document.getElementById('api-key-input').value = STATE.apiKey;
  document.getElementById('rules-input').value = STATE.customRules;
}

function saveSettings() {
  STATE.apiKey =
    document
      .getElementById('api-key-input')
      .value
      .trim();

  STATE.customRules =
    document
      .getElementById('rules-input')
      .value
      .trim();

  localStorage.setItem(
    'gemini_key',
    STATE.apiKey
  );

  save();

  toast('✅ Settings saved');
}
// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  load();
  registerSW();
  buildTimeGrid();
  buildTopicTags();
  renderStats();
  renderSettings();
  startAlarmClock();

  // Restore posts if any from today
  if (STATE.posts && STATE.posts.length > 0) {
    document.getElementById('posts-section').style.display = 'block';
    renderPosts();
  }
}

document.addEventListener('DOMContentLoaded', init);
