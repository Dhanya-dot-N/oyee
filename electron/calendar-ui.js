(function () {
  const ov = document.getElementById('calOverlay');
  const body = document.getElementById('calBody');
  let items = [];
  let editing = null;
  const justStarted = {};

  const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  function dayTitle(d, diff) {
    const full = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    return diff === 0 ? 'Today \u00B7 ' + full : diff === 1 ? 'Tomorrow \u00B7 ' + full : full;
  }

  function btn(label, cls, fn) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = label; b.onclick = fn;
    return b;
  }
  function span(cls, text) {
    const s = document.createElement('span');
    s.className = cls; s.textContent = text;
    return s;
  }

  function card(c) {
    const el = document.createElement('div');
    el.className = 'cal-ev ' + c.status;
    const when = new Date(c.startAt);

    if (editing === c.id) {
      const inp = document.createElement('input');
      inp.type = 'datetime-local'; inp.value = toInput(when); inp.className = 'cal-in';
      const err = span('cal-err', '');
      el.append(
        inp,
        btn('Set', 'cal-act', async () => {
          const r = await window.mate.c.act(c.id, 'retime', inp.value);
          if (r && r.error) { err.textContent = r.error; return; }
          editing = null; render();
        }),
        btn('Cancel', 'cal-act ghost', () => { editing = null; render(); }),
        err
      );
      return el;
    }

    const t = document.createElement('button');
    t.className = 'cal-t';
    t.textContent = fmtTime(when);
    t.title = 'Change time';
    if (c.status === 'done') t.disabled = true;
    else t.onclick = () => { editing = c.id; render(); };
    el.append(t, span('cal-n', c.task));

    if (c.status === 'scheduled' || c.status === 'nudged') {
      el.append(btn('Start', 'cal-act', async () => {
        justStarted[c.id] = Date.now();
        await window.mate.c.act(c.id, 'started');
        setTimeout(render, 1500);
      }));
    } else if (c.status === 'started') {
      if (justStarted[c.id] && Date.now() - justStarted[c.id] < 1400) el.append(span('cal-ok', 'Started \u2713'));
      else el.append(btn('Done', 'cal-act done', () => window.mate.c.act(c.id, 'done')));
    } else if (c.status === 'done') {
      el.append(span('cal-ok', 'Done \u2713'));
    } else if (c.status === 'paused') {
      el.append(btn('Resume', 'cal-act ghost', () => window.mate.c.act(c.id, 'resume')));
    }
    el.append(btn('\u2715', 'cal-x', () => window.mate.c.act(c.id, 'delete')));
    return el;
  }

  function render() {
    body.innerHTML = '';
    const today = dayStart(new Date());
    const byDay = new Map();
    for (const c of items) {
      const diff = Math.round((dayStart(new Date(c.startAt)) - today) / 86400000);
      if (diff < 0) continue;
      if (!byDay.has(diff)) byDay.set(diff, []);
      byDay.get(diff).push(c);
    }
    const diffs = [...new Set([0, 1, 2, ...byDay.keys()])].sort((a, b) => a - b);
    for (const diff of diffs) {
      const d = new Date(today);
      d.setDate(d.getDate() + diff);
      const sec = document.createElement('div');
      const h = document.createElement('div');
      h.className = 'cal-dh' + (diff === 0 ? ' today' : '');
      h.textContent = dayTitle(d, diff);
      sec.appendChild(h);
      const list = (byDay.get(diff) || []).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      if (!list.length) sec.appendChild(span('cal-empty', 'Nothing planned'));
      for (const c of list) sec.appendChild(card(c));
      body.appendChild(sec);
    }
  }

  window.mate.onCommitments((d) => {
    items = d || [];
    if (ov.classList.contains('open') && !editing) render();
  });

  document.getElementById('calBtn').onclick = async () => {
    items = await window.mate.c.list();
    editing = null;
    render();
    ov.classList.add('open');
  };
  document.getElementById('calClose').onclick = () => { editing = null; ov.classList.remove('open'); };
})();