(function () {
  const ov = document.getElementById('kmOverlay');
  const whyEl = document.getElementById('kmWhy');
  const list = document.getElementById('kmList');
  const msg = document.getElementById('kmMsg');

  function addRow(x) {
    const d = document.createElement('div');
    d.className = 'km-row';
    const e = document.createElement('input');
    e.className = 'km-ex';
    e.placeholder = "Excuse, e.g. I don't want to do DSA";
    e.value = x.excuse || '';
    d.appendChild(e);
    for (let i = 0; i < 3; i++) {
      const r = document.createElement('input');
      r.className = 'km-re';
      r.placeholder = 'Your reply ' + (i + 1) + (i === 0 ? '' : ' (optional)');
      r.value = (x.replies || [])[i] || '';
      d.appendChild(r);
    }
    const del = document.createElement('button');
    del.className = 'km-del';
    del.textContent = 'Remove';
    del.onclick = () => d.remove();
    d.appendChild(del);
    list.appendChild(d);
  }

  function collect() {
    const excuses = [...list.querySelectorAll('.km-row')].map((d) => ({
      excuse: d.querySelector('.km-ex').value,
      replies: [...d.querySelectorAll('.km-re')].map((r) => r.value),
    }));
    return { why: whyEl.value, excuses };
  }

  async function open() {
    msg.textContent = '';
    const data = await window.mate.k.get();
    whyEl.value = data.why || '';
    list.innerHTML = '';
    (data.excuses || []).forEach(addRow);
    if (!(data.excuses || []).length) addRow({});
    ov.classList.add('open');
  }

  document.getElementById('kmBtn').onclick = open;
  document.getElementById('kmClose').onclick = () => ov.classList.remove('open');
  document.getElementById('kmAdd').onclick = () => addRow({});
  document.getElementById('kmSave').onclick = async () => {
    const res = await window.mate.k.save(collect());
    msg.textContent = res.error ? 'Could not save: ' + res.error : 'Saved \u2713';
  };
})();