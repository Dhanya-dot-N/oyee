(function () {
  const ov = document.getElementById('calOverlay');
  const body = document.getElementById('calBody');
  let items = [];

  const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const STATUS = { scheduled: '', nudged: 'nudged', started: 'started \u2713', paused: 'paused' };

  function dayTitle(d, diff) {
    const full = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    return diff === 0 ? 'Today \u00B7 ' + full : diff === 1 ? 'Tomorrow \u00B7 ' + full : full;
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
      sec.className = 'cal-day';
      const h = document.createElement('div');
      h.className = 'cal-dh' + (diff === 0 ? ' today' : '');
      h.textContent = dayTitle(d, diff);
      sec.appendChild(h);
      const list = (byDay.get(diff) || []).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      if (!list.length) {
        const e = document.createElement('div');
        e.className = 'cal-empty';
        e.textContent = 'Nothing planned';
        sec.appendChild(e);
      }
      for (const c of list) {
        const card = document.createElement('div');
        card.className = 'cal-ev ' + c.status;
        const t = document.createElement('span');
        t.className = 'cal-t';
        t.textContent = fmtTime(new Date(c.startAt));
        const n = document.createElement('span');
        n.className = 'cal-n';
        n.textContent = c.task + (STATUS[c.status] ? ' \u00B7 ' + STATUS[c.status] : '');
        const x = document.createElement('button');
        x.className = 'cal-x';
        x.textContent = '\u2715';
        x.title = 'Delete';
        x.onclick = () => window.mate.c.act(c.id, 'delete');
        card.append(t, n, x);
        sec.appendChild(card);
      }
      body.appendChild(sec);
    }
  }

  window.mate.onCommitments((d) => {
    items = d || [];
    if (ov.classList.contains('open')) render();
  });

  document.getElementById('calBtn').onclick = async () => {
    items = await window.mate.c.list();
    render();
    ov.classList.add('open');
  };
  document.getElementById('calClose').onclick = () => ov.classList.remove('open');
})();