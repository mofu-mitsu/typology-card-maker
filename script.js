// 📡 GASのWebアプリURL
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwzWGWp8aTzkpEw0k9jLRpLXgiV75PoPr4e1_Uu_nz5IBieN63glP7XSbGLY9RP1Jln1g/exec";

const baseTypologies = [
  { id: 'mbti', label: 'MBTI', off: true }, { id: 'enneagram', label: 'エニアグラム', off: true },
  { id: 'instinct', label: '生得本能' }, { id: 'socionics', label: 'ソシオニクス', off: true },
  { id: 'psychosophy', label: 'サイコソフィア' }, { id: 'ap', label: 'AP (Attitudinal)' },
  { id: 'amatrica', label: 'アマトリカ' }, { id: 'temporistics', label: 'テンポリスティックス' },
  { id: 'bigfive', label: 'Big Five' }, { id: 'fourtemprs', label: '4気質' },
  { id: 'alignment', label: 'アライメント' }, { id: 'cj', label: 'Classical Jung' }
];
const dichotomies = [{ id: 'ei', l: 'E', r: 'I' }, { id: 'sn', l: 'S', r: 'N' }, { id: 'tf', l: 'T', r: 'F' }, { id: 'jp', l: 'J', r: 'P' }];
const cogFunctions = ['Te', 'Ti', 'Fe', 'Fi', 'Se', 'Si', 'Ne', 'Ni'];
const egogramKeys = ['CP', 'NP', 'A', 'FC', 'AC'];
const tciKeys = ['NS', 'HA', 'RD', 'P', 'SD', 'C', 'ST'];

const colorfulCog = { Te: '#4a90e2', Ti: '#00bcd4', Fe: '#ff7eb3', Fi: '#e74c3c', Se: '#f39c12', Si: '#f1c40f', Ne: '#2ecc71', Ni: '#8bc34a' };

let chartInstances = {};
let customTypoCount = 0;
let breakCount = 0; 
let userIconBase64 = "";
let cardCount = 0; 
let effectInterval = null;

// 💡 共通のドラッグ設定（これを入れることで変な位置に表示されるバグが治ります！）
const sortableBaseConfig = {
  animation: 150,
  handle: '.drag-handle',
  forceFallback: true, // ブラウザのデフォルトD&Dを無効化してJSで制御
  fallbackOnBody: true // ドラッグ中の要素を最前面に置いて位置ズレを防止！
};

function initTool() {
  buildUI();
  setupEventListeners();
  initCharts();
  addCard();
  updateCard();
  
  setInterval(adjustScale, 500);
  window.addEventListener('resize', adjustScale);
}

function adjustScale() {
  const container = document.getElementById('cards-container');
  const box = document.getElementById('preview-scale-box');
  if (!container || !box) return;
  
  if (window.innerWidth <= 1100) {
    const scale = box.clientWidth / 900;
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top left';
    const exactHeight = container.offsetHeight * scale;
    box.style.height = `${exactHeight + 30}px`;
  } else {
    container.style.transform = 'none';
    box.style.height = 'auto';
  }
}

function buildUI() {
  const typoForm = document.getElementById('typologies-form');
  baseTypologies.forEach(t => {
    typoForm.insertAdjacentHTML('beforeend', `
      <div class="list-item-row drag-item-typo" id="wrap_base_${t.id}" data-id="${t.id}">
        <i class="fa-solid fa-grip-lines drag-handle"></i>
        <label style="width:110px; font-weight:bold; font-size:0.85em;">${t.label}</label>
        <input type="text" id="val_${t.id}" placeholder="値">
        <select id="disp_item_${t.id}" class="custom-select dynamic-card-select"></select>
        ${t.off ? `<label style="font-size:0.7em; white-space:nowrap;"><input type="checkbox" id="off_${t.id}">公式</label>` : ''}
      </div>
    `);
  });

  // 💡 ドラッグ時のズレ防止設定を適用
  new Sortable(document.getElementById('typologies-form'), { 
    ...sortableBaseConfig, 
    onEnd: updateCard 
  });

  dichotomies.forEach(d => {
    document.getElementById('dichotomy-form').insertAdjacentHTML('beforeend', `
      <div class="input-group">
        <div style="display:flex; align-items:center; gap:10px; font-weight:bold;">
          <span>${d.l}</span>
          <input type="range" id="dicho_${d.id}" class="dicho-slider" min="-100" max="100" value="0">
          <span>${d.r}</span>
          <span class="dicho-val-disp" style="width:40px; text-align:right; font-weight:normal; color:#888; font-family:monospace;">0</span>
        </div>
      </div>
    `);
  });

  const buildNum = (keys, id, pfx) => keys.forEach(k => document.getElementById(id).insertAdjacentHTML('beforeend', `<div class="input-group" style="flex-direction:row; align-items:center;"><label style="flex:1;">${k}</label><input type="number" id="${pfx}_${k}" value="0" style="flex:2;"></div>`));
  buildNum(cogFunctions, 'cognitive-functions-form', 'cog'); buildNum(egogramKeys, 'egogram-form', 'ego'); buildNum(tciKeys, 'tci-form', 'tci');
}

function setupEventListeners() {
  document.querySelectorAll('.preset-color').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('theme-color-1').value = e.target.dataset.c1;
      document.getElementById('theme-color-2').value = e.target.dataset.c2;
      document.getElementById('gradient-type').value = (e.target.dataset.c1 === e.target.dataset.c2) ? 'none' : '135deg';
      applyThemeColor();
    });
  });
  ['theme-color-1', 'theme-color-2', 'gradient-type'].forEach(id => document.getElementById(id).addEventListener('input', applyThemeColor));

  document.getElementById('card-font').addEventListener('change', (e) => { document.documentElement.style.setProperty('--font-family', e.target.value); setTimeout(updateCard, 100);});
  document.getElementById('card-effect').addEventListener('change', startEffects);

  document.getElementById('icon-loader').addEventListener('change', e => {
    if(e.target.files[0]){ const r = new FileReader(); r.onload = ev => { userIconBase64 = ev.target.result; updateCard(); }; r.readAsDataURL(e.target.files[0]); }
  });
  document.getElementById('imageLoader').addEventListener('change', loadDataFromImage);

  document.querySelectorAll('.mod-slider').forEach(el => {
    el.addEventListener('input', e => {
      const prop = e.target.dataset.prop;
      const unit = prop === '--mod-scale' || prop === '--mod-width' ? '%' : 'px';
      e.target.nextElementSibling.innerText = e.target.value + unit; 
      const val = (prop === '--mod-scale') ? (e.target.value / 100) : (prop === '--mod-width' ? e.target.value + '%' : e.target.value + 'px');
      document.getElementById(e.target.dataset.target).style.setProperty(prop, val);
      if(prop === '--mod-height') Object.values(chartInstances).forEach(c => c.resize());
      setTimeout(adjustScale, 50); 
    });
  });

  document.querySelectorAll('.dicho-slider').forEach(el => {
    el.addEventListener('input', e => {
      e.target.parentElement.querySelector('.dicho-val-disp').innerText = e.target.value;
      updateCard();
    });
  });

  document.getElementById('addCustomTypoBtn').addEventListener('click', () => addCustomTypo());
  if(document.getElementById('addBreakBtn')) document.getElementById('addBreakBtn').addEventListener('click', () => addBreakTypo());
  
  document.getElementById('addCardBtn').addEventListener('click', () => { addCard(); updateCard(); });
  document.getElementById('removeCardBtn').addEventListener('click', removeLastCard);
  document.getElementById('downloadAllBtn').addEventListener('click', downloadAllCards);
  document.getElementById('shareBtn').addEventListener('click', shareTool);
  
  document.getElementById('resetBtn').addEventListener('click', () => document.getElementById('resetModal').classList.add('show'));
  document.getElementById('cancelResetBtn').addEventListener('click', () => document.getElementById('resetModal').classList.remove('show'));
  document.getElementById('confirmResetBtn').addEventListener('click', () => location.reload());

  document.addEventListener('input', e => { if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) && !e.target.classList.contains('mod-slider') && !e.target.classList.contains('dicho-slider')) updateCard(); });
}

function hexToRgb(hex) {
  let c; if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){ c=hex.substring(1).split(''); if(c.length==3) c=[c[0],c[0],c[1],c[1],c[2],c[2]]; c='0x'+c.join(''); return [(c>>16)&255, (c>>8)&255, c&255].join(', '); } return '255, 126, 179';
}

function applyThemeColor() {
  const c1 = document.getElementById('theme-color-1').value;
  const c2 = document.getElementById('theme-color-2').value;
  const type = document.getElementById('gradient-type').value;
  let bg = type === 'none' ? c1 : `linear-gradient(${type}, ${c1}, ${c2})`;
  document.documentElement.style.setProperty('--theme-color-1', c1);
  document.documentElement.style.setProperty('--theme-color-2', c2);
  document.documentElement.style.setProperty('--theme-bg', bg);
  document.documentElement.style.setProperty('--theme-color-rgb', hexToRgb(c1));
  updateCard();
}

function addCustomTypo(name = "", val = "") {
  customTypoCount++; const id = `custom_${customTypoCount}`;
  document.getElementById('typologies-form').insertAdjacentHTML('beforeend', `
    <div class="list-item-row drag-item-custom" id="wrap_${id}">
      <i class="fa-solid fa-grip-lines drag-handle"></i>
      <input type="text" id="name_${id}" placeholder="類型名(カスタム)" value="${name}">
      <input type="text" id="val_${id}" placeholder="値" value="${val}">
      <select id="disp_item_${id}" class="custom-select dynamic-card-select"></select>
    </div>
  `);
  updateSelectOptions(); updateCard();
}

function addBreakTypo() {
  breakCount++; const id = `break_${breakCount}`;
  document.getElementById('typologies-form').insertAdjacentHTML('beforeend', `
    <div class="list-item-row drag-item-break" id="wrap_${id}">
      <i class="fa-solid fa-grip-lines drag-handle"></i>
      <span style="flex:1; color:#636e72;"><i class="fa-solid fa-arrow-turn-down"></i> ここで改行する</span>
      <select id="disp_item_${id}" class="custom-select dynamic-card-select"></select>
    </div>
  `);
  updateSelectOptions(); updateCard();
}

function addCard() {
  cardCount++; const cId = `card-${cardCount}`;
  document.getElementById('cards-container').insertAdjacentHTML('beforeend', `
    <div id="${cId}" class="card theme-simple frame-glass">
      <div class="effect-layer" id="effect-${cardCount}"></div>
      <div class="card-header align-center header-solid" id="header-${cardCount}">
        <div class="profile-area"><div class="icon-circle" id="card-icon-${cardCount}"></div><h2 id="card-name-${cardCount}">Name</h2></div>
      </div>
      <div class="card-body" id="card-body-${cardCount}">
        <div id="comp-typologies-${cardCount}" class="card-module draggable-module" style="--mod-width: 100%;">
          <h3 class="module-title"><i class="fa-solid fa-list-ul drag-handle-mod"></i> Typologies</h3>
          <div class="module-content typology-grid" id="card-typologies-${cardCount}"></div>
        </div>
      </div>
    </div>
  `);

  // 💡 プレビュー側のドラッグにもズレ防止設定を適用
  new Sortable(document.getElementById(`card-body-${cardCount}`), { 
    group: 'shared-modules', 
    animation: 150, 
    handle: '.drag-handle-mod',
    forceFallback: true,
    fallbackOnBody: true,
    onEnd: (evt) => { 
      const movedItem = evt.item; 
      const newParentId = evt.to.id; 
      if (movedItem && newParentId.startsWith('card-body-')) {
        const modKey = movedItem.id.replace('comp-', '');
        const cardNum = newParentId.replace('card-body-', '');
        const sel = document.getElementById(`disp_${modKey}`);
        if (sel) sel.value = `card-${cardNum}`; 
      }
      updateCard(); 
      adjustScale(); 
    } 
  });
  
  updateSelectOptions();
}

function removeLastCard() {
  if (cardCount <= 1) { showToast("⚠️ 1枚目は削除できません"); return; }
  const lastCardBody = document.getElementById(`card-body-${cardCount}`);
  const firstCardBody = document.getElementById('card-body-1');
  Array.from(lastCardBody.children).forEach(child => {
    if (!child.id.startsWith('comp-typologies-')) { 
      firstCardBody.appendChild(child);
      const sel = document.getElementById(`disp_${child.id.replace('comp-', '')}`);
      if(sel) sel.value = 'card-1'; 
    }
  });
  document.getElementById(`card-${cardCount}`).remove();
  cardCount--;
  updateSelectOptions();
  document.querySelectorAll('.dynamic-card-select').forEach(sel => { if (sel.value === `card-${cardCount + 1}`) sel.value = 'card-1'; });
  updateCard(); setTimeout(adjustScale, 50); showToast("🗑️ 最後のカードを削除しました");
}

function updateSelectOptions() {
  document.querySelectorAll('.dynamic-card-select').forEach(sel => {
    const cur = sel.value; sel.innerHTML = `<option value="none">非表示</option>`;
    for(let i=1; i<=cardCount; i++) sel.innerHTML += `<option value="card-${i}">カード ${i}枚目</option>`;
    sel.value = (cur && cur !== `card-${cardCount + 1}`) ? cur : 'card-1';
  });
}

function initCharts() {
  Chart.defaults.color = '#7f8c8d'; Chart.defaults.font.family = "inherit";
  chartInstances.cog = new Chart(document.getElementById('cogChart'), { 
    type: 'bar', data: { labels: cogFunctions, datasets: [{ data: Array(8).fill(0), borderRadius: 4 }] }, 
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, suggestedMax: 10, suggestedMin: -5, grid: { color: (ctx) => ctx.tick.value === 0 ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1 } } } } 
  });
  chartInstances.ego = new Chart(document.getElementById('egoChart'), { 
    type: 'line', data: { labels: egogramKeys, datasets: [{ data: Array(5).fill(0), tension: 0.4, fill: true, borderWidth: 3, pointRadius: 5 }] }, 
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, suggestedMax: 5 } } } 
  });
  chartInstances.tci = new Chart(document.getElementById('tciChart'), { 
    type: 'radar', data: { labels: tciKeys, datasets: [{ data: Array(7).fill(0) }] }, 
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: 5 }, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, min: 0, suggestedMax: 5, ticks: { backdropColor: 'rgba(255, 255, 255, 0.85)', color: '#333', font: { weight: 'bold' }, z: 10 }, pointLabels: { font: { size: 11, weight: 'bold' } } } } } 
  });
}

function updateCard() {
  const nameStr = document.getElementById('user-name').value || 'Name';
  const theme = document.getElementById('card-theme').value;
  const frame = document.getElementById('card-frame').value;
  const headerBg = document.getElementById('header-bg-style').value;
  const align = document.getElementById('header-align').value;
  const cogColorType = document.getElementById('cog-color-type').value;
  const c1 = document.documentElement.style.getPropertyValue('--theme-color-1') || '#FF7EB3';
  const rgb = document.documentElement.style.getPropertyValue('--theme-color-rgb') || '255, 126, 179';
  const showSub = document.getElementById('show-header-sub').checked;

  for(let i=1; i<=cardCount; i++) {
    document.getElementById(`card-name-${i}`).innerText = nameStr + (i > 1 ? ` - P${i}` : '');
    document.getElementById(`card-icon-${i}`).style.backgroundImage = userIconBase64 ? `url(${userIconBase64})` : '';
    document.getElementById(`card-${i}`).className = `card ${theme} ${frame}`;
    const header = document.getElementById(`header-${i}`);
    header.className = `card-header ${headerBg} ${align}`;
    if(i > 1) header.style.display = showSub ? 'flex' : 'none';
  }

  ['dichotomy', 'cog', 'ego', 'tci', 'free'].forEach(modKey => {
    const sel = document.getElementById(`disp_${modKey}`);
    const comp = document.getElementById(`comp-${modKey}`);
    const chk = document.querySelector(`.use-toggle[data-target="comp-${modKey}"]`);
    if (sel && comp) {
      const targetVal = sel.value;
      if (targetVal === 'none' || (chk && !chk.checked)) comp.style.display = 'none';
      else {
        const targetBody = document.getElementById(targetVal.replace('card-', 'card-body-'));
        if (targetBody && comp.parentElement !== targetBody) targetBody.appendChild(comp);
        comp.style.display = 'block';
      }
    }
  });

  for(let i=1; i<=cardCount; i++) document.getElementById(`card-typologies-${i}`).innerHTML = '';
  
  const orderList = Array.from(document.getElementById('typologies-form').children).map(el => {
    if (el.classList.contains('drag-item-typo')) return { type: 'base', id: el.dataset.id };
    if (el.classList.contains('drag-item-custom')) return { type: 'custom', id: el.id.replace('wrap_', '') };
    if (el.classList.contains('drag-item-break')) return { type: 'break', id: el.id.replace('wrap_', '') };
  });

  orderList.forEach(item => {
    if (item.type === 'break') {
      const tCard = document.getElementById(`disp_item_${item.id}`).value;
      if (tCard !== 'none') {
        const grid = document.getElementById(tCard.replace('card-', 'card-typologies-'));
        if (grid) grid.innerHTML += `<div style="flex-basis: 100%; height: 0; margin: 0; padding: 0;"></div>`;
      }
      return;
    }

    let label, val, isOff, tCard;
    if(item.type === 'base') {
      const t = baseTypologies.find(x => x.id === item.id);
      label = t.label; val = document.getElementById(`val_${item.id}`).value.trim();
      isOff = document.getElementById(`off_${item.id}`)?.checked; tCard = document.getElementById(`disp_item_${item.id}`).value;
    } else {
      label = document.getElementById(`name_${item.id}`).value.trim() || 'カスタム';
      val = document.getElementById(`val_${item.id}`).value.trim(); tCard = document.getElementById(`disp_item_${item.id}`).value;
    }
    if(val && tCard !== 'none') {
      const grid = document.getElementById(tCard.replace('card-', 'card-typologies-'));
      if(grid) grid.innerHTML += `<div class="typology-item"><div class="label">${label}</div><div class="value">${val} ${isOff ? '<span class="official-badge">🛡️公式</span>' : ''}</div></div>`;
    }
  });

  for(let i=1; i<=cardCount; i++) {
    const mod = document.getElementById(`comp-typologies-${i}`);
    mod.style.display = document.getElementById(`card-typologies-${i}`).innerHTML === '' ? 'none' : 'block';
  }

  const dichoArea = document.getElementById('card-dichotomy');
  dichoArea.innerHTML = '<div class="dicho-wrap">';
  dichotomies.forEach(d => {
    const val = Number(document.getElementById(`dicho_${d.id}`).value); 
    let rPercent = 50 + (val / 2); let lPercent = 100 - rPercent;
    let fillLeft = Math.min(50, rPercent); let fillWidth = Math.abs(val / 2);
    dichoArea.querySelector('.dicho-wrap').innerHTML += `
      <div class="dicho-bar-wrap">
        <div class="dicho-labels"><span>${d.l} <small class="val-txt">(${lPercent}%)</small></span><span>${d.r} <small class="val-txt">(${rPercent}%)</small></span></div>
        <div class="dicho-track"><div class="dicho-fill" style="left:${fillLeft}%; width:${fillWidth}%;"></div><div class="dicho-thumb" style="left:${rPercent}%;"></div></div>
      </div>`;
  });

  const cogScores = cogFunctions.map(f => ({ n: f, s: Number(document.getElementById(`cog_${f}`).value||0) }));
  document.getElementById('function-order-text').innerText = [...cogScores].sort((a,b)=>b.s - a.s).map(c=>c.n).join(' > ');
  
  let cogBgColor = cogColorType === 'colorful' ? cogScores.map(c => colorfulCog[c.n]) : Array(8).fill(c1);
  chartInstances.cog.data.datasets[0].data = cogScores.map(c=>c.s); chartInstances.cog.data.datasets[0].backgroundColor = cogBgColor; chartInstances.cog.update();
  chartInstances.ego.data.datasets[0].data = egogramKeys.map(k => Number(document.getElementById(`ego_${k}`).value||0)); chartInstances.ego.data.datasets[0].borderColor = c1; chartInstances.ego.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.1)`; chartInstances.ego.update();
  chartInstances.tci.data.datasets[0].data = tciKeys.map(k => Number(document.getElementById(`tci_${k}`).value||0)); chartInstances.tci.data.datasets[0].borderColor = c1; chartInstances.tci.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; chartInstances.tci.update();

  document.getElementById('card-free-space').innerText = document.getElementById('free-space').value;
}

function startEffects() {
  const emoji = document.getElementById('card-effect').value;
  if(effectInterval) clearInterval(effectInterval);
  document.querySelectorAll('.effect-layer').forEach(el => el.innerHTML = '');
  if(emoji === 'none') return;
  effectInterval = setInterval(() => {
    for(let i=1; i<=cardCount; i++) {
      const layer = document.getElementById(`effect-${i}`); if(!layer) continue;
      const p = document.createElement('div'); p.className = 'particle'; p.innerText = emoji;
      p.style.left = Math.random() * 95 + '%'; p.style.animationDuration = (Math.random() * 3 + 3) + 's';
      layer.appendChild(p); setTimeout(() => p.remove(), 6000);
    }
  }, 500);
}

function collectData() {
  const data = { customCount: customTypoCount, breakCount: breakCount, icon: userIconBase64, cardCount: cardCount, layout: {} };
  
  for(let i=1; i<=cardCount; i++) {
    const cBody = document.getElementById(`card-body-${i}`);
    if(cBody) data.layout[`card-body-${i}`] = Array.from(cBody.children).map(el => el.id);
  }
  data.layout['components-pool'] = Array.from(document.getElementById('components-pool').children).map(el => el.id);
  
  const typoForm = document.getElementById('typologies-form');
  if(typoForm) data.layout['typologies-form'] = Array.from(typoForm.children).map(el => el.id);

  document.querySelectorAll('input[type="text"], input[type="number"], input[type="range"], input[type="color"], textarea, select').forEach(el => { if(el.id) data[el.id] = el.value; });
  document.querySelectorAll('input[type="checkbox"]').forEach(el => { if(el.id) data[el.id] = el.checked; });
  return data;
}

function sendToGAS(data) {
  if (!GAS_WEBAPP_URL) return;
  const payload = { ...data };
  delete payload.icon;
  delete payload.layout;

  fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(e => console.log('GAS送信エラー:', e));
}

// 🪄 みつきの「最終奥義版」をベースにしたデータ復元関数！
function restoreData(data) {
  if(data.cardCount) while(cardCount < data.cardCount) addCard();
  
  // カスタム枠と改行枠を初期化して再生成
  document.querySelectorAll('.drag-item-custom').forEach(el => el.remove());
  document.querySelectorAll('.drag-item-break').forEach(el => el.remove());
  customTypoCount = 0;
  breakCount = 0;
  
  if(data.customCount) { for(let i=0; i<data.customCount; i++) addCustomTypo(); }
  if(data.breakCount) { for(let i=0; i<data.breakCount; i++) addBreakTypo(); }
  if(data.icon) userIconBase64 = data.icon;
  
  // パーツ生成後にレイアウトを復元
  if(data.layout) {
    for(const parentId in data.layout) {
      const parent = document.getElementById(parentId);
      if(parent) {
        data.layout[parentId].forEach(childId => {
          if(!childId) return;
          const child = document.getElementById(childId);
          if(child) parent.appendChild(child);
        });
      }
    }
  }

  for (const key in data) {
    const el = document.getElementById(key);
    if (el) {
      if(el.type === 'checkbox') el.checked = data[key]; else el.value = data[key];
      if(key.startsWith('theme-color') || key === 'gradient-type') applyThemeColor();
      if(key === 'card-font') document.documentElement.style.setProperty('--font-family', data[key]);
      
      if(el.classList.contains('mod-slider')) {
        const prop = el.dataset.prop;
        const unit = prop === '--mod-scale' || prop === '--mod-width' ? '%' : 'px';
        el.nextElementSibling.innerText = el.value + unit; 
        const val = (prop === '--mod-scale') ? (el.value / 100) : (prop === '--mod-width' ? el.value + '%' : el.value + 'px');
        document.getElementById(el.dataset.target).style.setProperty(prop, val);
      }
      if(el.classList.contains('dicho-slider')) {
        el.parentElement.querySelector('.dicho-val-disp').innerText = el.value;
      }
    }
  }
  
  startEffects(); 
  updateCard(); 
  
  // 💡 【最終奥義】時間をズラして人間の操作をシミュレートする！
  const container = document.getElementById('cards-container');
  if (!container) return;

  const originalTransform = container.style.transform;
  container.style.transform = 'scale(1)'; 
  
  ['cog', 'ego', 'tci'].forEach(key => {
    const comp = document.getElementById(`comp-${key}`);
    if (comp) comp.style.display = 'none';
  });

  setTimeout(() => {
    ['cog', 'ego', 'tci'].forEach(key => {
      const comp = document.getElementById(`comp-${key}`);
      const chk = document.querySelector(`.use-toggle[data-target="comp-${key}"]`);
      if (comp && chk && chk.checked) {
        comp.style.display = 'block';
      }
    });
    
    Object.values(chartInstances).forEach(c => {
      if (c) {
        c.resize();
        c.update('none');
      }
    });

    setTimeout(() => {
      container.style.transform = originalTransform;
      adjustScale();
      showToast("✨ データを復元しました！");
    }, 50);

  }, 100);
}

async function downloadAllCards() {
  if(cardCount === 0) return;
  showToast("📸 画像を生成中... (エフェクトを一時停止します)");
  if(effectInterval) clearInterval(effectInterval);
  
  const wrapper = document.getElementById('cards-container');
  const box = document.getElementById('preview-scale-box');
  const originalTransform = wrapper.style.transform;
  
  wrapper.style.transform = 'scale(1)'; 
  if(box) { box.style.height = 'auto'; box.style.overflow = 'visible'; }

  const glassHeaders = document.querySelectorAll('.header-glass');
  const glassModules = document.querySelectorAll('.frame-glass .card-module');
  glassHeaders.forEach(el => el.style.backgroundColor = 'rgba(255, 255, 255, 0.75)');
  glassModules.forEach(el => el.style.backgroundColor = 'rgba(255, 255, 255, 0.85)');
  
  const collectedData = collectData();
  const jsonBytes = new TextEncoder().encode('__TYPO_DATA__' + JSON.stringify(collectedData));

  sendToGAS(collectedData);

  for(let i=1; i<=cardCount; i++) {
    const card = document.getElementById(`card-${i}`); 
    card.style.borderRadius = '0';
    
    const canvas = await html2canvas(card, { scale: 2, backgroundColor: null, useCORS: true, windowWidth: 950 });
    card.style.borderRadius = '';
    
    await new Promise(res => canvas.toBlob(blob => {
      const r = new FileReader(); r.onload = function() {
        const arr = new Uint8Array(this.result);
        const finalArr = (i === 1) ? new Uint8Array([...arr, ...jsonBytes]) : arr;
        const url = URL.createObjectURL(new Blob([finalArr], { type: 'image/png' }));
        const a = document.createElement('a'); a.href = url; a.download = `typology_card_${i}.png`; a.click();
        URL.revokeObjectURL(url); res();
      }; r.readAsArrayBuffer(blob);
    }));
    await new Promise(r => setTimeout(r, 500));
  }
  
  glassHeaders.forEach(el => el.style.backgroundColor = '');
  glassModules.forEach(el => el.style.backgroundColor = '');
  wrapper.style.transform = originalTransform;
  if(box) box.style.overflow = 'hidden';
  adjustScale();
  
  showToast("🎉 すべてのカードを保存しました！"); startEffects();
}

function loadDataFromImage(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    const text = new TextDecoder().decode(new Uint8Array(this.result));
    const idx = text.lastIndexOf('__TYPO_DATA__');
    if (idx !== -1) { try { restoreData(JSON.parse(text.substring(idx + 13))); } catch(e) { showToast("⚠️ 読み込み失敗"); } } else showToast("🤔 この画像にはデータがありません");
    event.target.value = '';
  }; reader.readAsArrayBuffer(file);
}

function shareTool() {
  if (navigator.share) navigator.share({ title: '類型自認カードメーカー', text: '自分だけの性格タイプをおしゃれな画像にしよう！ #類型自認カードメーカー', url: window.location.href }).catch(()=>{});
  else { navigator.clipboard.writeText(window.location.href); showToast("📋 URLをコピーしました！"); }
}
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

window.onload = initTool;
