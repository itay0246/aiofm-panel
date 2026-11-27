/* AI OFM Creator app (plan v8, step C+). Vanilla JS, no build step.
   The same file runs on GitHub Pages (opens even when the laptop sleeps) and from the laptop's app server. */
(() => {
'use strict';
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
const initData = tg ? tg.initData : '';
const $app = document.getElementById('app'), $layer = document.getElementById('layer');
const qs = new URLSearchParams(location.search);
const DESKTOP = tg && ['tdesktop', 'macos', 'weba', 'webk', 'unigram', 'web'].includes(tg.platform);
const SAME_ORIGIN = /trycloudflare\.com$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
const THEMES = [['creator', 'Creator light', '#fbf7f3', '#dd2a7b'], ['midnight', 'Midnight', '#171c21', '#2ba4e0'],
  ['native', 'Telegram native', '#f1f1f5', '#3390ec'], ['noir', 'Noir', '#0d0d0f', '#d6b26e']];
const WMODES = [['full', '⛶', 'Full screen', 'Covers the whole screen. Esc or this menu to leave.'],
  ['browser', '🖥', 'Full screen windowed', 'Opens in your browser: a maximized window that keeps the taskbar, and the browser remembers its size. Sign-in is a one-time link (10 min).'],
  ['window', '▭', 'Window', 'Telegram’s normal app window.']];
const TYPES = ['Reel', 'Post', 'Carousel', 'Story'], STATS = [['scheduled', 'Scheduled'], ['missing', 'Missing'], ['posted', 'Posted'], ['failed', 'Failed']];
const ICON = {Reel: '🎬', Post: '▦', Carousel: '◫', Story: '◐'};
const STAGE = {review: ['Review', 'warn'], approved: ['Approved', 'acc'], upscaled: ['Upscaled', 'acc'], capcut: ['CapCut', 'acc'],
  ready: ['Ready', 'ok'], scheduled: ['Scheduled', 'ok'], posted: ['Posted', 'ok'], rejected: ['Rejected', 'err']};
const DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const S = {view: 'home', stack: [], theme: 'creator', wm: 'full', user: null, avatar: null, home: null, asleep: false, snapAt: null,
  err: null, reels: null, reelStage: 'all', reel: null, scripts: null, script: null, jobs: [], job: null, sheet: null,
  sched: {wk: 0, data: null, loading: false, sm: {}, types: Object.fromEntries(TYPES.map(t => [t, true])),
    stat: Object.fromEntries(STATS.map(s => [s[0], true])), dd: null, ddq: {}}, spend: null, lessons: null, accounts: null, laptop: null};

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
const ago = t => { const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${Math.floor(m / 1440)} d`; };
const clock = t => new Date(t * 1000).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
const words = t => (String(t || '').match(/[A-Za-z0-9'’$]+/g) || []).length;
const store = {
  get: k => new Promise(res => { if (tg && tg.CloudStorage && tg.isVersionAtLeast('6.9')) tg.CloudStorage.getItem(k, (e, v) => res(e ? localStorage.getItem('aiofm-' + k) : (v || localStorage.getItem('aiofm-' + k)))); else res(localStorage.getItem('aiofm-' + k)); }),
  set: (k, v) => { try { localStorage.setItem('aiofm-' + k, v); } catch (e) {} if (tg && tg.CloudStorage && tg.isVersionAtLeast('6.9')) tg.CloudStorage.setItem(k, v, () => {}); },
};
let BASE = '';
async function pickBase() {
  if (SAME_ORIGIN) return '';
  const p = qs.get('api');
  if (p && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(p)) { store.set('api', p); return p; }
  const saved = await store.get('api');
  return saved && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(saved) ? saved : '';
}
// The laptop's address changes when it restarts. It publishes the current one in api.json of this site's repo;
// an app opened from an old button looks it up there (read-only, public; the address alone gives no access).
async function discover() {
  const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i), repo = location.pathname.split('/').filter(Boolean)[0];
  if (!m || !repo) return false;
  try {
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${repo}/contents/api.json?ref=main&t=${Date.now()}`,
      {headers: {Accept: 'application/vnd.github.raw'}, cache: 'no-store'});
    const j = await r.json();
    if (j && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(j.api) && j.api !== BASE) { BASE = j.api; store.set('api', BASE); return true; }
  } catch (e) {}
  return false;
}
async function api(path, body = {}, again = true) {
  let r;
  try {
    r = await fetch(BASE + '/api/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'},
      credentials: SAME_ORIGIN ? 'same-origin' : 'omit', body: JSON.stringify({initData, ...body})});
  } catch (e) {
    if (again && !SAME_ORIGIN && await discover()) return api(path, body, false);
    const err = new Error('The laptop is not reachable (asleep or offline).'); err.offline = true; throw err;
  }
  if ((r.status === 530 || r.status === 502 || r.status === 404) && again && !SAME_ORIGIN && await discover()) return api(path, body, false);
  let j = {};
  try { j = await r.json(); } catch (e) { if (r.status === 530 || r.status === 502 || r.status === 1033) { const err = new Error('The laptop is not reachable.'); err.offline = true; throw err; } }
  if (!r.ok) { const err = new Error(j.error || ('HTTP ' + r.status)); err.status = r.status; throw err; }
  return j;
}
function toast(text, kind = '', undo = null, ms = 3800) {
  S.toastObj = {text, kind, undo};
  drawLayer();
  clearTimeout(toast.t); toast.t = setTimeout(() => { S.toastObj = null; drawLayer(); }, ms);
}
const haptic = k => { try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(k); } catch (e) {} };

/* ---------------------------------------------------------------- drafts (never lose what Itay typed) */
const DRAFTS = (() => { try { return JSON.parse(localStorage.getItem('aiofm-drafts') || '{}'); } catch (e) { return {}; } })();
const dkey = id => `${S.view}:${S.view === 'script' ? S.script : S.view === 'job' ? ((S.jobs.find(x => x.id === S.job) || {}).thread || '') : ''}:${S.sheet ? S.sheet.name + ':' : ''}${id}`;
function saveDrafts() { try { localStorage.setItem('aiofm-drafts', JSON.stringify(DRAFTS)); } catch (e) {} }
document.addEventListener('input', e => {
  const el = e.target; if (!el.id || !/^(TEXTAREA|INPUT)$/.test(el.tagName) || el.closest('.ddp')) return;
  DRAFTS[dkey(el.id)] = el.value; clearTimeout(saveDrafts.t); saveDrafts.t = setTimeout(saveDrafts, 300);
});
function restoreDrafts(root) {
  addMics(root);
  root.querySelectorAll('textarea[id], input.field[id]').forEach(el => { const v = DRAFTS[dkey(el.id)]; if (v != null && el.value !== v) el.value = v; });
  if (S.view === 'script' && document.getElementById('ed-n')) A.count();
}
function clearDrafts(prefix) { Object.keys(DRAFTS).forEach(k => { if (k.startsWith(prefix)) delete DRAFTS[k]; }); saveDrafts(); }
function keepFocus(fn) {  // re-render without losing the cursor in the field being typed in
  const a = document.activeElement, id = a && a.id, s = a && a.selectionStart, e2 = a && a.selectionEnd;
  fn();
  if (id) { const n = document.getElementById(id); if (n && n !== a) { n.focus(); try { n.setSelectionRange(s, e2); } catch (e) {} } }
}

function stopRec() { if (!S.rec) return; clearInterval(S.rec.timer); try { S.rec.mr.stop(); } catch (e) { S.rec = null; render(); } }
function putRaw(path, body) {  // PUT raw bytes (voice, photo) with the same sign-in as the JSON calls
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('PUT', `${BASE}/api/${path}`);
    x.setRequestHeader('X-Init-Data', initData); x.withCredentials = SAME_ORIGIN;
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} x.status === 200 ? res(j) : rej(new Error(j.error || 'HTTP ' + x.status)); };
    x.onerror = () => { const e = new Error('The laptop is not reachable (asleep or offline).'); e.offline = true; rej(e); };
    x.send(body);
  });
}
const NO_MIC = new Set(['ed-h', 'ed-b']);
function addMics(root) {
  root.querySelectorAll('textarea.field[id]').forEach(el => {
    if (NO_MIC.has(el.id) || el.parentElement.classList.contains('micw')) return;
    const w = document.createElement('div'); w.className = 'micw'; el.parentNode.insertBefore(w, el); w.appendChild(el);
    const b = document.createElement('button'); b.type = 'button';
    const rec = S.rec && S.rec.id === el.id, busy = S.stt === el.id;
    b.className = 'mic' + (rec ? ' rec' : ''); b.disabled = busy;
    b.innerHTML = busy ? '<span class="spin"></span>' : rec ? '⏹ ' + Math.floor((Date.now() - S.rec.t0) / 1000) + 's' : '🎤';
    b.setAttribute('aria-label', rec ? 'Stop recording' : 'Speak instead of typing');
    b.onclick = () => A.mic(el.id); w.appendChild(b);
  });
}

/* ---------------------------------------------------------------- navigation */
const TOP = ['home', 'reels', 'create', 'schedule', 'more'];
function go(view, push = true) {
  if (push && view !== S.view) S.stack.push(S.view);
  if (TOP.includes(view)) S.stack = [];
  S.view = view; S.sheet = null; S.sched.dd = null;
  load(view); render(); window.scrollTo(0, 0);
  const m = document.querySelector('.main'); if (m) m.scrollTop = 0;
}
function back() { const v = S.stack.pop(); if (v) { S.view = v; S.sheet = null; render(); } }
const TITLES = {addcreator: 'Add a creator', creatordone: 'New creator', home: 'Home', reels: 'Reels', create: 'Create', schedule: 'Schedule', more: 'More', job: 'Hermes', results: 'Results', lessons: 'Lessons',
  spending: 'Spending', history: 'Chat history', laptop: 'Bot + laptop', accounts: 'Accounts', appearance: 'Appearance', scripts: 'Scripts',
  script: 'Script', copy: 'Copy a reel or post', take: 'Talking-head take', overlay: 'Overlay clip', photos: 'Photo ideas', upscale: 'Upscale queue',
  ask: 'Ask Hermes', reel: 'Reel', capcut: 'CapCut'};

async function load(view) {
  if (S.asleep) return;
  try {
    if (view === 'home') { S.home = await api('home'); saveSnap(); }
    else if (view === 'reels' || view === 'capcut') { S.reels = (await api('reels')).reels; }
    else if (['scripts', 'take'].includes(view)) { S.scripts = (await api('scripts')).scripts; }
    else if (view === 'schedule') { await loadWeek(); return; }
    else if (['history', 'results', 'ask', 'photos', 'upscale'].includes(view)) { S.jobs = (await api('jobs')).jobs; }
    else if (view === 'spending') { S.spend = await api('spending'); }
    else if (view === 'lessons') { S.lessons = await api('lessons'); }
    else if (view === 'accounts') { S.accounts = (await api('accounts')).accounts; }
    else if (view === 'laptop') { S.laptop = await api('laptop'); }
    else return;
    S.err = null;
  } catch (e) { handleErr(e); }
  render();
}
function handleErr(e) {
  if (e.offline) { goAsleep(); return; }
  S.err = e.message; render();
}

/* ---------------------------------------------------------------- snapshot (laptop asleep) */
function saveSnap() {
  const h = S.home; if (!h) return;
  const snap = {t: Math.floor(Date.now() / 1000), laptop: h.laptop, balances: h.balances, reels: h.reels,
    spending: h.spending && {credits: h.spending.credits, usd: h.spending.usd},
    schedule: h.schedule && {items: (h.schedule.items || []).slice(0, 30).map(i => ({day: i.day, type: i.type, status: i.status, ny: i.ny, il: i.il, title: String(i.title).slice(0, 40)}))}};
  let s = JSON.stringify(snap);
  while (s.length > 4000 && snap.schedule.items.length) { snap.schedule.items.pop(); s = JSON.stringify(snap); }
  store.set('snap', s);
}
function offline() {
  goAsleep();
  haptic('error');
  toast('📵 No connection to the laptop. Nothing was sent; what you typed is saved. Tap it again when you’re back online.', 'err', null, 6500);
}
async function goAsleep() {
  S.asleep = true;
  try { const snap = JSON.parse(await store.get('snap') || 'null'); if (snap) { S.home = snap; S.snapAt = snap.t; } } catch (e) {}
  render();  // stay on the same screen: what you typed is kept (drafts) and comes back after "Try again"
}
async function retry() { S.asleep = false; S.err = null; render(); await boot2(); }

/* ---------------------------------------------------------------- jobs */
async function run(kind, opts = {}) {
  try {
    const from = dkey('').replace(/:$/, ''), fromView = S.view;
    const j = await api('run', {kind, ...opts});
    if (S.toastObj && S.toastObj.kind === 'err') S.toastObj = null;
    if (S.asleep) { S.asleep = false; S.err = null; api('home').then(h => { S.home = h; saveSnap(); }).catch(() => {}); }
    clearDrafts(fromView === 'script' ? '\u0000' : from);
    S.jobs = [j, ...S.jobs.filter(x => x.id !== j.id)];
    S.job = j.id; S.sheet = null; go('job'); poll();
  } catch (e) { e.offline ? offline() : toast('❌ ' + e.message, 'err', null, 6000); }
}
let pollT = null;
async function poll() {
  clearTimeout(pollT);
  const running = S.jobs.filter(j => j.status === 'running');
  if (!running.length || S.asleep) return;
  for (const j of running) {
    try {
      const n = await api('job', {id: j.id});
      const i = S.jobs.findIndex(x => x.id === j.id); if (i >= 0) S.jobs[i] = n;
      if (n.status !== 'running') { haptic(n.status === 'done' ? 'success' : 'error'); if (S.view !== 'job' || S.job !== n.id) toast((n.status === 'done' ? '✅ ' : '❌ ') + n.title, n.status === 'done' ? 'ok' : 'err'); }
    } catch (e) { if (e.offline) return goAsleep(); }
  }
  if (['job', 'home', 'history'].includes(S.view)) render();
  pollT = setTimeout(poll, 2500);
}

/* ---------------------------------------------------------------- layout */
const CRS = () => (S.user && S.user.creators) || [];
const CR = () => CRS().find(c => c.id === S.cr) || CRS()[0] || {id: 'creator', name: 'Creator', handle: '', main: true};
const furl = u => !u ? null : /^https?:/.test(u) ? u : BASE + (u.startsWith('/f/') ? u : '/f/' + u);
const avatarOf = (c, sz = 34) => c && c.avatar ? `<img class="av" style="width:${sz}px;height:${sz}px" src="${esc(furl(c.avatar))}" alt="">` : `<span class="av" style="width:${sz}px;height:${sz}px">${esc(((c && c.name) || '?').slice(0, 2).toUpperCase())}</span>`;
const avatar = (sz = 34) => avatarOf(CR(), sz);
// Reels, scripts and money are only wired for the main creator's project folder so far
const notMain = () => !CR().main ? `<div class="card mut">${avatar(22)} <b>${esc(CR().name)}</b> has no project folder in the app yet: reels, scripts and money here are ${esc((CRS().find(c => c.main) || {}).name || 'the main creator')}’s. Her Metricool posts show in Schedule${CR().metricool ? '' : ' once you add her Metricool brand'}.</div>` : '';
function side() {
  const nav = (v, ic, n) => `<button class="nav ${S.view === v ? 'on' : ''}" onclick="A.go('${v}')">${ic} ${n}</button>`;
  return `<aside class="side"><div class="brand">AI OFM Creator<small>by Snoz</small></div>
    <button class="who" onclick="A.sheet('creators')">${avatar(32)}<div><b>${esc(CR().name)} ▾</b><small>${esc(CR().handle)}</small></div></button>
    ${nav('home', '🏠', 'Home')}${nav('reels', '🎬', 'Reels')}${nav('create', '➕', 'Create')}${nav('schedule', '📅', 'Schedule')}
    <div class="grp">More</div>${nav('results', '📊', 'Results')}${nav('lessons', '🧠', 'Lessons')}${nav('spending', '💰', 'Spending')}
    ${nav('history', '💬', 'Chat history')}${nav('laptop', '🤖', 'Bot + laptop')}${nav('accounts', '👥', 'Accounts')}${nav('appearance', '🎨', 'Appearance')}
    <div class="foot">${S.asleep ? '💤 Laptop asleep' : '● Laptop awake'}${S.home && S.home.laptop ? ` · ${S.home.laptop.time_ny} NY / ${S.home.laptop.time_il} IL` : ''}</div></aside>`;
}
function bar() {
  const b = S.home && S.home.balances;
  const backBtn = !TOP.includes(S.view) && !tg ? `<button class="pill" onclick="A.back()">‹ Back</button>` : '';
  return `<div class="safe-top"></div><header class="bar">${backBtn}<button class="who" onclick="A.sheet('creators')">${avatar()}<div><b>${esc(CR().name)} ▾</b><small>AI OFM Creator · by Snoz</small></div></button>
    <div class="ttl hide-phone">${esc(TITLES[S.view] || '')}</div>
    ${b && b.kie_cr != null ? `<span class="pill">💰 ${Math.round(b.kie_cr).toLocaleString('en-US')} cr ≈ ${esc(b.kie_usd)}</span>` : ''}
    ${DESKTOP ? `<button class="pill" onclick="A.sheet('wm')">${WMODES.find(m => m[0] === S.wm)[1]} ▾</button>` : ''}</header>
    ${S.asleep ? `<div class="banner">💤 Laptop asleep or offline${S.snapAt ? ` · showing the snapshot from ${clock(S.snapAt)} (${ago(S.snapAt)} ago)` : ' · no snapshot yet'}. What you type is saved; buttons retry when tapped. <u onclick="A.retry()">Try again</u></div>` : ''}
    ${S.err ? `<div class="banner err">❌ ${esc(S.err)} <u onclick="A.retry()">Retry</u></div>` : ''}`;
}
function tabs() {
  const t = (v, ic, n, cls = '') => `<button class="tab ${cls} ${S.view === v || (v === 'more' && !TOP.includes(S.view) && !['reel', 'job', 'script', 'scripts', 'copy', 'take', 'overlay', 'photos', 'upscale', 'ask', 'capcut'].includes(S.view)) ? 'on' : ''}" onclick="A.go('${v}')"><i>${ic}</i>${n}</button>`;
  return `<nav class="tabs">${t('home', '🏠', 'Home')}${t('reels', '🎬', 'Reels')}${t('create', '＋', 'Create', 'create')}${t('schedule', '📅', 'Schedule')}${t('more', '☰', 'More')}</nav>`;
}
// Telegram's own top bar, background and bottom bar follow the app's theme (and match the BotFather splash colours)
function tgColors() {
  const bg = (THEMES.find(x => x[0] === S.theme) || THEMES[0])[2];
  if (tgColors.last === bg || !tg.isVersionAtLeast) return; tgColors.last = bg;
  try { if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } if (tg.isVersionAtLeast('7.10')) tg.setBottomBarColor(bg); } catch (e) {}
}
function render() {
  document.body.className = 't-' + S.theme;
  const v = (['home', 'reels', 'create', 'scripts', 'spending'].includes(S.view) ? notMain() : '') + (V[S.view] || V.home)();
  keepFocus(() => { $app.innerHTML = side() + `<div class="col">${bar()}<main class="main">${v}</main></div>` + tabs(); restoreDrafts($app); });
  if (tg) { S.stack.length && !TOP.includes(S.view) ? tg.BackButton.show() : tg.BackButton.hide(); tgColors(); }
  drawLayer();
}
function drawLayer() {
  const sh = S.sheet ? SHEETS[S.sheet.name](S.sheet) : '';
  const t = S.toastObj ? `<div class="toast ${S.toastObj.kind}">${esc(S.toastObj.text)}${S.toastObj.undo ? '<button onclick="A.undo()">Undo</button>' : ''}</div>` : '';
  keepFocus(() => { $layer.innerHTML = (sh ? `<div class="sheet-bg" onclick="if(event.target===this)A.sheet(null)"><div class="sheet"><div class="grab"></div>${sh}</div></div>` : '') + t; restoreDrafts($layer); });
}
const loading = () => S.asleep ? `<div class="card mut">💤 Not in the snapshot. It loads when the laptop is back (anything you typed here stays).</div>` : `<div class="card mut"><span class="spin"></span> Loading…</div>`;
const dis = () => '';  // never dead buttons: a tap while offline retries, and says so if it still can't reach the laptop

/* ---------------------------------------------------------------- views */
const V = {};
V.home = () => {
  const h = S.home;
  if (!h) return loading();
  const L = h.laptop || {}, b = h.balances || {}, items = (h.schedule && h.schedule.items) || [];
  const todayNY = items.length ? items[0].day : null;
  const days = [...new Set(items.map(i => i.day))].slice(0, 3);
  const miss = items.filter(i => i.status === 'missing');
  const jobs = (h.jobs || S.jobs || []).slice(0, 5);
  const failed = jobs.filter(j => j.status === 'failed');
  const r = h.reels || {};
  const hour = new Date().getHours(), hi = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `<h1>${hi}</h1><p class="sub">${L.time_ny ? `${esc(L.time_ny)} New York · ${esc(L.time_il)} Israel` : ''}${L.power ? ` · ${L.power.charger ? '🔌 charger' : '🔋 battery'}${L.power.battery != null ? ' ' + L.power.battery + '%' : ''}` : ''}${L.disk_gb != null ? ` · ${L.disk_gb} GB free` : ''}${L.hermes === false ? ' · ⚠️ Hermes not answering' : ''}</p>
  <div class="pcgrid"><div>
  ${days.map((d, i) => { const di = items.filter(x => x.day === d); const dt = new Date(d + 'T12:00:00');
    return `<h2>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYN[(dt.getDay() + 6) % 7]} · ${DAYN[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONN[dt.getMonth()]}<span class="sp"></span>${i === 0 ? `<button class="lnk" onclick="A.go('schedule')">Schedule ›</button>` : ''}</h2>
    <div class="list">${di.map(postItem).join('') || '<div class="item mut">Nothing scheduled</div>'}</div>`; }).join('') || (h.schedule_error ? `<div class="card banner err">Metricool: ${esc(h.schedule_error)}</div>` : '')}
  </div><div>
  <h2>Missing (next 2 days)</h2>${miss.length ? `<div class="card" style="background:var(--warnbg);color:var(--warn);border-color:transparent"><b>${miss.length} empty reel slot${miss.length > 1 ? 's' : ''}</b> on ${[...new Set(miss.map(m => { const d = new Date(m.day + 'T12:00:00'); return DAYN[(d.getDay() + 6) % 7] + ' ' + d.getDate(); }))].join(', ')}.<br>Tap one in the list to fill it.</div>` : '<div class="card mut">✓ Nothing missing for the next 2 days.</div>'}
  ${r.review ? `<button class="card" style="width:100%" onclick="A.reelFilter('review')">🎬 <b>${r.review} take${r.review > 1 ? 's' : ''} waiting for your review</b> <span class="mut">›</span></button>` : ''}
  ${r.capcut ? `<button class="card" style="width:100%" onclick="A.reelFilter('capcut')">✂️ <b>${r.capcut} reel${r.capcut > 1 ? 's' : ''} ready for CapCut</b> <span class="mut">›</span></button>` : ''}
  <h2>Hermes jobs<span class="sp"></span><button class="lnk" onclick="A.go('history')">All ›</button></h2>
  ${jobs.length ? `<div class="list">${jobs.map(jobItem).join('')}</div>` : '<div class="card mut">No jobs yet. Start one from ＋ Create.</div>'}
  ${failed.length ? `<div class="card banner err">❌ ${failed.length} failed recently. Tap it to see why and try again.</div>` : ''}
  <h2>Money</h2><div class="card"><dl class="kv"><dt>kie.ai</dt><dd>${b.kie_cr != null ? `${Math.round(b.kie_cr).toLocaleString('en-US')} cr ≈ ${esc(b.kie_usd)}` : 'n/a'}</dd>
    <dt>WaveSpeed</dt><dd>${b.wavespeed_usd != null ? '$' + b.wavespeed_usd.toFixed(2) : 'n/a'}</dd>
    <dt>Spent this week</dt><dd>${h.spending ? `${Math.round(h.spending.credits).toLocaleString('en-US')} cr ≈ ${esc(h.spending.usd)}` : '–'}</dd></dl></div>
  </div></div>`;
};
const postItem = i => {
  const tag = i.status === 'posted' ? '<span class="tag ok">posted</span>' : i.status === 'failed' ? '<span class="tag err">failed</span>' : '';
  if (i.status === 'missing') return `<button class="item empty" onclick="A.fill('${esc(i.day)}','${esc(i.ny)}')"><div class="ic">＋</div><div class="tx"><b>${esc(i.title)}</b><span style="color:inherit">tap to fill it</span></div><div class="end" style="color:inherit"><b style="color:inherit">${esc(i.ny)}</b>${esc(i.il)} IL</div></button>`;
  return `<div class="item ${i.status === 'failed' ? 'failed' : ''}"><div class="ic">${ICON[i.type] || '•'}</div><div class="tx"><b>${esc(i.type)} ${tag}</b><span>${esc(i.title)}</span></div><div class="end"><b>${esc(i.ny)}</b>${esc(i.il)} IL</div></div>`;
};
const jobItem = j => `<button class="item ${j.status === 'failed' ? 'failed' : ''}" onclick="A.openJob('${j.id}')"><div class="ic">${j.status === 'running' ? '<span class="spin"></span>' : j.status === 'done' ? '✅' : '❌'}</div>
  <div class="tx"><b>${esc(j.title)}</b><span>${j.status === 'running' ? 'working… ' + ago(j.started) : j.status === 'failed' ? esc(j.error) : esc((j.answer || '').slice(0, 90))}</span></div><div class="end">${ago(j.started)}</div></button>`;

V.job = () => {
  const j = S.jobs.find(x => x.id === S.job);
  if (!j) return loading();
  const thread = S.jobs.filter(x => x.thread === j.thread).sort((a, b) => a.started - b.started);
  const last = thread[thread.length - 1];
  const cost = last.status === 'done' && last.cost_usd != null ? last.cost_usd : null;
  return `<h1>${esc(thread[0].title)}</h1><p class="sub">Hermes · ${thread.length} step${thread.length > 1 ? 's' : ''}</p>
  ${thread.map(x => `<div class="card"><div class="mut" style="font-size:12px;margin-bottom:6px">${esc(x.title)} · ${clock(x.started)}</div>
    ${x.status === 'running' ? `<div class="mut"><span class="spin"></span> Working… ${ago(x.started)} — you can close the app, Telegram tells you when it’s done.</div>`
      : x.status === 'failed' ? `<div style="color:var(--err)"><b>❌ It failed</b><br>${esc(x.error)}</div>${x.answer ? `<div class="ans" style="margin-top:8px">${md(x.answer)}</div>` : ''}`
      : `<div class="ans">${md(x.answer)}</div>`}</div>`).join('')}
  ${last.status === 'running' ? '' : `
    ${cost != null ? `<button class="btn" ${dis()} onclick="A.yes('${last.id}')">✅ Yes, spend $${cost.toFixed(2)}</button><div style="height:8px"></div>` : ''}
    ${last.status === 'failed' ? `<button class="btn" ${dis()} onclick="A.again('${last.id}')">↻ Try again</button><div style="height:8px"></div>` : ''}
    <textarea id="reply" class="field" placeholder="${cost != null ? 'Change something, or ask…' : 'Reply to Hermes…'}"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn sec" ${dis()} onclick="A.reply('${last.thread}')">Send</button>
    ${cost != null ? `<button class="btn danger" onclick="A.cancelJob('${last.thread}')">Cancel</button>` : ''}</div>`}`;
};

V.reels = () => {
  if (!S.reels) return loading();
  const chips = ['all', 'review', 'capcut', 'ready', 'scheduled', 'rejected'];
  const list = S.reels.filter(r => S.reelStage === 'all' || r.stage === S.reelStage || (S.reelStage === 'capcut' && ['approved', 'upscaled'].includes(r.stage)));
  const detail = S.reel ? reelDetail(S.reels.find(r => r.id === S.reel)) : '';
  return `<div class="chips">${chips.map(c => `<button class="chip ${S.reelStage === c ? 'on' : ''}" onclick="A.reelFilter('${c}')">${c === 'all' ? 'All' : STAGE[c][0]} ${c === 'all' ? S.reels.length : S.reels.filter(r => r.stage === c).length}</button>`).join('')}</div>
  <div class="pcgrid"><div class="list">${list.map(r => `<button class="item" onclick="A.openReel('${r.id}')"><div class="ic">🎬</div><div class="tx"><b>${esc(r.id)} · ${esc(r.slug)}</b><span>${esc(r.status)}</span></div><div class="end"><span class="tag ${STAGE[r.stage][1]}">${STAGE[r.stage][0]}</span></div></button>`).join('') || '<div class="item mut">None</div>'}</div>
  <div class="${detail ? '' : 'hide'}" id="pcdetail">${detail}</div></div>`;
};
function reelDetail(r) {
  if (!r) return '';
  const acts = {
    review: `<div class="row"><button class="btn" ${dis()} onclick="A.run('approve',{ref:'${r.id}'})">✅ Approve</button><button class="btn danger" ${dis()} onclick="A.sheet('reject','${r.id}')">✕ Reject</button></div>`,
    approved: `<button class="btn" ${dis()} onclick="A.run('upscale',{extra:'Only ${r.id}.'})">⬆️ Upscale · dry run</button>`,
    upscaled: `<button class="btn" ${dis()} onclick="A.run('capcut',{ref:'${r.id}'})">✂️ CapCut steps</button>`,
    capcut: `<button class="btn" ${dis()} onclick="A.run('capcut',{ref:'${r.id}'})">✂️ CapCut steps</button>`,
    ready: `<button class="btn" ${dis()} onclick="A.run('fill_slot',{extra:'next free reel slot, using ${r.id}'})">📅 Schedule · dry run</button>`,
  }[r.stage] || '';
  return `<div class="card">${r.video_url ? `<video controls playsinline preload="metadata" src="${esc(BASE + r.video_url)}"></video>` : '<div class="mut">No video file found.</div>'}
    <h2 style="margin-top:12px">${esc(r.id)} · ${esc(r.slug)} <span class="tag ${STAGE[r.stage][1]}">${STAGE[r.stage][0]}</span></h2>
    <p class="mut" style="margin:0 0 10px">${esc(r.status)}</p>
    <dl class="kv"><dt>Attempts</dt><dd>${r.attempts}</dd><dt>Credits</dt><dd>${Math.round(r.credits)} cr ≈ ${esc(r.credits_usd)}</dd><dt>File</dt><dd style="font-size:11.5px;word-break:break-all">${esc(r.video || '–')}</dd></dl>
    <div style="height:10px"></div>${acts}</div>`;
}
V.reel = () => reelDetail((S.reels || []).find(r => r.id === S.reel)) || loading();

V.create = () => `<h1>Create</h1><p class="sub">Everything starts as a dry run. Nothing paid runs without your yes.</p>
  <div class="grid2">${[['copy', '📥', 'Copy a reel or post', 'Paste an Instagram link'], ['scripts', '📝', 'Script ideas', 'Your scripts + new ideas'],
    ['take', '🎬', 'Talking-head take', 'Pick a script → dry run'], ['overlay', '🔤', 'Overlay clip', 'Type the text → dry run'],
    ['photos', '📸', 'Photo ideas', 'From Threads inspiration'], ['upscale', '⬆️', 'Upscale queue', 'Approved takes → 1080p'],
    ['capcut', '✂️', 'CapCut', 'Finishing steps'], ['ask', '💬', 'Ask Hermes', 'Anything else']].map(([v, ic, n, d]) =>
    `<button class="tile" onclick="A.go('${v}')"><span class="ic">${ic}</span><b>${n}</b><span>${d}</span></button>`).join('')}</div>`;
V.copy = () => `<h1>Copy a reel or post</h1><p class="sub">Download without login first (spare account only if blocked). Stops at the plan with the cost.</p>
  <input id="link" class="field" placeholder="https://www.instagram.com/reel/…" inputmode="url"><div style="height:10px"></div>
  <textarea id="note" class="field" style="min-height:70px" placeholder="Notes for Hermes (optional)"></textarea><div style="height:10px"></div>
  <button class="btn" ${dis()} onclick="A.copy()">Make the plan</button>`;
V.scripts = () => !S.scripts ? loading() : `<h1>Scripts</h1><p class="sub">reel-scripting bank · 30–42 spoken words</p>
  <button class="btn" ${dis()} onclick="A.run('ideas')">✨ 3 new ideas for tomorrow</button><div style="height:12px"></div>
  <div class="list">${S.scripts.map(s => `<button class="item" onclick="A.openScript('${esc(s.id)}')"><div class="ic">📝</div><div class="tx"><b>${esc(s.id)} · ${esc(s.hook)}</b><span>${s.words} words · ${esc(s.approval)}${s.production ? ' · ' + esc(s.production) : ''}</span></div><div class="end">›</div></button>`).join('') || '<div class="item mut">No scripts</div>'}</div>`;
V.script = () => {
  const s = (S.scripts || []).find(x => x.id === S.script);
  if (!s) return loading();
  const n = words(s.hook + ' ' + s.body);
  return `<h1>${esc(s.id)}</h1><p class="sub">${esc(s.format)} · ${esc(s.approval)} · caption “${esc(s.caption)}”</p>
  <label class="mut">Hook</label><textarea id="ed-h" class="field" style="min-height:60px" oninput="A.count()">${esc(s.hook)}</textarea><div style="height:8px"></div>
  <label class="mut">Body</label><textarea id="ed-b" class="field" style="min-height:140px" oninput="A.count()">${esc(s.body)}</textarea>
  <p id="ed-n" class="mut">reel-scripting keeps 30–42 spoken words · ${n} now ${n >= 30 && n <= 42 ? '✓' : '⚠️'}</p>
  <div class="row"><button class="btn" ${dis()} onclick="A.saveScript('${esc(s.id)}')">Save</button><button class="btn sec" ${dis()} onclick="A.rewrite('${esc(s.id)}')">✨ Ask Hermes to rewrite</button></div><div style="height:8px"></div>
  <div class="row"><button class="btn sec" ${dis()} onclick="A.run('take',{ref:'${esc(s.id)}'})">🎬 Make a take · dry run</button><button class="btn danger" ${dis()} onclick="A.sheet('delscript','${esc(s.id)}')">🗑 Delete</button></div>`;
};
V.take = () => !S.scripts ? loading() : `<h1>Talking-head take</h1><p class="sub">Pick a script. Hermes does a dry run (scene, DELIVERY line, cost) and waits for your yes.</p>
  <div class="list">${S.scripts.map(s => `<button class="item" ${dis()} onclick="A.run('take',{ref:'${esc(s.id)}'})"><div class="ic">🎬</div><div class="tx"><b>${esc(s.id)} · ${esc(s.hook)}</b><span>${s.words} words · ${esc(s.production || s.approval)}</span></div><div class="end">Dry run ›</div></button>`).join('')}</div>`;
V.overlay = () => `<h1>Overlay clip</h1><p class="sub">text-overlay skill · dry run with the cost first.</p>
  <textarea id="ovl" class="field" placeholder="The text on the clip, and the idea for the shot"></textarea><div style="height:10px"></div>
  <button class="btn" ${dis()} onclick="A.runText('overlay','ovl')">Dry run</button>`;
const jobsOf = kinds => (S.jobs || []).filter(j => kinds.includes(j.kind));
const jobList = kinds => { const js = jobsOf(kinds); return js.length ? `<h2>Earlier</h2><div class="list">${js.slice(0, 10).map(jobItem).join('')}</div>` : ''; };
V.photos = () => `<h1>Photo ideas</h1><p class="sub">photo-inspiration skill (Threads). Recreation runs on the laptop through WSL.</p>
  <textarea id="ph" class="field" style="min-height:70px" placeholder="Anything to focus on (optional)"></textarea><div style="height:10px"></div>
  <button class="btn" ${dis()} onclick="A.runText('photos','ph',true)">Find photo ideas</button>${jobList(['photos'])}`;
V.upscale = () => `<h1>Upscale queue</h1><p class="sub">video-upscale · approved takes only · dry run with the cost first.</p>
  <button class="btn" ${dis()} onclick="A.run('upscale')">Show the queue + cost</button>${jobList(['upscale'])}`;
V.capcut = () => !S.reels ? loading() : `<h1>CapCut</h1><p class="sub">capcut-finishing · get the steps, edit in CapCut Pro, then upload the export here (no Telegram size limit while the laptop is on).</p>
  ${S.upl ? `<div class="card"><b>Uploading ${esc(S.upl.name)}</b><div class="mut">${S.upl.pct}%</div></div>` : ''}
  <div class="list">${S.reels.filter(r => ['capcut', 'upscaled', 'approved'].includes(r.stage)).map(r => `<div class="item"><div class="ic">✂️</div><div class="tx"><b>${esc(r.id)} · ${esc(r.slug)}</b><span>${esc(r.status)}</span></div>
    <div class="end" style="display:flex;gap:6px"><button class="btn small sec" ${dis()} onclick="A.run('capcut',{ref:'${r.id}'})">Steps</button><button class="btn small" ${dis()} onclick="A.pickFinal('${r.id}')">⬆ Final</button></div></div>`).join('') || '<div class="item mut">Nothing waiting for CapCut</div>'}</div>
  <button class="btn sec" ${dis()} onclick="A.pickFinal('')">⬆ Upload another export</button>`;
V.ask = () => `<h1>Ask Hermes</h1><p class="sub">Same Hermes, skills and rules as on the laptop.</p>
  <textarea id="askt" class="field" placeholder="Ask or tell Hermes anything…"></textarea><div style="height:10px"></div>
  <button class="btn" ${dis()} onclick="A.runText('ask','askt')">Send</button>${jobList(['ask'])}`;

/* ---------------------------------------------------------------- schedule */
const nyToday = () => { const p = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()); return new Date(p + 'T12:00:00'); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekStart(off) { const d = nyToday(); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + 7 * off); return d; }
function weekLabel(off) { const a = weekStart(off), b = new Date(a); b.setDate(a.getDate() + 6);
  const range = a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONN[b.getMonth()]}` : `${a.getDate()} ${MONN[a.getMonth()]} – ${b.getDate()} ${MONN[b.getMonth()]}`;
  return {range: range + ' ' + b.getFullYear(), tag: off === 0 ? 'This week' : off === -1 ? 'Last week' : off === 1 ? 'Next week' : off < 0 ? `${-off} weeks ago` : `In ${off} weeks`}; }
async function loadWeek(sync = false) {
  const a = weekStart(S.sched.wk), b = new Date(a); b.setDate(a.getDate() + 6);
  S.sched.loading = true; render();
  try {
    S.sched.data = await api('schedule', {from: iso(a), to: iso(b), sync});
    S.err = null;
    if (sync) { haptic('success'); toast(`✅ Synced with Metricool · ${S.sched.data.items.filter(i => i.status !== 'missing').length} posts this week`, 'ok'); }
  } catch (e) {
    if (e.offline) { S.sched.loading = false; return sync ? offline() : goAsleep(); }
    if (sync) { haptic('error'); toast('❌ Sync failed · ' + e.message + ' · nothing changed', 'err', null, 7000); } else S.err = e.message;
  }
  S.sched.loading = false; render();
}
const SEL = k => k === 'creators' ? S.sched.sm : k === 'types' ? S.sched.types : S.sched.stat;
function ddBtn(key, label, items) {
  const n = items.filter(x => x[2]).length;
  const val = n === items.length ? 'All' : n === 0 ? 'None' : n === 1 ? items.find(x => x[2])[3] : `${n} selected`;
  return `<button class="ddb ${S.sched.dd === key ? 'open' : ''}" onclick="A.dd('${key}')"><small>${label}</small><b>${esc(val)} ▾</b></button>`;
}
function ddPanel(key, label, items) {
  const q = (S.sched.ddq[key] || '').toLowerCase();
  return `<div class="ddp"><input class="field" style="padding:9px 11px" placeholder="Search ${label.toLowerCase()}…" value="${esc(S.sched.ddq[key] || '')}" oninput="A.ddq('${key}',this)">
    <div class="ddrow"><button onclick="A.ddAll('${key}',true)">Select all</button><button onclick="A.ddAll('${key}',false)">Clear</button></div>
    ${items.map(([v, l, c, txt]) => `<button class="ddi" data-txt="${esc(txt.toLowerCase())}" ${q && !txt.toLowerCase().includes(q) ? 'hidden' : ''} onclick="A.ddv('${key}','${v}')"><span class="cb ${c ? 'on' : ''}">✓</span>${l}</button>`).join('')}
    <button class="btn small sec" style="width:100%;margin-top:6px" onclick="A.dd(null)">Done</button></div>`;
}
V.schedule = () => {
  const s = S.sched, wl = weekLabel(s.wk), ws = weekStart(s.wk);
  const cr = (CRS().length ? CRS() : [CR()]).map(c => [c.id, `${avatarOf(c, 22)}<span>${esc(c.name)}</span>`, !!s.sm[c.id], c.name]);
  const ty = TYPES.map(t => [t, `<span>${ICON[t]} ${t === 'Story' ? 'Stories' : t + 's'}</span>`, s.types[t], t === 'Story' ? 'Stories' : t + 's']);
  const st = STATS.map(([k, l]) => [k, `<span class="sdot s-${k}"></span><span>${l}</span>`, s.stat[k], l]);
  const all = (s.data && s.data.items) || [];
  const rows = all.filter(i => s.sm[i.creator] && s.types[i.type] && s.stat[i.status]);
  const cnt = k => rows.filter(r => r.status === k).length;
  const dayIso = i => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; };
  const today = iso(nyToday());
  return `<div class="wnav"><button onclick="A.wk(-1)" aria-label="Previous week">‹</button><div class="wl"><b>${wl.range}</b><span>${wl.tag}${s.wk ? ' · <u onclick="A.wk(0)">today</u>' : ''}</span></div><button onclick="A.wk(1)" aria-label="Next week">›</button></div>
  <div class="ddbar">${ddBtn('creators', 'Creators', cr)}${ddBtn('types', 'Type', ty)}${ddBtn('stat', 'Status', st)}
    <button class="btn small sec" ${dis()} onclick="A.sync()">${s.loading ? '<span class="spin"></span>' : '⟳'} Sync</button></div>
  ${s.dd ? ddPanel(s.dd, {creators: 'Creators', types: 'Type', stat: 'Status'}[s.dd], {creators: cr, types: ty, stat: st}[s.dd]) : ''}
  <p class="sub" style="margin:10px 0 4px">${s.data ? `${cnt('scheduled')} scheduled · ${cnt('missing')} missing · ${cnt('posted')} posted${cnt('failed') ? ` · ${cnt('failed')} failed` : ''} · New York first, Israel under it${s.data.synced_at ? ` · synced ${clock(s.data.synced_at)}` : ''}` : s.loading ? 'Loading Metricool…' : ''}</p>
  <div class="daylist">${DAYN.map((dn, i) => { const d = dayIso(i), dr = rows.filter(r => r.day === iso(d)); if (!dr.length) return '';
    return `<div class="day">${dn} ${d.getDate()} ${MONN[d.getMonth()]}<span>${iso(d) === today ? 'today' : ''}</span></div><div class="list">${dr.map(postItem).join('')}</div>`; }).join('') || (s.data ? '<div class="card mut">Nothing matches the filters.</div>' : '')}</div>
  <div class="week">${DAYN.map((dn, i) => { const d = dayIso(i), dr = rows.filter(r => r.day === iso(d));
    return `<div class="dayc ${iso(d) === today ? 'today' : ''}"><h4>${dn} ${d.getDate()}<span>${iso(d) === today ? 'today' : MONN[d.getMonth()]}</span></h4>
    ${dr.map(r => r.status === 'missing' ? `<button class="post missing" onclick="A.fill('${r.day}','${esc(r.ny)}')"><b>＋ Empty reel slot</b><div class="t">${esc(r.ny)} NY · ${esc(r.il)} IL</div></button>`
      : `<div class="post ${r.status}"><b>${ICON[r.type]} ${r.type}${r.status === 'posted' ? ' · ✓' : r.status === 'failed' ? ' · ❌' : ''}</b>${esc(r.title)}<div class="t">${esc(r.ny)} NY · ${esc(r.il)} IL</div></div>`).join('')}</div>`; }).join('')}</div>`;
};

V.addcreator = () => `<h1>Add a creator</h1><p class="sub">She shows up in the creator switch and in Schedule. Making her content (persona, reference images, reels) is set up with Hermes after this.</p>
  <label class="mut">Name</label><input id="nc-n" class="field" placeholder="e.g. Mia"><div style="height:8px"></div>
  <label class="mut">Instagram handle</label><input id="nc-h" class="field" placeholder="@handle"><div style="height:8px"></div>
  <label class="mut">Metricool brand id (optional)</label><input id="nc-b" class="field" inputmode="numeric" placeholder="the number after blogId= in Metricool’s address">
  <p class="mut" style="margin:6px 0 12px">Without it her schedule stays empty; add it later by adding her again.</p>
  <button class="btn" onclick="A.addCreator()">＋ Add her</button>`;
V.creatordone = () => { const c = CRS().find(x => x.id === S.cr) || CR(); return `<h1>${avatar(40)} ${esc(c.name)} added</h1>
  <div class="list"><button class="item" onclick="A.pickAvatar('${esc(c.id)}')"><div class="ic">📷</div><div class="tx"><b>${c.avatar ? 'Change her photo' : 'Add her photo'}</b><span>JPG or PNG, square works best</span></div><div class="end">›</div></button></div>
  <h2>Next: her project</h2><p class="sub">Hermes plans the folder, persona and the five reference images. Free until you say yes; images are paid.</p>
  <button class="btn" onclick="A.run('ask',{extra:${esc(JSON.stringify(`Set up a new AI model for the AI OFM Creator app: name ${c.name}, Instagram ${c.handle || '(none yet)'}. Plan only, change nothing yet: her project folder next to the main creator's project, what the persona needs from me, and the reference-images skill plan with its cost (dry run). Ask me what you need.`))}})">🧭 Plan her project with Hermes</button>`; };

/* ---------------------------------------------------------------- more */
V.more = () => `<h1>More</h1><div class="list">${[['results', '📊', 'Results', 'Last 7 days · what to make next'], ['lessons', '🧠', 'Lessons', 'Your corrections → skill changes'],
  ['spending', '💰', 'Spending', 'Credits and $ this week'], ['history', '💬', 'Chat history', 'Every Hermes job from the app'],
  ['laptop', '🤖', 'Bot + laptop', 'Status, power, disk'], ['accounts', '👥', 'Accounts', 'Verified Telegram accounts'], ['appearance', '🎨', 'Appearance', 'Theme' + (DESKTOP ? ' · PC window' : '')]]
  .map(([v, ic, n, d]) => `<button class="item" onclick="A.go('${v}')"><div class="ic">${ic}</div><div class="tx"><b>${n}</b><span>${d}</span></div><div class="end">›</div></button>`).join('')}</div>`;
V.results = () => `<h1>Results</h1><p class="sub">performance-review skill reads Metricool and tells you what to make next.</p>
  <button class="btn" ${dis()} onclick="A.run('results')">📊 Review the last 7 days</button>${jobList(['results'])}`;
V.lessons = () => !S.lessons ? loading() : `<h1>Lessons</h1><p class="sub">From ${esc(S.lessons.path)}</p>
  ${S.lessons.items.length ? `<div class="list">${S.lessons.items.map(l => `<div class="item"><div class="ic">🧠</div><div class="tx" style="white-space:normal"><span style="white-space:normal;color:var(--ink)">${esc(l)}</span></div></div>`).join('')}</div>
  <button class="btn" ${dis()} onclick="A.run('ask',{extra:'Show the lessons in My AI Model\\\\Telegram\\\\lessons-inbox.md that are not applied yet. For each: my words, the skill, and the exact proposed change. Change nothing until I say which to apply.'})">Review them with Hermes</button>`
  : '<div class="card mut">No lessons yet. When you correct Hermes, your words are saved here and turned into proposed skill changes.</div>'}`;
V.spending = () => { const s = S.spend; if (!s) return loading(); const b = s.balances || {};
  return `<h1>Spending</h1><p class="sub">Last ${s.days} days, from the attempt log (what kie.ai charged).</p>
  <div class="grid2"><div class="card"><div class="mut">This week</div><div class="big">${esc(s.usd)}</div><div class="mut">${Math.round(s.credits).toLocaleString('en-US')} cr</div></div>
  <div class="card"><div class="mut">kie.ai balance</div><div class="big">${b.kie_cr != null ? esc(b.kie_usd) : 'n/a'}</div><div class="mut">${b.kie_cr != null ? Math.round(b.kie_cr).toLocaleString('en-US') + ' cr' : esc((b.errors || []).join(', '))}</div></div>
  <div class="card"><div class="mut">WaveSpeed</div><div class="big">${b.wavespeed_usd != null ? '$' + b.wavespeed_usd.toFixed(2) : 'n/a'}</div><div class="mut">upscales</div></div></div>
  <h2>Where it went</h2><div class="list">${s.by_reel.map(r => `<div class="item"><div class="ic">🎬</div><div class="tx"><b>${esc(r.id)}</b></div><div class="end"><b>${esc(r.usd)}</b>${Math.round(r.credits)} cr</div></div>`).join('') || '<div class="item mut">Nothing spent this week</div>'}</div>
  <p class="mut">Warning above $10 (2,000 cr) per request · no daily cap · 1 cr ≈ $0.005.</p>`; };
V.history = () => `<h1>Chat history</h1><p class="sub">Every Hermes job started from the app.</p>${(S.jobs || []).length ? `<div class="list">${S.jobs.map(jobItem).join('')}</div>` : '<div class="card mut">Nothing yet.</div>'}`;
V.laptop = () => { const l = (S.laptop || {}).laptop || (S.home || {}).laptop; if (!l) return loading();
  return `<h1>Bot + laptop</h1><div class="card"><dl class="kv"><dt>Laptop</dt><dd>${S.asleep ? '💤 asleep' : '● awake'}</dd><dt>Power</dt><dd>${l.power && l.power.charger ? '🔌 charger' : '🔋 battery'}${l.power && l.power.battery != null ? ' · ' + l.power.battery + '%' : ''}</dd>
  <dt>Disk</dt><dd>${l.disk_gb} GB free</dd><dt>Hermes</dt><dd>${l.hermes ? '● answering' : '⚠️ not answering'}</dd><dt>App server</dt><dd>up ${ago(Date.now() / 1000 - l.app_uptime_s)}</dd>
  <dt>Time</dt><dd>${esc(l.time_ny)} NY · ${esc(l.time_il)} IL</dd><dt>Briefs</dt><dd>09:00 + 21:00 Israel</dd></dl></div>
  <p class="mut">Awake while the charger is in. On battery it sleeps; Telegram keeps your chat messages for 24 h.</p>`; };
V.accounts = () => !S.accounts ? loading() : `<h1>Accounts</h1><div class="list">${S.accounts.map(a => `<div class="item"><div class="ic">👤</div><div class="tx"><b>${esc(a.name || 'Account')}${String(a.id) === String(S.user && S.user.id) ? ' · you' : ''}</b><span>id ${esc(a.id)}${a.since ? ' · since ' + new Date(a.since * 1000).toLocaleDateString('en-GB') : ''}</span></div></div>`).join('')}</div>
  <p class="mut">A new account sends /unlock with the password in the bot chat; you get an alert. Remove one with /accounts remove &lt;id&gt; in the chat.</p>`;
V.appearance = () => `<h1>Appearance</h1><p class="sub">Saved to your Telegram account: the same on the phone and the PC.</p>
  <div class="list">${THEMES.map(([k, n, bg, ac]) => `<button class="item" onclick="A.theme('${k}')"><div class="ic" style="background:linear-gradient(90deg,${bg} 55%,${ac} 55%);border:1px solid var(--line)"></div><div class="tx"><b>${n}</b></div><div class="end" style="color:var(--accent);font-size:16px">${S.theme === k ? '✓' : ''}</div></button>`).join('')}</div>
  ${DESKTOP ? `<h2>On the PC, open the app as</h2><div class="list">${WMODES.map(([k, i, n, d]) => `<button class="item" onclick="A.wm('${k}')"><div class="ic">${i}</div><div class="tx" style="white-space:normal"><b>${n}</b><span style="white-space:normal">${d}</span></div><div class="end" style="color:var(--accent);font-size:16px">${S.wm === k ? '✓' : ''}</div></button>`).join('')}</div>` : ''}`;

/* ---------------------------------------------------------------- sheets */
const SHEETS = {
  creators: () => `<h3>Creators</h3><div class="list">${CRS().map(c => `<button class="item" onclick="A.pickCreator('${esc(c.id)}')">${avatarOf(c, 34)}<div class="tx"><b>${esc(c.name)}${c.main ? ' · main' : ''}</b><span>${esc(c.handle || '')}${c.metricool ? ' · Metricool ✓' : ' · no Metricool brand'}</span></div><div class="end">${c.id === CR().id ? '✓' : ''}</div></button>`).join('')}
    <button class="item" onclick="A.sheet(null);A.go('addcreator')"><div class="ic">＋</div><div class="tx"><b>Add a creator</b><span>Name, Instagram, Metricool brand, photo</span></div><div class="end">›</div></button></div>`,
  wm: () => `<h3>Open the app as</h3>${WMODES.map(([k, i, n, d]) => `<button class="item" onclick="A.wm('${k}')"><div class="ic">${i}</div><div class="tx" style="white-space:normal"><b>${n}</b><span style="white-space:normal">${d}</span></div><div class="end">${S.wm === k ? '✓' : ''}</div></button>`).join('')}`,
  reject: s => `<h3>Reject ${esc(s.arg)}?</h3><p class="mut">The take moves to Reels/Raw/Rejected (nothing is deleted). A new attempt needs a new dry run and your yes.</p>
    <textarea id="why" class="field" placeholder="Why? (Hermes logs your words)"></textarea><div style="height:10px"></div>
    <div style="display:grid;gap:8px"><button class="btn sec" onclick="A.sheet(null)">Keep it</button><button class="btn" style="background:var(--err)" onclick="A.reject('${esc(s.arg)}')">Reject the take</button></div>`,
  delscript: s => `<h3 style="color:var(--err)">🗑 Delete ${esc(s.arg)}?</h3><p class="mut">It moves to the bank’s Deleted file on the laptop (nothing is erased). You can undo it for 10 seconds.</p>
    <div style="display:grid;gap:8px"><button class="btn sec" onclick="A.sheet(null)">Keep it</button><button class="btn" style="background:var(--err)" onclick="A.delScript('${esc(s.arg)}')">Delete script</button></div>`,
  over10: s => `<h3>⚠️ This costs $${s.arg.cost.toFixed(2)}</h3><p class="mut">Above your $10 warning line. One yes = one paid attempt.</p>
    <div style="display:grid;gap:8px"><button class="btn" onclick="A.yesGo('${s.arg.id}')">Yes, spend $${s.arg.cost.toFixed(2)}</button>
    <button class="btn sec" onclick="A.yesGo('${s.arg.id}','Make only 1 take instead of the full batch (one paid attempt).')">Make 1 take</button><button class="btn danger" onclick="A.sheet(null)">Cancel</button></div>`,
  fill: s => `<h3>Fill the ${esc(s.arg.day)} · ${esc(s.arg.ny)} NY slot</h3><p class="mut">Hermes picks a ready reel (or says what to make) and shows a metricool-scheduler dry run. Nothing is scheduled without your yes.</p>
    <button class="btn" onclick="A.run('fill_slot',{extra:'${esc(s.arg.day)} ${esc(s.arg.ny)} New York reel'})">Ask Hermes</button>`,
};

/* ---------------------------------------------------------------- actions */
let lastDeleted = null;
const A = window.A = {
  go, back, retry, run,
  sheet(name, arg) { S.sheet = name ? {name, arg} : null; drawLayer(); },
  openJob(id) { S.job = id; go('job'); },
  openReel(id) { S.reel = id; if (window.innerWidth >= 900) render(); else go('reel'); },
  reelFilter(c) { S.reelStage = c; if (S.view !== 'reels') go('reels'); else render(); },
  openScript(id) { S.script = id; go('script'); },
  fill(day, ny) { A.sheet('fill', {day, ny}); },
  count() { const n = words(document.getElementById('ed-h').value + ' ' + document.getElementById('ed-b').value);
    document.getElementById('ed-n').textContent = `reel-scripting keeps 30–42 spoken words · ${n} now ${n >= 30 && n <= 42 ? '✓' : '⚠️'}`; },
  async saveScript(id) {
    try { const r = await api('script_save', {id, hook: document.getElementById('ed-h').value, body: document.getElementById('ed-b').value});
      if (!r.ok) throw new Error(r.error); const s = S.scripts.find(x => x.id === id);
      s.hook = document.getElementById('ed-h').value.trim(); s.body = document.getElementById('ed-b').value.trim(); s.words = r.words; clearDrafts(`script:${id}:`); toast(`✅ ${id} saved · ${r.words} words`, 'ok');
    } catch (e) { e.offline ? offline() : toast('❌ Not saved · ' + e.message, 'err'); }
  },
  rewrite(id) { run('rewrite', {ref: id, extra: document.getElementById('ed-h').value + ' ' + document.getElementById('ed-b').value}); },
  async delScript(id) {
    try { const r = await api('script_delete', {id}); if (!r.ok) throw new Error(r.error);
      lastDeleted = id; S.scripts = S.scripts.filter(s => s.id !== id); S.sheet = null; S.view = 'scripts'; S.stack = ['create']; render();
      toast(`🗑 ${id} deleted`, '', true, 10000);
    } catch (e) { e.offline ? offline() : toast('❌ Not deleted · ' + e.message, 'err'); }
  },
  async undo() { if (!lastDeleted) return; const id = lastDeleted; lastDeleted = null;
    try { const r = await api('script_restore', {id}); if (!r.ok) throw new Error(r.error); S.scripts = (await api('scripts')).scripts; toast(`↩ ${id} restored`, 'ok'); render(); }
    catch (e) { toast('❌ ' + e.message, 'err'); } },
  copy() { const l = document.getElementById('link').value.trim(); if (!/^https?:\/\/(www\.)?instagram\.com\//.test(l)) return toast('Paste an Instagram link first.', 'err');
    run('copy', {extra: l + (document.getElementById('note').value.trim() ? '\nNotes: ' + document.getElementById('note').value.trim() : '')}); },
  runText(kind, id, optional = false) { const t = document.getElementById(id).value.trim(); if (!t && !optional) return toast('Type something first.', 'err'); run(kind, {extra: t}); },
  reply(thread) { const t = document.getElementById('reply').value.trim(); if (!t) return toast('Type a reply first.', 'err'); run('reply', {extra: t, thread}); },
  again(id) { const j = S.jobs.find(x => x.id === id); run(j.kind === 'yes' ? 'reply' : 'reply', {extra: 'Try that again. ' + (j.kind === 'yes' ? 'This is a paid step: show a new dry run and wait for my yes.' : ''), thread: j.thread}); },
  cancelJob(thread) { run('reply', {extra: 'Cancel. Don’t run anything paid for this.', thread}); },
  yes(id) { const j = S.jobs.find(x => x.id === id); if (j.cost_usd > 10) return A.sheet('over10', {id, cost: j.cost_usd}); A.yesGo(id); },
  yesGo(id, extra = '') { const j = S.jobs.find(x => x.id === id); S.sheet = null; run('yes', {thread: j.thread, extra}); },
  reject(id) { const why = document.getElementById('why').value.trim(); if (!why) return toast('Say why (Hermes logs it).', 'err'); run('reject', {ref: id, extra: why}); },
  wk(n) { S.sched.wk = n === 0 ? 0 : S.sched.wk + n; S.sched.dd = null; S.sched.data = null; loadWeek(); },
  sync() { loadWeek(true); },
  dd(k) { S.sched.dd = S.sched.dd === k ? null : k; render(); },
  ddv(k, v) { const b = SEL(k); b[v] = !b[v]; render(); },
  ddAll(k, on) { const b = SEL(k); Object.keys(b).forEach(x => b[x] = on); render(); },
  ddq(k, el) { S.sched.ddq[k] = el.value; const q = el.value.toLowerCase(); el.closest('.ddp').querySelectorAll('.ddi').forEach(x => x.hidden = !!q && !x.dataset.txt.includes(q)); },
  theme(k) { S.theme = k; store.set('theme', k); render(); },
  async wm(k) {
    S.wm = k; store.set('wm', k); S.sheet = null; render();
    if (!tg) return;
    if (k === 'full') { if (tg.requestFullscreen && tg.isVersionAtLeast('8.0')) tg.requestFullscreen(); }
    else if (tg.isFullscreen) tg.exitFullscreen();
    if (k === 'browser') A.openBrowser();
  },
  pickFinal(reel) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/mp4,video/quicktime,.mp4,.mov';
    inp.onchange = () => { const f = inp.files[0]; if (f) A.upload(reel, f); }; inp.click();
  },
  upload(reel, f) {
    if (f.size > 95 * 1024 * 1024) return toast('❌ Over 95 MB: the tunnel can’t take it. Export at 1080p / 30 fps.', 'err', null, 7000);
    const x = new XMLHttpRequest();
    x.open('PUT', `${BASE}/api/upload?reel=${encodeURIComponent(reel)}&name=${encodeURIComponent(f.name)}`);
    x.setRequestHeader('X-Init-Data', initData); x.withCredentials = SAME_ORIGIN;
    S.upl = {name: f.name, pct: 0}; render();
    x.upload.onprogress = e => { if (e.lengthComputable) { S.upl.pct = Math.round(e.loaded / e.total * 100); render(); } };
    x.onload = () => { S.upl = null; let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 200) { haptic('success'); S.jobs = [j.job, ...S.jobs]; S.job = j.job.id; toast('✅ Uploaded · Hermes is checking it', 'ok'); go('job'); poll(); }
      else { haptic('error'); toast('❌ Upload failed · ' + (j.error || 'HTTP ' + x.status), 'err', null, 7000); render(); } };
    x.onerror = () => { S.upl = null; offline(); };
    x.send(f);
  },
  pickCreator(id) {
    S.cr = id; store.set('creator', id); S.sheet = null;
    if (S.sched && S.sched.sm) { /* show the picked creator in Schedule too */ S.sched.sm[id] = true; }
    render(); toast(`${CR().name}`, 'ok');
  },
  async addCreator() {
    const v = id => (document.getElementById(id) || {}).value || '';
    try {
      const r = await api('creator_add', {name: v('nc-n'), handle: v('nc-h'), blog_id: v('nc-b')});
      S.user.creators = r.creators; S.cr = r.creator.id; store.set('creator', S.cr); S.sched.sm[S.cr] = true; S.sched.data = null;
      clearDrafts('addcreator:'); haptic('success'); toast(`✅ ${r.creator.name} added`, 'ok'); go('creatordone');
    } catch (e) { e.offline ? offline() : toast('❌ ' + e.message, 'err'); }
  },
  pickAvatar(cid) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) return toast('❌ The photo must be under 5 MB.', 'err');
      putRaw(`avatar?creator=${encodeURIComponent(cid)}`, f).then(j => { S.user.creators = j.creators; haptic('success'); toast('✅ Photo saved', 'ok'); render(); })
        .catch(e => e.offline ? offline() : toast('❌ ' + e.message, 'err')); };
    inp.click();
  },
  async mic(id) {
    if (S.rec) return stopRec();
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('🎤 This Telegram can’t record inside apps. Send a voice note in the bot chat instead.', 'err', null, 6500);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
    catch (e) { return toast('🎤 No microphone access. Allow it for Telegram in the phone’s settings, or send a voice note in the chat.', 'err', null, 7000); }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', ''].find(t => !t || MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, type ? {mimeType: type} : undefined), chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, {type: mr.mimeType || 'audio/webm'}); S.rec = null; S.stt = id; render();
      if (blob.size < 2000) { S.stt = null; render(); return toast('🎤 Too short. Tap, speak, tap again.', 'err'); }
      try {
        const j = await putRaw('voice', blob);
        const el = document.getElementById(id); S.stt = null;
        if (!j.text) { render(); return toast('🎤 Didn’t catch any words. Try again a bit closer.', 'err'); }
        const cur = (el ? el.value : DRAFTS[dkey(id)] || '').trim(), val = (cur ? cur + ' ' : '') + j.text;
        DRAFTS[dkey(id)] = val; saveDrafts(); render(); haptic('success');
        const n = document.getElementById(id); if (n) { n.value = val; n.focus(); }
      } catch (e) { S.stt = null; render(); e.offline ? offline() : toast('❌ ' + e.message, 'err'); }
    };
    S.rec = {id, mr, t0: Date.now()}; mr.start(); haptic('light'); render();
    S.rec.timer = setInterval(() => { const b = document.querySelector('.mic.rec'); if (b) b.textContent = '⏹ ' + Math.floor((Date.now() - S.rec.t0) / 1000) + 's'; if (Date.now() - S.rec.t0 > 300000) stopRec(); }, 500);
  },
  async openBrowser() {
    try { const r = await api('browser_link'); tg.openLink(BASE + r.path); toast('🖥 Opening in your browser… maximize it once; the browser keeps the size.', 'ok'); }
    catch (e) { toast('❌ ' + e.message, 'err'); }
  },
};

/* ---------------------------------------------------------------- boot */
async function boot2() {
  try {
    const h = await api('hello');
    S.user = h; S.avatar = furl(h.avatar); S.cr = (await store.get('creator')) || S.cr;
    if (!(h.creators || []).some(c => c.id === S.cr)) S.cr = ((h.creators || [])[0] || {}).id; (h.creators || []).forEach(c => { if (!(c.id in S.sched.sm)) S.sched.sm[c.id] = true; }); S.asleep = false; S.err = null;
    render(); load(S.view);
    S.jobs = (await api('jobs')).jobs; poll();
  } catch (e) {
    if (e.offline || !BASE && !SAME_ORIGIN) goAsleep();
    else { S.err = e.message; render(); }
  }
}
async function boot() {
  S.theme = (await store.get('theme')) || 'creator';
  S.wm = (await store.get('wm')) || 'full';
  if (tg) {
    tg.ready(); tg.expand();
    tg.BackButton.onClick(back);
    if (DESKTOP && S.wm === 'full' && tg.requestFullscreen && tg.isVersionAtLeast('8.0')) tg.requestFullscreen();
  }
  if (!tg && !SAME_ORIGIN) { $app.innerHTML = '<div class="boot">Open this app from the AI OFM Creator bot in Telegram.</div>'; return; }
  BASE = await pickBase();
  if (!BASE && !SAME_ORIGIN) await discover();
  render();
  await boot2();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S.asleep) { load(S.view); poll(); } });
}
boot();
})();
