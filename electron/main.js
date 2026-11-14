require('dotenv').config({ override: true });
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const commitments = require('./commitments');
const knowme = require('./knowme');

let win, tray;
const SIZES = { small: [380, 520], large: [820, 640] };
const PERSONALITIES = {
    'Me': "You are the user's own voice, speaking as 'another me'. Warm, steady, practical and on their side. Speak simply, like a friend who knows them well. Never guilt, shame or roast. Use what they tell you about time left and progress made, and name the next step that fits it.",
};
const BASE_RULES = "You are 'oyeee', an accountability companion for college students. Goal: help them take the next small step on a task, without guilt or shame. Silently work out the obstacle (low motivation, overwhelm, confusion, distraction) and respond to it by shrinking the task or asking one clarifying question. DEADLINES COME FIRST: if the user mentions a deadline, remember the time left and the progress they report. When a deadline is within a few hours, be calm but firm and practical: say plainly that there is enough time and that finishing now beats losing the chance to submit. Give the very next concrete step and a rough time for it. Never tell them to stop, rest, sleep or do less while a deadline is near, unless they say they are unwell. Support English, Hindi and Kannada. The user may speak in any mix of these languages, but you always reply in ONE language only and never mix languages in a reply. Keep wording simple and easy to speak aloud. Maximum 3 short sentences. Never guilt or shame. You are an AI, not a real person or therapist; for mental-health or crisis topics, kindly point to trusted people or professionals. ";  
const TECHNIQUES = " TASK HELP: Break the task into ONE concrete chunk of 5-10 minutes and name it. Pick ONE method that fits: 5-minute start (just begin, you may stop after); Pomodoro (25 minutes work, 5 break, or 15 if energy is low); write the ugliest first version; start with the easiest part; put the phone in another room; write the next action on paper. Give practical advice only from these ideas, no outside facts.";
let history = [];

function createWindow() {
  win = new BrowserWindow({
    width: SIZES.small[0],
    height: SIZES.small[1],
    alwaysOnTop: true,
    icon: path.join(__dirname, 'icon.png'),
    title: 'oyeee',
    maximizable: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#FBF8F5', symbolColor: '#2B2B33', height: 34 },
    autoHideMenuBar: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,     
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.removeMenu();
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function toggleWindow() {
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

app.whenReady().then(() => {
  createWindow();
  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip('oyeee');
  tray.on('click', toggleWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide', click: toggleWindow },
    { label: 'Pause all reminders', type: 'checkbox', click: (i) => commitments.setGlobalPause(i.checked) },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  commitments.init({ getWin: () => win, show: () => { win.show(); win.focus(); } });
  const ok = globalShortcut.register('Control+Shift+Z', toggleWindow);
  if (!ok) console.log('Could not register the shortcut');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});

async function llmReply(text, personality, language) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) return { error: 'Missing GEMINI_API_KEY or GEMINI_MODEL in .env' };

  history.push({ role: 'user', parts: [{ text }] });
  history = history.slice(-6);

  try {
    let res;
    for (let i = 0; i < 3; i++) {
      res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(25000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: BASE_RULES + TECHNIQUES + PERSONALITIES[personality] + replyLang(language) + commitments.context() + knowme.context(text) }] },
          contents: history,
          generationConfig: { maxOutputTokens: 300 },
        }),
            }
      );
      if (res.status !== 503 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    if (!res.ok) return { error: `API error ${res.status} (quota, key or model name problem?)` };
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return { error: 'Empty reply from the model' };
    history.push({ role: 'model', parts: [{ text: reply }] });
    return { reply };
  } catch (e) {
    return { error: 'Network problem: ' + e.message };
  }
}

ipcMain.handle('ask', async (_event, payload) => {
  if (!payload || typeof payload.text !== 'string') return { error: 'Invalid input' };
  const text = payload.text.trim().slice(0, 500);
  if (!text) return { error: 'Empty message' };
  const lang = LANGS.includes(payload.language) ? payload.language : 'English';
  commitments.onUserMessage(text);
  const made = payload.noRem ? null : await tryReminders(text, lang);
  if (made) return { reply: made };
  return llmReply(text, 'Me', lang);
});

ipcMain.on('set-size', (_event, mode) => {
  const size = SIZES[mode];
  if (size) win.setSize(size[0], size[1]);
});


// ---- Gnani voice ----
const GNANI = 'https://api.vachana.ai';

ipcMain.handle('stt', async (_e, buf, language) => {
  const key = process.env.GNANI_API_KEY;
  if (!key) return { error: 'Missing GNANI_API_KEY in .env' };
  if (!buf || buf.byteLength < 4000 || buf.byteLength > 2000000) return { error: 'Recording too short or too long' };
  try {
    const form = new FormData();
    form.append('audio_file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'prisma-v3.0');
    form.append('language_code', sttCode(language));
    
    const res = await fetch(`${GNANI}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': key }, body: form });
    if (!res.ok) return { error: `Speech-to-text error ${res.status}: ` + (await res.text()).slice(0, 200) };
    const data = await res.json();
    console.log('STT response:', JSON.stringify(data));
    const text = (data.transcript || '').trim();
    return text ? { text } : { error: "Couldn't hear anything" };
  } catch (e) {
    return { error: 'Network problem: ' + e.message };
  }
});

ipcMain.handle('tts', async (_e, text, lang) => {
  const key = process.env.GNANI_API_KEY;
  if (!key) return { error: 'Missing GNANI_API_KEY in .env' };
  if (typeof text !== 'string' || !text.trim()) return { error: 'No text' };
  text = text.trim().slice(0, 300); // keep spoken replies short to save credits
  let language = { English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN' }[lang];
  if (!language) {
    language = 'en-IN';
    if (/[\u0C80-\u0CFF]/.test(text)) language = 'kn-IN';
    else if (/[\u0900-\u097F]/.test(text)) language = 'hi-IN';
  }
  try {
    const res = await fetch(`${GNANI}/api/v1/tts/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': key },
      body: JSON.stringify({
        text,
        voice: process.env.GNANI_VOICE || 'Nalini',
        model: 'timbre-v2.5',
        language,
        audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' },
      }),
    });
    if (!res.ok) return { error: `Text-to-speech error ${res.status}: ` + (await res.text()).slice(0, 200) };
    return { audio: Buffer.from(await res.arrayBuffer()) };
  } catch (e) {
    return { error: 'Network problem: ' + e.message };
  }
});


function langRule(t) {
  if (/[\u0C80-\u0CFF]/.test(t)) return ' The user wrote Kannada. Reply ONLY in simple, natural, spoken Kannada script with short plain sentences. Do not use Hindi. Avoid English words except very common ones like "study".';
  if (/[\u0900-\u097F]/.test(t)) return ' The user wrote Hindi. Reply in simple spoken Hindi (Devanagari).';
  return ' The user wrote English. Reply in English only. No Hindi words except "beta".';
}

const LANGS = ['English', 'Hindi', 'Kannada'];
function sttCode(l) { return { English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN' }[l] || 'indic-auto'; }
function replyLang(l) {
  if (l === 'Kannada') return ' Reply ONLY in simple, natural, spoken Kannada written in Kannada script. No Hindi. Write any English word (like study) in Kannada script too. Short plain sentences.';
  if (l === 'Hindi') return ' Reply ONLY in simple spoken Hindi written in Devanagari script. No English letters and no Kannada. Write English words like study in Devanagari too.';
  return ' Reply in English only. No Hindi or Kannada words.';
}

// ---- Reminders from chat ----
const REM_HINT = /remind|nudge|timer|due|deadline|submit|tomorrow|tonight|\d\s*(a\.?m|p\.?m)|\b\d{1,2}:\d{2}\b|\bin\s+\d+\s*(min|minute|minutes|mins|hour|hours|hr|hrs)\b|ನೆನಪಿಸ|ನಾಳೆ|ನಿಮಿಷ|याद\s*दिला|रिमाइंडर|कल|मिनट/i;
const DAYW = { English: ['Today', 'Tomorrow'], Hindi: ['आज', 'कल'], Kannada: ['ಇಂದು', 'ನಾಳೆ'] };
const TXT = {
  English: { done: (l) => `Done! Reminders set: ${l}.`, past: 'That time has already passed. Tell me a new time.' },
  Hindi: { done: (l) => `हो गया! रिमाइंडर सेट: ${l}.`, past: 'वह समय बीत चुका है। नया समय बताइए।' },
  Kannada: { done: (l) => `ಆಯ್ತು! ರಿಮೈಂಡರ್ ಸೇರಿಸಿದ್ದೇನೆ: ${l}.`, past: 'ಆ ಸಮಯ ಆಗಲೇ ಕಳೆದಿದೆ. ಹೊಸ ಸಮಯ ಹೇಳಿ.' },
};

function whenText(d, lang) {
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  const names = DAYW[lang] || DAYW.English;
  const day = diff === 0 ? names[0] : diff === 1 ? names[1] : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} ${t}`;
}

async function tryReminders(text, lang) {
  if (!REM_HINT.test(text)) return null;
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) return null;
  const nowStr = new Date().toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const prompt = `Now: ${nowStr} (India time). The user said: "${text}"
Decide if the user is mainly asking to schedule reminders: "remind me", "set a reminder", or giving a due time plus a time to work. If they are mainly sharing feelings, what they are avoiding, or progress so far (for example "2 hours left, half done"), return no reminders.
Rules:
- Use only times the user explicitly states. Never invent a time.
- Relative times count as stated: "in 2 minutes", "in an hour", "after 30 min" mean Now plus that amount. "Nudge me", "timer" and "remind me" all mean a reminder. The task is what they are about to do (for example "Wash face"), or "Check in" if none is given.
- If they give a due or submit time, add one reminder at that time (task like "Submit X").
- If they give a time to start or work on it, add one reminder at that time (task like "Write X").
- If only one time is given, return only one reminder.
- Resolve today, tomorrow, tonight, day after tomorrow from Now. A time with no date means today, or tomorrow if it has already passed today.
- task: max 8 words, in the language the user used.
- startAt: local time as YYYY-MM-DDTHH:MM (24-hour).
Return JSON only: {"reminders":[{"task":"...","startAt":"..."}]}. Nothing to add: {"reminders":[]}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 400 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const list = (JSON.parse(raw).reminders || []).slice(0, 4);
    if (!list.length) return null;
    const ok = [];
    for (const r of list) {
      const when = new Date(r && r.startAt);
      if (!r || typeof r.task !== 'string' || !r.task.trim() || isNaN(when)) continue;
      if (when.getTime() < Date.now() - 60000) continue;
      ok.push({ task: r.task.trim(), when });
    }
    if (!ok.length) return TXT[lang].past;
    for (const o of ok) commitments.add({ task: o.task, startAt: o.when.toISOString(), personality: 'Me', language: lang });
    return TXT[lang].done(ok.map((o) => `${o.task} (${whenText(o.when, lang)})`).join(', '));
  } catch {
    return null;
  }
}