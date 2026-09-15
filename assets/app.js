/* ============================================================
   EpiPrint — общий слой прототипа: оболочка, иконки, компоненты.
   ============================================================ */

/* ---------- Lucide icons (MIT) ---------- */
const ICONS = {
  'fingerprint':'<path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/>',
  'layout-dashboard':'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'hard-drive':'<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
  'list-checks':'<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  'microscope':'<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
  'shield-check':'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'git-compare':'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  'activity':'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'file-text':'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  'file-json':'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>',
  'search':'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'download':'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'play':'<polygon points="6 3 20 12 6 21 6 3"/>',
  'refresh-cw':'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'check':'<path d="M20 6 9 17l-5-5"/>',
  'x':'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'circle-check':'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'circle-x':'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  'alert-triangle':'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'clock':'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'folder':'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'server':'<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  'printer':'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  'arrow-left':'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'chevron-right':'<path d="m9 18 6-6-6-6"/>',
  'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'flask':'<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
  'dna':'<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m3.5 14.5.5.5"/><path d="m20 9 .5.5"/><path d="m6.5 12.5 1 1"/><path d="m16.5 10.5 1 1"/><path d="m10 16 1.5 1.5"/>',
  'table':'<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  'bell':'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'menu':'<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
};
function icon(name, cls){ return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="ic-svg ${cls||''}">${ICONS[name]||''}</svg>`; }

/* ---------- навигация ---------- */
const NAV = [
  { group:'Обзор' },
  { key:'index',   label:'Главная',            icon:'layout-dashboard', href:'index.html' },
  { group:'Обработка' },
  { key:'storage', label:'Хранилище',          icon:'hard-drive', href:'storage.html' },
  { key:'queue',   label:'Очередь',            icon:'list-checks', href:'queue.html' },
  { group:'Результаты' },
  { key:'samples', label:'Образцы',            icon:'microscope', href:'samples.html' },
  { key:'qc',      label:'Контроль качества',  icon:'shield-check', href:'qc.html' },
];

function renderShell(){
  const active = document.body.dataset.page;
  const newCount = STORAGE.reduce((a,r)=> a + r.files.filter(f=>!f.launched).length, 0);
  const activeCount = SAMPLES.filter(s=> s.status==='processing'||s.status==='queued').length;

  const nav = NAV.map(n=>{
    if (n.group) return `<div class="nav__group">${n.group}</div>`;
    let badge = '';
    if (n.key==='storage' && newCount) badge = `<span class="nav__badge">${newCount}</span>`;
    if (n.key==='queue' && activeCount) badge = `<span class="nav__badge">${activeCount}</span>`;
    return `<a class="nav__item ${active===n.key?'is-active':''}" href="${n.href}">${icon(n.icon)}<span>${n.label}</span>${badge}</a>`;
  }).join('');

  const sb = document.getElementById('sidebar');
  if (sb) sb.innerHTML = `
    <div class="brand">
      <div class="brand__mark">${icon('fingerprint')}</div>
      <div><div class="brand__name">EpiPrint</div><div class="brand__sub">cfDNA Methylation</div></div>
    </div>
    <nav class="nav">${nav}</nav>
    <div class="sidebar__foot">Прототип · v0.1 · демо-данные</div>`;

  const tb = document.getElementById('topbar');
  if (tb){
    const title = tb.dataset.title || '';
    const crumb = tb.dataset.crumb ? `<span class="topbar__crumb">${tb.dataset.crumb}</span>` : '';
    tb.innerHTML = `
      <div class="topbar__title">${title}</div>${crumb}
      <div class="topbar__spacer"></div>
      <label class="topbar__search">${icon('search')}<input placeholder="Поиск по Seq ID…" id="globalSearch"></label>
      <button class="btn btn--icon btn--ghost" title="Уведомления">${icon('bell')}</button>
      <div class="topbar__user"><div class="avatar">${CURRENT_USER.initials}</div></div>`;
    const gs = document.getElementById('globalSearch');
    if (gs) gs.addEventListener('keydown', e=>{ if(e.key==='Enter'&&gs.value.trim()){ location.href='samples.html?q='+encodeURIComponent(gs.value.trim()); }});
  }
}

/* ---------- форматтеры / бейджи ---------- */
const STATUS_META = {
  done:      { cls:'done',   label:'Завершён' },
  processing:{ cls:'proc',   label:'В обработке' },
  queued:    { cls:'queued', label:'В очереди' },
  error:     { cls:'error',  label:'Ошибка' },
  new:       { cls:'muted',  label:'Не запущен' },
};
function statusBadge(s){ const m=STATUS_META[s]||STATUS_META.new; return `<span class="badge badge--${m.cls}"><span class="dot"></span>${m.label}</span>`; }
function qcBadge(v){ return v==='Pass' ? `<span class="badge badge--pass">${icon('check')}Pass</span>` : `<span class="badge badge--fail">${icon('x')}Fail</span>`; }
const RISK_META = { high:{cls:'high',label:'Высокий риск'}, medium:{cls:'med',label:'Средний риск'}, low:{cls:'low',label:'Низкий риск'} };
function riskBadge(r){ const m=RISK_META[r]; return `<span class="badge badge--${m.cls}">${m.label}</span>`; }
function cancerLabel(key){ const t=CANCER_TYPES.find(t=>t.key===key); return t?t.label:'—'; }
function pct(v,dp=0){ return (v*100).toFixed(dp)+'%'; }

/* ---------- хитмап цвет: 0=синий … 1=красный ---------- */
function lerp(a,b,t){ return a+(b-a)*t; }
function heatColor(v){
  const c0=[44,111,179], cm=[244,242,238], c1=[192,57,43];
  let r,g,b;
  if (v<0.5){ const t=v/0.5; r=lerp(c0[0],cm[0],t); g=lerp(c0[1],cm[1],t); b=lerp(c0[2],cm[2],t); }
  else { const t=(v-0.5)/0.5; r=lerp(cm[0],c1[0],t); g=lerp(cm[1],c1[1],t); b=lerp(cm[2],c1[2],t); }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function heatmapHtml(hm){
  const rows = hm.rows.map(row=>{
    const cells = row.values.map(v=>`<div class="hm-cell" style="background:${heatColor(v)}" title="${v.toFixed(2)}"></div>`).join('');
    return `<div class="hm-row"><div class="hm-label ${row.strong?'strong':''}">${row.label}</div>${cells}</div>`;
  }).join('');
  return `<div class="heatmap"><div class="heatmap__inner">${rows}</div></div>
    <div class="hm-scale"><span>0 · низкое</span><div class="hm-scale__bar"></div><span>1 · высокое</span>
    <span class="muted" style="margin-left:auto">${hm.N} маркерных регионов</span></div>`;
}

/* ---------- гейдж вероятности ---------- */
function gaugeHtml(prob, risk){
  const r=64, c=2*Math.PI*r, off=c*(1-prob);
  const col = risk==='high'?'var(--risk-high)':risk==='medium'?'var(--risk-med)':'var(--risk-low)';
  return `<div class="gauge"><svg width="150" height="150" viewBox="0 0 150 150">
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="13"/>
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
  </svg><div class="gauge__center"><div class="gauge__pct" style="color:${col}">${Math.round(prob*100)}%</div><div class="gauge__cap">онкопроцесс</div></div></div>`;
}

/* ---------- бары локализации ---------- */
function localizationBars(localization, topType){
  const entries = CANCER_TYPES.map(t=>({ ...t, v: localization[t.key] })).sort((a,b)=> b.v-a.v);
  return `<div class="locbars">` + entries.map((e,i)=>{
    const isTop = e.key===topType;
    const col = isTop ? 'var(--brand-600)' : 'var(--ink-3)';
    return `<div class="locbar ${isTop?'top':''}">
      <div class="locbar__name">${e.label}</div>
      <div class="locbar__track"><div class="locbar__fill" style="width:${Math.max(2,e.v*100).toFixed(0)}%;background:${col}"></div></div>
      <div class="locbar__val">${pct(e.v,1)}</div>
    </div>`;
  }).join('') + `</div>`;
}

/* ---------- тосты ---------- */
function toast(msg){
  let host = document.querySelector('.toast-host');
  if (!host){ host=document.createElement('div'); host.className='toast-host'; document.body.appendChild(host); }
  const t=document.createElement('div'); t.className='toast'; t.innerHTML=`${icon('circle-check')}<span>${msg}</span>`;
  host.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3200);
}

/* ---------- утилиты ---------- */
function qs(name){ return new URLSearchParams(location.search).get(name); }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- локальное хранилище обратной связи (демо) ---------- */
const FB_KEY = 'epiprint_feedback';
function loadFeedback(){ try{ return JSON.parse(localStorage.getItem(FB_KEY)||'{}'); }catch(e){ return {}; } }
function saveFeedback(id, data){ const all=loadFeedback(); all[id]=data; localStorage.setItem(FB_KEY, JSON.stringify(all)); }
function getFeedback(sample){ const all=loadFeedback(); return all[sample.id] || sample.feedback; }

document.addEventListener('DOMContentLoaded', renderShell);
