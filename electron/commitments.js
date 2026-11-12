const { app, ipcMain, Notification } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX_IGNORED = 3;
const WAIT_MIN = Number(process.env.NUDGE_WAIT_MIN) || 10;
const PERS = ['Me'];
const LANGS = ['English', 'Hindi', 'Kannada'];
const STOP = /(stop|don'?t|no more)\s+(reminding|nudging|remind)|stop reminders|रिमाइंडर?\s*(मत|बंद)|याद\s*मत\s*दिला|ನೆನಪಿಸ\s*ಬೇಡ|ನೆನಪಿಸಬೇಡ/i;

let items = [], globalPause = false, active = null, justPaused = null, api;
const file = () => path.join(app.getPath('userData'), 'commitments.json');
const load = () => { try { items = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { items = []; } };
const save = () => fs.writeFileSync(file(), JSON.stringify(items, null, 2));
const log = (c, ev) => c.log.push({ at: new Date().toISOString(), ev });
const push = () => { const w = api.getWin(); if (w) w.webContents.send('commitments', items); };

function nudgeText(c) {
  if (c.language === 'Hindi') return `अरे! आपने प्लान किया था: ${c.task}. शुरू करें?`;
  if (c.language === 'Kannada') return `ಹೇ! ನೀವು ಯೋಜಿಸಿದ್ದೀರಿ: ${c.task}. ಶುರು ಮಾಡೋಣವಾ?`;
  return `Hey! You planned: ${c.task}. Are we getting started?`;
}

function open(c) {
  c.acknowledged = true; active = c.id; save();
  api.show();
  const w = api.getWin();
  if (w) w.webContents.send('open-commitment', { id: c.id, personality: c.personality, language: c.language, message: nudgeText(c) });
  push();
}

function nudge(c) {
  c.status = 'nudged'; c.nudgedAt = Date.now(); c.acknowledged = false;
  log(c, 'nudge sent');
  const n = new Notification({ title: 'oyeee', body: nudgeText(c) });
  n.on('click', () => open(c));
  n.show();
  save(); push();
}

function tick() {
  if (globalPause) return;
  const now = Date.now();
  for (const c of items) {
    if (c.status === 'scheduled' && now >= new Date(c.startAt).getTime()) nudge(c);
    else if (c.status === 'nudged' && !c.acknowledged && now - c.nudgedAt > WAIT_MIN * 60000) {
      c.ignored++; log(c, 'nudge ignored (' + c.ignored + ')');
      if (c.ignored >= MAX_IGNORED) { c.status = 'paused'; log(c, 'auto-paused after repeated ignored nudges'); save(); push(); }
      else nudge(c);
    }
  }
}

function addItem(d) {
  if (!d || typeof d.task !== 'string' || !d.task.trim() || isNaN(new Date(d.startAt))) return { error: 'Invalid commitment' };
  items.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), task: d.task.trim().slice(0, 120), startAt: new Date(d.startAt).toISOString(),
    personality: PERS.includes(d.personality) ? d.personality : PERS[0],
    language: LANGS.includes(d.language) ? d.language : 'English',
    status: 'scheduled', ignored: 0, acknowledged: false, log: [{ at: new Date().toISOString(), ev: 'created' }],
  });
  save(); push(); return { ok: true };
}

function init(a) {
  api = a;
  app.setAppUserModelId('oyeee');
  load();
  setInterval(tick, 15000);

  ipcMain.handle('c:list', () => items);
  ipcMain.handle('c:add', (_e, d) => addItem(d));
  ipcMain.handle('c:act', (_e, { id, action }) => {
    const c = items.find((x) => x.id === id);
    if (!c) return { error: 'Not found' };
    if (action === 'started') { c.status = 'started'; log(c, 'user reported started (not verified)'); }
    else if (action === 'pause') { c.status = 'paused'; log(c, 'paused by user'); }
    else if (action === 'resume') { c.status = 'scheduled'; c.ignored = 0; c.startAt = new Date(Date.now() + 60000).toISOString(); log(c, 'resumed by user'); }
    else if (action === 'snooze') { c.status = 'scheduled'; c.ignored = 0; c.startAt = new Date(Date.now() + 3600000).toISOString(); log(c, 'rescheduled +1h'); }
    else if (action === 'delete') items = items.filter((x) => x.id !== id);
    save(); push(); return { ok: true };
  });

  tick();
}

function setGlobalPause(v) { globalPause = !!v; }

function onUserMessage(text) {
  if (!active) { const n = items.filter((c) => c.status === 'nudged').pop(); if (n) active = n.id; }
  const c = items.find((x) => x.id === active);
  if (c) c.acknowledged = true;
  justPaused = null;
  if (STOP.test(text)) {
    const targets = c ? [c] : items.filter((x) => x.status === 'scheduled' || x.status === 'nudged');
    targets.forEach((t) => { t.status = 'paused'; log(t, 'user asked to stop reminders'); });
    justPaused = c ? c.id : 'all';
  }
  save(); push();
}

function context() {
  const c = items.find((x) => x.id === active);
  if (!c) return justPaused === 'all' ? ' The user asked to stop reminders; they are paused. Confirm kindly in one short sentence.' : '';
  let s = ` Current commitment: "${c.task}" planned for ${c.startAt}. Status: ${c.status}.`;
  if (justPaused === c.id) s += ' The user just asked to stop reminders for this task; they are now paused. Confirm kindly in one short sentence and do not push.';
  return s + ' Once the user agrees to a small first step, ask them to press the "I started" button when they begin. You cannot verify that they started.';
}

module.exports = { init, setGlobalPause, onUserMessage, context, add: addItem };