(function () {
  const ov = document.getElementById('kmOverlay');
  const whyEl = document.getElementById('kmWhy');
  const list = document.getElementById('kmList');
  const msg = document.getElementById('kmMsg');
  let cur = null;

  function micBtn() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mic mini';
    b.title = 'Tap to speak';
    b.innerHTML =
      '<svg class="i-mic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4"/></svg>' +
      '<svg class="i-stop" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>' +
      '<svg class="i-wait" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 019 9"/></svg>';
    return b;
  }

  async function stopRec() {
    if (!cur) return;
    const r = cur; cur = null;
    clearTimeout(r.timer);
    r.proc.disconnect(); r.src.disconnect();
    r.stream.getTracks().forEach((t) => t.stop());
    await r.ctx.close();
    r.btn.classList.remove('rec');
    r.btn.classList.add('wait');
    const res = await window.mate.stt(toWav(r.chunks), document.getElementById('lang').value);
    r.btn.classList.remove('wait');
    if (res.error) { msg.textContent = res.error; return; }
    msg.textContent = '';
    r.field.value = res.text;
    r.field.dispatchEvent(new Event('input'));
  }

  async function toggleMic(field, btn) {
    if (btn.classList.contains('wait')) return;
    if (cur) { if (cur.btn === btn) stopRec(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      src.connect(proc); proc.connect(ctx.destination);
      cur = { field, btn, stream, ctx, src, proc, chunks, timer: setTimeout(stopRec, 15000) };
      btn.classList.add('rec');
    } catch (e) {
      msg.textContent = 'Microphone problem: ' + e.message;
    }
  }

  function voiceField(el) {
    const w = document.createElement('div');
    w.className = 'vf';
    const b = micBtn();
    b.onclick = () => toggleMic(el, b);
    w.append(b, el);
    return w;
  }

  function makeInput(cls, ph, val) {
    const i = document.createElement('input');
    i.className = cls; i.placeholder = ph; i.value = val || '';
    return i;
  }

  function label(t) {
    const d = document.createElement('div');
    d.className = 'km-lab'; d.textContent = t;
    return d;
  }

  function addRow(x, open) {
    const row = document.createElement('div');
    row.className = 'km-row' + (open ? '' : ' collapsed');

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'km-head';
    const title = document.createElement('span');
    title.className = 'km-title';
    const chev = document.createElement('span');
    chev.textContent = '\u25BE';
    head.append(title, chev);
    head.onclick = () => row.classList.toggle('collapsed');

    const ex = makeInput('km-ex', 'Tap the mic and say your excuse, or type it', x.excuse);
    const setTitle = () => { title.textContent = ex.value.trim() || 'New excuse'; };
    ex.addEventListener('input', setTitle);
    setTitle();

    const bodyEl = document.createElement('div');
    bodyEl.className = 'km-body';
    bodyEl.append(label('The excuse'), voiceField(ex), label('What I tell myself'));
    for (let i = 0; i < 3; i++) {
      const r = makeInput('km-re', 'Say or type reply ' + (i + 1) + (i === 0 ? '' : ' (optional)'), (x.replies || [])[i]);
      bodyEl.append(voiceField(r));
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'km-del';
    del.textContent = 'Remove this excuse';
    del.onclick = () => row.remove();
    bodyEl.append(del);

    row.append(head, bodyEl);
    return row;
  }

  function collect() {
    const excuses = [...list.querySelectorAll('.km-row')].map((d) => ({
      excuse: d.querySelector('.km-ex').value,
      replies: [...d.querySelectorAll('.km-re')].map((r) => r.value),
    }));
    return { why: whyEl.value, excuses };
  }

  function render(data) {
    list.innerHTML = '';
    const ex = (data && data.excuses) || [];
    ex.forEach((x) => list.append(addRow(x, false)));
    if (!ex.length) list.append(addRow({}, true));
  }

  // mic for the "why" box
  const wv = document.createElement('div');
  wv.className = 'vf';
  whyEl.parentNode.insertBefore(wv, whyEl);
  const wb = micBtn();
  wb.onclick = () => toggleMic(whyEl, wb);
  wv.append(wb, whyEl);

  document.getElementById('kmBtn').onclick = async () => {
    msg.textContent = '';
    const data = await window.mate.k.get();
    whyEl.value = data.why || '';
    render(data);
    ov.classList.add('open');
  };
  document.getElementById('kmClose').onclick = () => { if (cur) stopRec(); ov.classList.remove('open'); };
  document.getElementById('kmAdd').onclick = () => {
    const r = addRow({}, true);
    list.prepend(r);
    r.querySelector('.km-ex').focus();
  };
  document.getElementById('kmSave').onclick = async () => {
    const res = await window.mate.k.save(collect());
    if (res.error) { msg.textContent = 'Could not save: ' + res.error; return; }
    msg.textContent = 'Saved \u2713';
    render(res.data);
  };
})();