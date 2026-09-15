/* ============================================================
   EpiPrint · Lab — минималистичный «LIMS»-слой (bioinformatician-first).
   Переиспользует данные (data.js) и helpers (app.js: icon, pct, heatColor,
   heatmapHtml, toast, get/saveFeedback). Заключение — из report-view.js.
   ============================================================ */

let liveT = null, upd = 0;
function stopT(){ if(liveT){ clearInterval(liveT); liveT=null; } }
const SYS = { load: 62, freeTb: 4.2, avgMin: 47 };

/* короткие теги */
const ST = { done:['done','завершён'], processing:['run','в работе'], queued:['queue','в очереди'], error:['fail','ошибка'], new:['muted','новый'] };
function stTag(s){ const m=ST[s]||ST.new; return `<span class="st st--${m[0]}">${m[1]}</span>`; }
function qcTag(v){ return v==='Pass'?'<span class="st st--pass">PASS</span>':'<span class="st st--fail">FAIL</span>'; }
const RT = { high:['high','высокий'], medium:['med','средний'], low:['low','низкий'] };
function riskTag(r){ const m=RT[r]; return `<span class="st st--${m[0]}">${m[1]}</span>`; }
function cancerLabel(k){ const t=CANCER_TYPES.find(x=>x.key===k); return t?t.label:'—'; }
function sec(t){ return `<span class="sec">${t}</span>`; }
function fmtMetric(m){ if(m.unit==='%') return m.value+'%'; if(!m.unit) return ''+m.value; return m.value+' '+m.unit; }
/* скачивание файла на стороне браузера (без бэкенда) */
function downloadText(filename, text, mime){
  const blob = new Blob([text], {type:(mime||'text/plain')+';charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
/* qc.json образца — по структуре реального файла пайплайна */
function buildQcJson(s){ const m=k=>{ const x=s.qc.metrics.find(y=>y.key===k); return x?x.value:null; };
  return { RESULT: s.qc.verdict==='Pass'?'PASS':'FAIL', FAILED_METRICS: s.qc.failed.join('; '), sample: s.seqId,
    reads:{
      before_filtering:{ total_reads:m('brReads'), total_bases:m('brBases'), q20_bases:m('brQ20bases'), q30_bases:m('brQ30bases'), q20_rate:m('brQ20'), q30_rate:m('brQ30'), read1_mean_length:m('brR1'), read2_mean_length:m('brR2'), gc_content:m('brGc') },
      after_filtering:{ total_reads:m('totalReads'), total_bases:m('totalBases'), q20_bases:m('q20bases'), q30_bases:m('q30bases'), q20_rate:m('q20'), q30_rate:m('q30'), read1_mean_length:m('r1len'), read2_mean_length:m('r2len'), gc_content:m('gc') } },
    coverage:{ mean:m('meanDepth'), median:m('covMedian'), pct_0x:m('cov0x'), pct_10x:m('cov10'), pct_30x:m('cov30x'), fold_80:m('fold80'), uniformity:m('uniformity') },
    duplicates:m('dup'),
    insert_size:{ mean:m('insertMean'), median:m('insert'), mode:m('insertMode') },
    cpg:{ mean_cov:m('cpgMean'), pct_15x:m('cpg15x'), pct_10x:m('cpg10x'), pct_5x:m('cpgCov'), pct_0x:m('cpg0x'), uniformity:m('cpgUnif'), mbias_diff:m('mbias') },
    conversion_rate:m('conversion'), strand_ratio:m('strand') }; }
function downloadSampleQc(id){ const s=sampleById(id); if(!s) return; downloadText('QC_'+s.seqId+'.json', JSON.stringify(buildQcJson(s), null, 2), 'application/json'); toast('Скачан QC_'+s.seqId+'.json'); }
function plural(n, f){ const a=Math.abs(n)%100, n1=a%10; if(a>10&&a<20) return f[2]; if(n1>1&&n1<5) return f[1]; if(n1===1) return f[0]; return f[2]; }
const P_OBR=['образец','образца','образцов'], P_ERR=['ошибка','ошибки','ошибок'];
const CC={ breast:'#e879a6', colorectal:'#e5638f', prostate:'#7ec46b', lung:'#e8952f', liver:'#22c1c9', stomach:'#b7a6e0', pancreas:'#c9b24a', esophagus:'#5aa9e0' };
function heatmapLoc(hm){
  const strip = hm.regions.map(r=>`<div class="hm-cell" style="height:7px;background:${CC[r.cancer]||'#ccc'}" title="${cancerLabel(r.cancer)}"></div>`).join('');
  const rows = hm.rows.map(row=>`<div class="hm-row"><div class="hm-label ${row.strong?'strong':''}">${row.label}</div>${row.values.map(v=>`<div class="hm-cell" style="background:${heatColor(v)}" title="${v}"></div>`).join('')}</div>`).join('');
  const legend = CANCER_TYPES.map(t=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px"><span style="width:10px;height:10px;border-radius:2px;background:${CC[t.key]}"></span>${t.label}</span>`).join('');
  return `<div class="heatmap"><div class="heatmap__inner">
    <div class="hm-row"><div class="hm-label faint" style="font-size:10px">локализация</div>${strip}</div>
    ${rows}</div></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px">${legend}</div>
    <div class="hm-scale" style="margin-top:6px"><span>0 · низкое</span><div class="hm-scale__bar"></div><span>1 · высокое</span><span class="faint" style="margin-left:auto">${hm.N} регионов</span></div>`;
}
function topLociTable(hm){
  return `<table class="t"><thead><tr><th>Локус</th><th>Локализация</th><th class="num">Образец</th><th class="num">Норма (референс)</th><th>Δ метилирования</th></tr></thead><tbody>${hm.topLoci.map(l=>`
    <tr><td class="id">${l.gene}_${l.pos}</td>
      <td><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:2px;background:${CC[l.cancer]}"></span>${cancerLabel(l.cancer)}</span></td>
      <td class="num" style="font-weight:600">${Math.round(l.sample*100)}%</td><td class="num faint">${Math.round(l.norm*100)}%</td>
      <td><div style="display:flex;align-items:center;gap:6px"><div style="width:110px;height:6px;background:var(--line-2);border-radius:2px;overflow:hidden"><div style="height:100%;width:${Math.round(l.delta*100)}%;background:var(--brand)"></div></div><span class="mono" style="font-size:11px">+${Math.round(l.delta*100)}%</span></div></td></tr>`).join('')}</tbody></table>`;
}

const NAV_MIN = [
  { r:'dashboard',   l:'Обзор',       ic:'layout-dashboard' },
  { r:'storage',     l:'Хранилище',   ic:'hard-drive' },
  { r:'processing',  l:'Обработка',   ic:'list-checks' },
  { r:'results',     l:'Пациенты',    ic:'microscope' },
  { r:'conclusions', l:'Заключения',  ic:'file-text' },
  { g:'Служебное' },
  { r:'users',       l:'Пользователи',ic:'users' },
];

function shell(active, title){
  const proc = SAMPLES.filter(s=>s.status==='processing'||s.status==='queued').length;
  const newN = STORAGE.reduce((a,r)=>a+r.files.filter(f=>!f.launched).length,0);
  const nav = NAV_MIN.map(n=> n.g ? `<div class="nav__g">${n.g}</div>`
    : `<a class="nav__i ${active===n.r?'on':''}" href="#/${n.r}">${icon(n.ic)}<span>${n.l}</span>${n.r==='processing'&&proc?`<span class="n">${proc}</span>`:''}${n.r==='storage'&&newN?`<span class="n">${newN}</span>`:''}</a>`).join('');
  document.getElementById('sb').innerHTML = `
    <div class="sb__brand"><div class="sb__mark">${icon('fingerprint')}</div>
      <div class="sb__name">EpiPrint<small>Genomed</small></div></div>
    <nav class="nav">${nav}</nav>
    <div class="sb__foot">прототип · v0.1 · демо</div>`;
  const mountsOk = MOUNTS.every(m=>m.status==='ok');
  document.title = `EpiPrint · ${title}`;
  document.getElementById('top').innerHTML = `
    <button class="topbtn" id="sbToggle" title="Скрыть / показать меню" aria-label="Скрыть или показать боковое меню">${icon('menu')}</button>
    <div class="top__sys">
      <span>кластер <b>${SYS.load}%</b></span><span>свободно <b>${SYS.freeTb} ТБ</b></span>
      <span><span class="live"></span>обновлено <b id="updv">0с</b></span>
    </div>
    <div class="spacer"></div>
    <label class="fontctl" title="Размер шрифта"><span>A</span><input type="range" id="fontRange" min="90" max="130" step="5" value="${Math.round(fontZoom*100)}"></label>
    <input class="search" id="gsearch" placeholder="поиск: SeqID / ФИО">
    <div class="avatar">${CURRENT_USER.initials}</div>`;
  applyZoom();
  try{ document.body.classList.toggle('sb-hidden', localStorage.getItem('epiprint_sb_hidden')==='1'); }catch(e){}
  const sbToggle = document.getElementById('sbToggle');
  if(sbToggle) sbToggle.addEventListener('click', ()=>{ const hid=document.body.classList.toggle('sb-hidden'); try{ localStorage.setItem('epiprint_sb_hidden', hid?'1':'0'); }catch(e){} });
  const fr = document.getElementById('fontRange');
  fr.addEventListener('input', ()=>{ fontZoom = fr.value/100; try{ localStorage.setItem('epiprint_zoom', fontZoom); }catch(e){} applyZoom(); });
  const gs = document.getElementById('gsearch');
  gs.addEventListener('keydown', e=>{ if(e.key==='Enter'&&gs.value.trim()){ minSearch=gs.value.trim(); location.hash='#/results'; }});
  startClock();
}
let minSearch='';
let fontZoom = (()=>{ try{ return parseFloat(localStorage.getItem('epiprint_zoom'))||1; }catch(e){ return 1; } })();
function applyZoom(){ const el=document.getElementById('view'); if(el) el.style.zoom = fontZoom; }
function setDense(on){ document.body.classList.toggle('dense', on); try{ localStorage.setItem('epiprint_dense', on?'1':'0'); }catch(e){} setDenseSeg(); }
function setDenseSeg(){ const on=document.body.classList.contains('dense'); const seg=document.getElementById('denseSeg'); if(seg) seg.querySelectorAll('button').forEach(b=> b.classList.toggle('on', (b.dataset.d==='1')===on)); }
function startClock(){ const el=()=>document.getElementById('updv'); }

/* «живой» счётчик обновления в шапке */
setInterval(()=>{ upd+=1; const e=document.getElementById('updv'); if(e) e.textContent=upd+'с'; }, 1000);

/* ================= Обзор (bioinformatician-first) ================= */
function rDash(v){
  const done=SAMPLES.filter(s=>s.status==='done'), proc=SAMPLES.filter(s=>s.status==='processing'),
        q=SAMPLES.filter(s=>s.status==='queued'), err=SAMPLES.filter(s=>s.status==='error'),
        newN=STORAGE.reduce((a,r)=>a+r.files.filter(f=>!f.launched).length,0);
  const qcFail = done.filter(s=>s.qc.verdict==='Fail');
  const active = [...proc, ...q];
  const mountsBad = MOUNTS.filter(m=>m.status!=='ok'); const mountsOk = mountsBad.length===0;

  const strip = `<div class="strip">
    <div class="strip__i"><span class="strip__n">${SAMPLES.length}</span><span class="strip__l">${plural(SAMPLES.length,P_OBR)}</span></div>
    <div class="strip__i b-pass"><span class="strip__n">${done.length}</span><span class="strip__l">завершено</span></div>
    <div class="strip__i b-run"><span class="strip__n">${proc.length}</span><span class="strip__l">в работе</span></div>
    <div class="strip__i"><span class="strip__n">${q.length}</span><span class="strip__l">в очереди</span></div>
    <div class="strip__i b-fail"><span class="strip__n">${err.length}</span><span class="strip__l">${plural(err.length,P_ERR)}</span></div>
    <div class="strip__i b-warn"><span class="strip__n">${newN}</span><span class="strip__l">к запуску</span></div>
  </div>`;

  const activeRows = active.length ? active.map(s=>{
    const idx = s.status==='processing'? 4 : 0;
    const eta = s.status==='processing'? Math.max(1,(PIPELINE_STAGES.length-idx)*5)+' мин' : '—';
    return `<tr class="clk" onclick="location.hash='#/sample/${s.id}'"><td class="id">${s.seqId}</td>
      <td>${stTag(s.status)}</td><td class="num faint">${s.status==='processing'?idx+'/'+PIPELINE_STAGES.length:'—'}</td>
      <td class="num faint">${eta}</td></tr>`;
  }).join('') : `<tr><td colspan="4" class="empty">Активных задач нет</td></tr>`;

  const alerts = [
    ...err.map(s=>`<div class="alert"><span style="color:var(--fail)">${icon('circle-x')}</span><span class="mono">${s.seqId}</span><span class="muted">ошибка пайплайна</span></div>`),
    ...qcFail.slice(0,4).map(s=>`<div class="alert"><span style="color:var(--warn)">${icon('alert-triangle')}</span><span class="mono">${s.seqId}</span><span class="muted">QC: ${s.qc.failed[0]||'fail'}</span></div>`),
    ...MOUNTS.filter(m=>m.status!=='ok').map(m=>`<div class="alert"><span style="color:var(--warn)">${icon('server')}</span><span class="mono">${m.name}</span><span class="muted">${m.note}</span></div>`),
  ];

  const recent = [...done].sort((a,b)=>b.id-a.id).slice(0,8).map(s=>`
    <tr class="clk" onclick="location.hash='#/sample/${s.id}'"><td class="id">${s.seqId}</td>
      <td>${qcTag(s.qc.verdict)}</td>
      <td class="num"><b style="color:${riskC(s.score.risk)}">${pct(s.score.cancerProb)}</b></td>
      <td>${riskTag(s.score.risk)}</td><td>${cancerLabel(s.score.topType)}</td><td class="mono faint">${s.date}</td></tr>`).join('');

  v.innerHTML = `
    <div class="ph"><h1>Обзор</h1><span class="sub">поток за последние 7 дней</span></div>
    ${strip}
    <div class="grid" style="grid-template-columns:1.7fr 1fr;align-items:start">
      <div class="grid" style="grid-template-columns:1fr">
        <div class="panel"><div class="panel__h">${sec(icon('list-checks')+'Очередь')}<span class="st st--run" style="margin-left:6px">${active.length}</span><span class="spacer"></span><span class="faint mono" style="font-size:.7rem"><span class="live"></span>live</span></div>
          <div class="tw"><table class="t"><thead><tr><th>SeqID</th><th>Статус</th><th class="num">Этап</th><th class="num">ETA</th></tr></thead><tbody>${activeRows}</tbody></table></div></div>
        <div class="panel"><div class="panel__h">${sec(icon('microscope')+'Последние образцы')}<span class="spacer"></span><a class="btn btn--sm" href="#/results">все →</a></div>
          <div class="tw"><table class="t"><thead><tr><th>SeqID</th><th>QC</th><th class="num">Скор (ML)</th><th>Риск</th><th>Локализация</th><th>Дата</th></tr></thead><tbody>${recent}</tbody></table></div></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr">
        <div class="panel"><div class="panel__h">${sec(icon('server')+'Система')}</div><div class="panel__b">
          <div class="leads">
            <div class="lead"><span class="k">Загрузка кластера</span><span class="d"></span><span class="v">${SYS.load}%</span></div>
            <div class="lead"><span class="k">Свободно в хранилище</span><span class="d"></span><span class="v">${SYS.freeTb} ТБ</span></div>
            <div class="lead"><span class="k">Среднее время обработки</span><span class="d"></span><span class="v">${SYS.avgMin} минут на образец</span></div>
            <div class="lead"><span class="k">Монтирования (диски хранилище→зеркало→веб)</span><span class="d"></span><span class="v ${mountsOk?'pass':'fail'}">${MOUNTS.length-mountsBad.length}/${MOUNTS.length}</span></div>
          </div>
          <details class="dd" ${mountsOk?'':'open'} style="margin-top:8px"><summary>точки монтирования${mountsBad.length?` · ${mountsBad.length} с проблемой`:' · все в норме'}</summary>
            <div style="margin-top:6px;display:flex;flex-direction:column;gap:5px">${MOUNTS.map(m=>{ const col=m.status==='ok'?'var(--pass)':m.status==='warn'?'var(--warn)':'var(--fail)'; const lab=m.status==='ok'?'ok':m.status==='warn'?'внимание':'ошибка';
              return `<div style="display:flex;align-items:center;gap:8px;font-size:12px"><span style="width:8px;height:8px;border-radius:50%;background:${col};flex:none"></span><span class="mono" style="font-size:11px">${m.name}</span><span class="faint mono" style="font-size:10.5px">${m.path}</span><span style="margin-left:auto;color:${m.status!=='ok'?col:'var(--ink-3)'};font-size:11.5px">${m.note} · ${lab}</span></div>`; }).join('')}</div>
            <div class="faint" style="font-size:11px;margin-top:6px">Доступность цепочки монтирований, по которой данные с секвенатора попадают в хранилище, зеркало и веб-выдачу. «${MOUNTS.length-mountsBad.length}/${MOUNTS.length}» — часть точек недоступна или деградирована (подсвечены выше).</div>
          </details></div></div>
        <div class="panel"><div class="panel__h">${sec(icon('alert-triangle')+'Оповещения')}<span class="st st--warn" style="margin-left:6px">${alerts.length}</span></div>
          <div>${alerts.length?alerts.join(''):'<div class="alert muted">Нет оповещений</div>'}</div></div>
      </div>
    </div>`;

  liveT = setInterval(()=>{ /* лёгкая живость: обновление ETA-строки не требуется, тик в шапке уже идёт */ }, 4000);
}
function riskC(r){ return r==='high'?'var(--risk-high)':r==='medium'?'var(--risk-med)':'var(--risk-low)'; }

/* ================= Обработка ================= */
/* ================= Хранилище (К запуску + архив) ================= */
function rStorage(v){
  const selected=new Set();
  const newList=()=>{ const a=[]; STORAGE.forEach(r=>r.files.forEach(f=>{ if(!f.launched) a.push(f); })); return a; };
  v.innerHTML = `
    <div class="ph"><h1>Хранилище</h1><span class="sub">образцы с секвенатора · запуск</span><span class="spacer"></span>
      <button class="btn btn--sm" onclick="toast('Обновлено')">${icon('refresh-cw')} обновить</button></div>
    <div class="panel"><div class="panel__h">${sec(icon('folder')+'К запуску')}<span class="st st--warn" style="margin-left:6px" id="newCnt"></span><span class="spacer"></span>
      <label class="faint" style="font-size:.78rem"><input type="checkbox" class="chk" id="selAll"> все</label>
      <button class="btn btn--sm" id="runSel" disabled>${icon('play')} запустить</button>
      <button class="btn btn--sm btn--pri" id="runAll">${icon('play')} запустить все</button></div>
      <div class="tw"><table class="t"><thead><tr><th style="width:26px"></th><th>SeqID</th><th class="num">Размер</th><th>Статус</th></tr></thead><tbody id="newRows"></tbody></table></div></div>
    <div class="panel" style="margin-top:var(--gap)"><div class="panel__h">${sec(icon('hard-drive')+'Архив загрузок')}<span class="faint" style="font-size:.78rem;margin-left:auto">${STORAGE.length} загрузок</span></div>
      <div id="arch"></div></div>`;
  const nr=v.querySelector('#newRows');
  function updSel(){ const n=selected.size; v.querySelector('#runSel').disabled=n===0; v.querySelector('#runSel').innerHTML=`${icon('play')} запустить${n?' · '+n:''}`; }
  function drawNew(){
    const list=newList(); v.querySelector('#newCnt').textContent=list.length;
    nr.innerHTML = list.length? list.map(f=>`<tr><td><input type="checkbox" class="chk nchk" data-n="${f.basename}" ${selected.has(f.basename)?'checked':''}></td>
      <td class="id">${f.basename}</td><td class="num faint">${f.sizeGb} ГБ</td><td><span class="st st--muted">готов</span></td></tr>`).join('')
      : `<tr><td colspan="4" class="empty">Новых образцов нет — всё запущено</td></tr>`;
    nr.querySelectorAll('.nchk').forEach(c=> c.addEventListener('change',()=>{ c.checked?selected.add(c.dataset.n):selected.delete(c.dataset.n); updSel(); }));
    v.querySelector('#runAll').disabled=!list.length; v.querySelector('#selAll').disabled=!list.length; updSel();
  }
  function drawArch(){
    v.querySelector('#arch').innerHTML = STORAGE.map(r=>{
      const rows=r.files.map(f=>{ const clk=typeof f.id==='number';
        return `<tr${clk?` class="clk" onclick="location.hash='#/sample/${f.id}'"`:''}><td class="id">${f.basename}</td><td class="num faint">${f.sizeGb} ГБ</td><td>${f.launched?stTag(f.status):'<span class="st st--muted">готов</span>'}</td></tr>`; }).join('');
      return `<details class="dd" style="border-top:1px solid var(--line-2);padding:6px 14px"><summary><span class="mono">${r.run}</span> <span class="faint" style="font-size:.72rem">· ${r.ref} · ${r.created} · ${r.files.length} ${plural(r.files.length,P_OBR)}</span></summary>
        <div class="tw" style="margin-top:6px"><table class="t"><thead><tr><th>SeqID</th><th class="num">Размер</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
    }).join('');
  }
  function launch(names){ if(!names.length){ toast('Нет готовых образцов'); return; }
    STORAGE.forEach(r=>r.files.forEach(f=>{ if(names.includes(f.basename)){ f.launched=true; f.status='queued'; }}));
    selected.clear(); v.querySelector('#selAll').checked=false; drawNew(); drawArch(); toast(`${names.length} образц(ов) в очереди обработки`); }
  v.querySelector('#selAll').addEventListener('change',e=>{ nr.querySelectorAll('.nchk').forEach(c=>{ c.checked=e.target.checked; c.checked?selected.add(c.dataset.n):selected.delete(c.dataset.n); }); updSel(); });
  v.querySelector('#runSel').addEventListener('click',()=>launch([...selected]));
  v.querySelector('#runAll').addEventListener('click',()=>launch(newList().map(f=>f.basename)));
  drawNew(); drawArch();
}

/* ================= Обработка (очередь) ================= */
function rProc(v){
  v.innerHTML = `
    <div class="ph"><h1>Обработка</h1><span class="sub">очередь на кластере</span></div>
    <div class="panel"><div class="panel__h">${sec(icon('list-checks')+'Очередь обработки')}<span class="spacer"></span>
      <span class="faint" style="font-size:.78rem" id="qlive"></span>
      <label class="faint" style="font-size:.78rem"><input type="checkbox" class="chk" id="auto" checked> авто</label></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 14px 2px">
        <div class="seg" id="qtabs">
          <button data-s="all" class="on">все&nbsp;<b id="qc-all"></b></button>
          <button data-s="processing">в работе&nbsp;<b id="qc-processing"></b></button>
          <button data-s="queued">в очереди&nbsp;<b id="qc-queued"></b></button>
          <button data-s="done">завершён&nbsp;<b id="qc-done"></b></button>
          <button data-s="error">ошибка&nbsp;<b id="qc-error"></b></button>
        </div>
        <span class="spacer"></span>
        <input class="search" id="qsearch" style="width:250px" placeholder="поиск по SeqID (частичное совпадение)">
      </div>
      <div class="tw"><table class="t"><thead><tr><th>ID</th><th>Создан</th><th>SeqID</th><th>Этапы анализа</th><th class="num">ETA</th><th>Статус</th><th>Логи</th></tr></thead><tbody id="qRows"></tbody></table></div></div>`;
  const Q=JSON.parse(JSON.stringify(QUEUE)); let tsince=0; const openQ=new Set();
  let curFilter='all', curQuery='';
  function counts(){ ['all','processing','queued','done','error'].forEach(k=>{ const n=k==='all'?Q.length:Q.filter(q=>q.status===k).length; const e=v.querySelector('#qc-'+k); if(e) e.textContent=n; }); }
  function visible(){ return Q.filter(q=> (curFilter==='all'||q.status===curFilter) && (!curQuery||q.seqId.toLowerCase().includes(curQuery)) ); }
  const stStatus=(q,i)=> (q.status==='error'&&i===q.stageIdx)?'err' : i<q.stageIdx?'done' : (i===q.stageIdx&&q.status==='processing')?'run':'wait';
  function stepsMini(q){ return `<div style="display:flex;gap:2px">`+PIPELINE_STAGES.map((_,i)=>{ const c=stStatus(q,i); const col=c==='done'?'var(--pass)':c==='run'?'var(--info)':c==='err'?'var(--fail)':'var(--line)'; return `<span style="width:11px;height:5px;border-radius:1px;background:${col}"></span>`; }).join('')+`</div><div class="faint" style="font-size:.68rem;margin-top:2px">${q.status==='processing'?PIPELINE_STAGES[q.stageIdx]:q.status==='error'?'⚠ '+PIPELINE_STAGES[q.stageIdx]:q.status==='done'?'готово':'ожидает'}</div>`; }
  function stageList(q){ const rng=rngFor(q.seqId+'_st'); const dm=q.created.match(/(\d+)\s+(\S+?)\.?\s+(\d+):(\d+)/);
    let day=dm?dm[1]:'09',mon=dm?dm[2]:'июл',hh=dm?+dm[3]:15,mm=dm?+dm[4]:0,ss=between(rng,0,59);
    return `<div class="steps2">`+PIPELINE_STAGES.map((name,i)=>{ const st=stStatus(q,i); let t='',d='';
      if(st==='done'){ t=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; const dM=between(rng,0,26),dS=between(rng,1,59); d=dM?`${dM} мин`:`${dS} сек`; mm+=dM; ss=(ss+dS)%60; while(mm>=60){mm-=60;hh++;} }
      else if(st==='run') t='выполняется'; else if(st==='err') t='ошибка'; else t='—';
      const mk=st==='done'?'✓':st==='err'?'✕':st==='run'?'●':(i+1);
      return `<div class="step2"><span class="mk ${st}">${mk}</span><span class="nm">${name}</span><span class="tm">${t}${d?' · '+d:''}</span></div>`; }).join('')+`</div>`; }
  function drawQ(){
    const rows=v.querySelector('#qRows');
    rows.querySelectorAll('details[data-q]').forEach(d=>{ if(d.open)openQ.add(d.dataset.q); else openQ.delete(d.dataset.q); });
    const rowsHtml = visible().map(q=>{ const idx=q.stageIdx; const eta=q.status==='processing'?Math.max(1,(PIPELINE_STAGES.length-idx)*5)+' мин':q.status==='queued'?'в очереди':'—';
      return `<tr class="${q.status==='done'?'clk':''}" ${q.status==='done'?`onclick="location.hash='#/sample/${q.id}'"`:''} style="vertical-align:top">
        <td class="mono faint">${q.id}</td><td class="mono faint" style="font-size:11px">${q.created}</td><td class="id">${q.seqId}</td>
        <td><details class="dd" data-q="${q.id}" ${openQ.has(String(q.id))?'open':''} onclick="event.stopPropagation()"><summary>${stepsMini(q)}</summary><div style="margin-top:4px;min-width:340px">${stageList(q)}</div></details></td>
        <td class="num faint">${eta}</td><td>${stTag(q.status)}</td>
        <td><a class="mono" style="font-size:11px;cursor:pointer" onclick="event.stopPropagation();toast('status.log')">status.log</a></td></tr>`;
    }).join('');
    rows.innerHTML = rowsHtml || '<tr><td colspan="7" class="empty">Ничего не найдено</td></tr>';
    counts();
  }
  function qlive(){ const a=Q.filter(q=>q.status==='processing').length; v.querySelector('#qlive').innerHTML=`<span class="live"></span>${a} в работе · обновлено ${tsince}с`; }
  function tick(){ if(!v.querySelector('#auto').checked){ tsince+=2; qlive(); return; } tsince=0;
    Q.forEach(q=>{ if(q.status==='processing'&&Math.random()>.4){ q.stageIdx++; if(q.stageIdx>=PIPELINE_STAGES.length){ q.status='done'; q.stageIdx=PIPELINE_STAGES.length; const nx=Q.find(x=>x.status==='queued'); if(nx){ nx.status='processing'; nx.stageIdx=1; } } } });
    drawQ(); qlive(); }
  v.querySelectorAll('#qtabs button').forEach(b=>b.addEventListener('click',()=>{ v.querySelectorAll('#qtabs button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); curFilter=b.dataset.s; drawQ(); }));
  v.querySelector('#qsearch').addEventListener('input',e=>{ curQuery=e.target.value.trim().toLowerCase(); drawQ(); });
  drawQ(); qlive();
  liveT=setInterval(()=>{ tsince+=2; if(v.querySelector('#auto')&&v.querySelector('#auto').checked) tick(); else qlive(); }, 2000);
}

/* ================= Пациенты (реестр + QC) ================= */
function rResults(v, sub){
  let tab = sub==='qc'?'qc':'reg';
  v.innerHTML = `
    <div class="ph"><h1>Пациенты</h1><span class="sub">реестр и контроль качества</span></div>
    <div class="seg" id="tabs" style="margin-bottom:10px"><button data-t="reg">Реестр</button><button data-t="qc">Контроль качества</button></div>
    <div id="c"></div>`;
  const c=v.querySelector('#c');
  function setTab(t){ tab=t; v.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); t==='qc'?drawQC(c):drawReg(c); }
  v.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.t)));
  setTab(tab);
}
function drawReg(c){
  c.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input class="search" id="q" style="width:280px" placeholder="ФИО / SeqID / код / ERP">
      <select class="sel" id="fs"><option value="">все статусы</option><option value="done">завершён</option><option value="processing">в работе</option><option value="queued">в очереди</option><option value="error">ошибка</option></select>
      <select class="sel" id="fr"><option value="">любой риск</option><option value="high">высокий</option><option value="medium">средний</option><option value="low">низкий</option></select>
      <span class="spacer"></span><span class="faint mono" id="cnt" style="align-self:center;font-size:.72rem"></span></div>
    <div class="panel tw"><table class="t"><thead><tr><th>ID</th><th>ФИО пациента</th><th>Контрагент</th><th>ERP</th><th>SeqID</th><th>Статус</th><th>QC</th><th class="num">Скор (ML)</th><th>Риск</th><th>Заключение</th><th>Дата</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const qi=c.querySelector('#q'); qi.value=minSearch||'';
  function apply(){ const q=qi.value.trim().toLowerCase(); minSearch=qi.value.trim(); const st=c.querySelector('#fs').value, r=c.querySelector('#fr').value;
    const list=SAMPLES.filter(s=>{ if(q&&!(s.seqId.toLowerCase().includes(q)||s.fio.toLowerCase().includes(q)||s.patientCode.toLowerCase().includes(q)||String(s.patientNo).toLowerCase().includes(q))) return false;
      if(st&&s.status!==st) return false; if(r&&(!s.score||s.score.risk!==r)) return false; return true; }).sort((a,b)=>b.id-a.id);
    c.querySelector('#cnt').textContent=`${list.length} / ${SAMPLES.length}`;
    c.querySelector('#rows').innerHTML = list.length? list.map(s=>`<tr class="clk" onclick="location.hash='#/sample/${s.id}'">
      <td class="mono faint">${s.id}</td><td>${s.fio}</td><td class="faint" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${s.contractor}</td>
      <td class="mono faint">${s.patientNo}</td><td class="id">${s.seqId}</td><td>${stTag(s.status)}</td>
      <td>${s.status==='done'?qcTag(s.qc.verdict):'<span class="faint">—</span>'}</td>
      <td class="num">${s.score?`<b style="color:${riskC(s.score.risk)}">${pct(s.score.cancerProb)}</b>`:'<span class="faint">—</span>'}</td>
      <td>${s.score?riskTag(s.score.risk):'<span class="faint">—</span>'}</td>
      <td>${s.status==='done'?`<a class="mono" style="font-size:11px" href="#/report/${s.id}" onclick="event.stopPropagation()">открыть</a>`:'<span class="faint">—</span>'}</td>
      <td class="mono faint">${s.date}</td></tr>`).join('') : `<tr><td colspan="11" class="empty">Ничего не найдено</td></tr>`;
  }
  qi.addEventListener('input',apply); ['fs','fr'].forEach(id=>c.querySelector('#'+id).addEventListener('change',apply)); apply();
}
function drawQC(c){
  const done=SAMPLES.filter(s=>s.status==='done'); const pass=done.filter(s=>s.qc.verdict==='Pass').length;
  const convMetric=s=>s.qc.metrics.find(x=>x.key==='conversion');
  const convAvg = done.length? (done.reduce((a,s)=>{ const m=convMetric(s); return a+(m?m.value:0); },0)/done.length).toFixed(4) : '—';
  // столбцы = все метрики, кроме ридов, сгруппированные по блокам qc.json
  const schema = (SAMPLES[0]&&SAMPLES[0].qc.metrics)||[];
  const cols = QC_BLOCKS.flatMap(bl=> schema.filter(m=>m.block===bl.key).map(m=>({block:bl.key, key:m.key, short:m.short})) );
  const groupHead = QC_BLOCKS.map(bl=>{ const n=cols.filter(cc=>cc.block===bl.key).length; return n?`<th colspan="${n}" class="qc-grp">${bl.label}</th>`:''; }).join('');
  const metricHead = cols.map(cc=>`<th class="num">${cc.short}</th>`).join('');
  c.innerHTML = `
    <div class="strip" style="margin-bottom:10px">
      <div class="strip__i"><span class="strip__n">${done.length}</span><span class="strip__l">${plural(done.length,P_OBR)}</span></div>
      <div class="strip__i b-pass"><span class="strip__n">${pass}</span><span class="strip__l">pass</span></div>
      <div class="strip__i b-fail"><span class="strip__n">${done.length-pass}</span><span class="strip__l">fail</span></div>
      <div class="strip__i"><span class="strip__n">${convAvg}</span><span class="strip__l">средняя конверсия</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap"><div class="seg" id="ff"><button data-f="all" class="on">все</button><button data-f="Pass">pass</button><button data-f="Fail">fail</button></div>
      <input class="search" id="qcq" style="width:220px" placeholder="поиск по SeqID (частичное совпадение)">
      <span class="spacer"></span>
      <button class="btn btn--sm" id="qcExport">${icon('download')} экспорт (TSV)</button></div>
    <div class="faint" style="font-size:11px;margin-bottom:6px">Показаны все метрики контроля качества, кроме ридов (риды — в карточке образца, блок «Дополнительные метрики»). Метрики сгруппированы по блокам qc.json; таблица прокручивается вправо →</div>
    <div class="panel tw"><table class="t qc-wide"><thead>
      <tr><th rowspan="2">SeqID</th><th rowspan="2">Итог</th><th rowspan="2">Метрики вне порогов</th>${groupHead}</tr>
      <tr>${metricHead}</tr></thead><tbody id="qcr"></tbody></table></div>`;
  let filter='all';
  const cell=m=>{ if(!m)return '<td class="num faint">—</td>'; const col=m.threshold==='справочно'?'var(--ink-2)':m.pass?'var(--ink)':'var(--fail)'; return `<td class="num" style="color:${col}">${m.value}</td>`; };
  function filteredList(){ const q=c.querySelector('#qcq').value.trim().toLowerCase();
    return done.filter(s=>(filter==='all'||s.qc.verdict===filter)&&(!q||s.seqId.toLowerCase().includes(q))); }
  function draw(){ const list=filteredList();
    c.querySelector('#qcr').innerHTML=list.length?list.map(s=>{ const mv=k=>s.qc.metrics.find(x=>x.key===k);
      return `<tr class="clk" onclick="location.hash='#/sample/${s.id}'"><td class="id">${s.seqId}</td><td>${qcTag(s.qc.verdict)}</td>
      <td class="faint" style="font-size:11px">${s.qc.failed.length?s.qc.failed.join(', '):'—'}</td>
      ${cols.map(cc=>cell(mv(cc.key))).join('')}</tr>`; }).join('')
      :`<tr><td colspan="${3+cols.length}" class="empty">Ничего не найдено</td></tr>`; }
  function exportTsv(){ const list=filteredList();
    const header=['SeqID','Итог','Метрики вне порогов', ...cols.map(cc=>{ const m=schema.find(x=>x.key===cc.key); return m.name+(m.unit?' ('+m.unit+')':''); })];
    const rows=list.map(s=>{ const mv=k=>s.qc.metrics.find(x=>x.key===k);
      return [s.seqId, s.qc.verdict, s.qc.failed.join('; '), ...cols.map(cc=>{ const m=mv(cc.key); return m?m.value:''; })]; });
    const tsv=[header,...rows].map(r=>r.join('\t')).join('\n');
    downloadText(`EpiPrint_QC_${filter}.tsv`, tsv, 'text/tab-separated-values');
    toast(`Экспортировано строк: ${list.length}`); }
  c.querySelectorAll('#ff button').forEach(b=>b.addEventListener('click',()=>{ c.querySelectorAll('#ff button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); filter=b.dataset.f; draw(); }));
  c.querySelector('#qcExport').addEventListener('click',exportTsv);
  c.querySelector('#qcq').addEventListener('input',draw); draw();
}

/* ================= Карточка образца (LIMS) ================= */
function rSample(v, id){
  const s=sampleById(id)||SAMPLES[0];
  const d=new Date(s.date+'T00:00:00'); const fmt=x=>`${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`;
  const coll=new Date(d); coll.setDate(d.getDate()-3);
  const head = `
    <a class="btn btn--sm" href="#/results" style="margin-bottom:10px">${icon('arrow-left')} к реестру</a>
    <div class="lims-head" style="margin-bottom:var(--gap)">
      <span class="id">${s.seqId}</span>${stTag(s.status)}${s.status==='done'?qcTag(s.qc.verdict):''}${s.score?riskTag(s.score.risk):''}
      <span class="m">${s.ref}</span><span class="m">Vazyme</span><span class="m">${s.run}</span>
      <span class="spacer"></span>
      <a class="btn btn--sm btn--pri" href="#/report/${s.id}">${icon('file-text')} заключение</a>
    </div>`;

  if(s.status!=='done'){
    const idx=s.status==='processing'?4:s.status==='error'?3:0;
    v.innerHTML = head + `<div class="panel"><div class="panel__h">${sec(icon('clock')+'Обработка')}</div><div class="panel__b">
      <div class="steps2">${PIPELINE_STAGES.map((n,i)=>{ const st=i<idx?'done':(i===idx&&s.status==='processing')?'run':(i===idx&&s.status==='error')?'err':'wait';
        const mk=st==='done'?'✓':st==='err'?'✕':st==='run'?'●':(i+1);
        return `<div class="step2"><span class="mk ${st}">${mk}</span><span class="nm">${n}</span><span class="tm">${st==='done'?'готово':st==='run'?'выполняется':st==='err'?'ошибка':'—'}</span></div>`; }).join('')}</div>
      ${s.status==='error'?`<div class="alert" style="color:var(--fail);margin-top:8px">${icon('circle-x')} Обработка остановлена на этапе «${PIPELINE_STAGES[idx]}». Проверьте логи.</div>`:''}
    </div></div>`;
    return;
  }
  const sc=s.score; const g=k=>s.qc.metrics.find(m=>m.key===k);
  const lead=(k,v2,ok)=>`<div class="lead"><span class="k">${k}</span><span class="d"></span><span class="v ${ok===true?'pass':ok===false?'fail':''}">${v2}</span></div>`;

  // метаданные (компактно, второстепенно для биоинформатика)
  const meta = `<div class="panel"><div class="panel__h">${sec(icon('file-text')+'Метаданные')}</div><div class="panel__b">
    <div class="kvcols">
      <div><div class="k">ФИО</div><div class="v" style="font-family:var(--body)">${s.fio}</div></div>
      <div><div class="k">Пол / возраст</div><div class="v">${s.sex==='Ж'?'женский':'мужской'}, ${s.age}</div></div>
      <div><div class="k">Контрагент</div><div class="v" style="font-family:var(--body)">${s.contractor}</div></div>
      <div><div class="k">ERP</div><div class="v">${s.patientNo}</div></div>
      <div><div class="k">Биоматериал</div><div class="v" style="font-family:var(--body)">плазма, cfDNA</div></div>
      <div><div class="k">Забор → готовность</div><div class="v">${fmt(coll)} → ${fmt(d)}</div></div>
      <div><div class="k">Референс</div><div class="v">GRCh38 (${s.ref})</div></div>
      <div><div class="k">Договор</div><div class="v">Д-${s.id}/26</div></div>
    </div></div></div>`;

  // QC (главное для биоинформатика) + прогноз рядом — метрики сгруппированы по блокам qc.json
  const renderLead = m => { const gated=m.threshold!=='справочно'; const ok=gated?m.pass:null;
    const thr = gated ? `<span class="qc-thr" title="Порог из литературы: ${(m.src||'').replace(/"/g,'&quot;')}">${m.threshold}</span>` : `<span class="qc-thr faint" title="Числового порога в литературе нет — показатель справочный">справочно</span>`;
    return `<div class="lead"><span class="k">${m.name}</span><span class="d"></span>${thr}<span class="v ${ok===true?'pass':ok===false?'fail':''}">${fmtMetric(m)}</span></div>`; };
  const qcBlocksHtml = QC_BLOCKS.map(bl=>{ const ms=s.qc.metrics.filter(m=>m.block===bl.key); if(!ms.length) return '';
    return `<div class="qc-block"><div class="qc-block__h">${bl.label}</div><div class="leads">${ms.map(renderLead).join('')}</div></div>`; }).join('');
  const readsMetrics = s.qc.metrics.filter(m=>m.block==='reads');

  const qcPanel = `<div class="panel"><div class="panel__h">${sec(icon('shield-check')+'Контроль качества')}<span class="spacer"></span>${qcTag(s.qc.verdict)}</div><div class="panel__b">
    ${qcBlocksHtml}
    ${s.qc.failed.length?`<div class="alert" style="color:var(--warn);padding-left:0">${icon('alert-triangle')} вне порогов: ${s.qc.failed.join(', ')}</div>`:''}
    <details class="dd" style="margin-top:8px"><summary>${QC_READS_LABEL}</summary><div class="leads" style="margin-top:4px">${readsMetrics.map(renderLead).join('')}</div></details>
  </div></div>`;

  const locBars = CANCER_TYPES.map(t=>({...t,x:sc.localization[t.key]})).sort((a,b)=>b.x-a.x).map((e)=>`
    <div class="loc ${e.key===sc.topType&&sc.cancerProb>0.5?'hi':''}"><span class="nm">${e.label}</span><span class="t"><i style="width:${Math.max(2,e.x*100).toFixed(0)}%"></i></span><span class="vv">${pct(e.x,1)}</span></div>`).join('');
  const predPanel = `<div class="panel"><div class="panel__h">${sec(icon('activity')+'Прогноз — ML-модель')}</div><div class="panel__b">
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px">
      <span class="score-big ${sc.risk}">${pct(sc.cancerProb)}</span><span class="faint" style="font-size:12px">вероятность онкопроцесса</span><span class="spacer"></span>${riskTag(sc.risk)}</div>
    <div style="font-size:12.5px;color:var(--ink-2);margin-bottom:8px">${sc.cancerProb>0.5?`Наиболее вероятная локализация — <b>${cancerLabel(sc.topType)}</b>.`:'Признаков онкопроцесса не выявлено.'}</div>
    ${sec(icon('dna')+'Локализация')}<div style="margin-top:6px">${locBars}</div>
  </div></div>`;

  // пайплайн
  const pipe = `<div class="panel"><div class="panel__h">${sec(icon('list-checks')+'Обработка · '+PIPELINE_STAGES.length+' этапов')}<span class="spacer"></span><span class="faint mono" style="font-size:.72rem">${SYS.avgMin} мин</span></div><div class="panel__b">
    <div class="steps2">${PIPELINE_STAGES.map((n,i)=>`<div class="step2"><span class="mk done">✓</span><span class="nm">${n}</span><span class="tm">готово</span></div>`).join('')}</div></div></div>`;

  // файлы
  const files = `<div class="panel"><div class="panel__h">${sec(icon('folder')+'Файлы')}</div><div class="panel__b"><div class="files">
    <div class="file"><span class="fn">${s.seqId}_R1.fastq.gz</span><span class="fz">3.9 ГБ</span><a onclick="toast('Скачивание FASTQ')">↓</a></div>
    <div class="file"><span class="fn">${s.seqId}_R2.fastq.gz</span><span class="fz">3.9 ГБ</span><a onclick="toast('Скачивание FASTQ')">↓</a></div>
    <div class="file"><span class="fn">${s.seqId}.bam</span><span class="fz">6.1 ГБ</span><a onclick="toast('Скачивание BAM')">↓</a></div>
    <div class="file"><span class="fn">${s.seqId}.CpG.bedGraph</span><span class="fz">1.4 ГБ</span><a onclick="toast('Скачивание профиля')">↓</a></div>
    <div class="file"><span class="fn">profile.tsv</span><span class="fz">1.5 ГБ</span><a onclick="toast('Скачивание TSV')">↓</a></div>
    <div class="file"><span class="fn">QC_${s.seqId}.json</span><span class="fz">~1 КБ</span><a onclick="downloadSampleQc('${s.id}')" title="Скачать qc.json">↓</a></div>
  </div></div></div>`;

  const heat = `<div class="panel"><div class="panel__h">${sec(icon('dna')+'Наиболее изменённые локусы')}<span class="spacer"></span><a class="btn btn--sm" onclick="toast('Скачивание profile.tsv (полный профиль)')">${icon('download')} полный профиль (TSV)</a></div><div class="panel__b">
    <div class="faint" style="font-size:12px;margin-bottom:8px">Платформа автоматически рассчитывает отклонение метилирования образца (Δ) относительно усреднённого референса нормы и строит тепловую карту. Референсы нормы и опухоли — это когорты из нескольких образцов (не единичные пробы); способ усреднения по когорте пока обсуждается. Показаны регионы с наибольшим вкладом в оценку модели; полный профиль по ${s.heatmap.N} регионам — в TSV.</div>
    <div class="tw" id="loci"></div>
    <details class="dd" style="margin-top:10px"><summary>Тепловая карта по всем регионам (с локализацией)</summary><div id="hm" style="margin-top:8px"></div></details></div></div>`;

  const fb=`<div class="panel"><div class="panel__h">${sec(icon('users')+'Обратная связь')}</div><div class="panel__b"><div id="fbx"></div></div></div>`;

  v.innerHTML = head + meta
    + `<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:var(--gap)">${qcPanel}${predPanel}</div>`
    + `<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:var(--gap)">${pipe}${files}</div>`
    + `<div style="margin-top:var(--gap)">${heat}</div>`
    + `<div style="margin-top:var(--gap)">${fb}</div>`;
  v.querySelector('#loci').innerHTML = topLociTable(s.heatmap);
  v.querySelector('#hm').innerHTML = heatmapLoc(s.heatmap);
  drawFb(s, v.querySelector('#fbx'));
}
function drawFb(s, host){
  const fb=getFeedback(s);
  host.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-size:12.5px">Диагноз подтверждён по результатам дообследования?</div>
    <div class="fb-opts"><label class="fb-opt ${fb.confirmed==='yes'?'on-y':''}"><input type="radio" name="fb" value="yes" ${fb.confirmed==='yes'?'checked':''} style="accent-color:var(--pass)"> да</label>
      <label class="fb-opt ${fb.confirmed==='no'?'on-n':''}"><input type="radio" name="fb" value="no" ${fb.confirmed==='no'?'checked':''} style="accent-color:var(--fail)"> нет</label></div>
    <div id="lw" style="${fb.confirmed==='yes'?'':'display:none'}"><select class="sel" id="ls"><option value="">локализация — не указана</option>${CANCER_TYPES.map(t=>`<option value="${t.key}" ${fb.locConfirmed===t.key?'selected':''}>${t.label}</option>`).join('')}</select></div>
    <textarea class="ta" id="fn" placeholder="комментарий">${escapeHtml(fb.note||'')}</textarea>
    <div><button class="btn btn--sm btn--pri" id="fsv">сохранить исход</button> ${fb.date?`<span class="faint mono" style="font-size:.7rem">обновлено ${fb.date}</span>`:''}</div></div>`;
  host.querySelectorAll('input[name="fb"]').forEach(r=>r.addEventListener('change',()=>{ host.querySelector('.fb-opt.on-y')?.classList.remove('on-y'); host.querySelector('.fb-opt.on-n')?.classList.remove('on-n');
    if(r.value==='yes')r.closest('.fb-opt').classList.add('on-y'); else r.closest('.fb-opt').classList.add('on-n');
    host.querySelector('#lw').style.display=(host.querySelector('input[name="fb"]:checked')||{}).value==='yes'?'':'none'; }));
  host.querySelector('#fsv').addEventListener('click',()=>{ const val=(host.querySelector('input[name="fb"]:checked')||{}).value||null; if(!val){ toast('Выберите вариант'); return; }
    saveFeedback(s.id,{confirmed:val,locConfirmed:host.querySelector('#ls').value,note:host.querySelector('#fn').value,date:'2026-07-10'}); toast('Исход сохранён'); drawFb(s,host); });
}

/* ================= Заключения ================= */
function rConcl(v){
  const done=SAMPLES.filter(s=>s.status==='done'&&s.score);
  v.innerHTML=`<div class="ph"><h1>Заключения</h1><span class="sub">лабораторные отчёты</span></div>
    <div class="panel tw"><table class="t"><thead><tr><th>SeqID</th><th>Пациент</th><th>Результат</th><th>Риск</th><th>Дата</th><th></th></tr></thead><tbody>${done.sort((a,b)=>b.id-a.id).map(s=>{ const det=s.score.cancerProb>0.5;
      return `<tr class="clk" onclick="location.hash='#/report/${s.id}'"><td class="id">${s.seqId}</td><td>${s.fio}</td>
        <td><span class="st st--${det?'fail':'pass'}">${det?'сигнал обнаружен':'сигнал не обнаружен'}</span></td><td>${riskTag(s.score.risk)}</td>
        <td class="mono faint">${s.date}</td><td class="right"><a class="mono" style="font-size:11px" href="#/report/${s.id}" onclick="event.stopPropagation()">открыть →</a></td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ================= Пользователи ================= */
function rUsers(v){
  const users=[['Варвара Юхина','vyukhina','Администратор','pass','полный доступ','сегодня, 09:41',true],
    ['А. Петрова','vsmirnova','Биоинформатик','muted','обработка, пайплайн, QC','сегодня, 08:12',true],
    ['Даниил Орлов','dorlov','Биоинформатик','muted','обработка, пайплайн','вчера, 19:03',true],
    ['Зав. лабораторией','headlab','Заведующий лабораторией','med','подпись заключений','вчера, 17:30',true],
    ['Ольга Лаборант','olab','Лаборант','muted','загрузка и запуск','вчера, 10:05',true],
    ['Наблюдатель','viewer','Наблюдатель','muted','только просмотр','—',false]];
  v.innerHTML=`<div class="ph"><h1>Пользователи</h1><span class="sub">доступ и роли</span><span class="spacer"></span><button class="btn btn--sm btn--pri" onclick="toast('Добавление пользователя')">${icon('users')} добавить</button></div>
    <div class="panel tw"><table class="t"><thead><tr><th>Пользователь</th><th>Логин</th><th>Роль</th><th>Права</th><th>Последний вход</th><th>Статус</th></tr></thead><tbody>${users.map(u=>`<tr>
      <td>${u[0]}</td><td class="mono faint">${u[1]}</td><td><span class="st st--${u[3]}">${u[2]}</span></td><td class="faint">${u[4]}</td><td class="mono faint">${u[5]}</td>
      <td>${u[6]?'<span class="st st--pass">активен</span>':'<span class="st st--muted">отключён</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ================= Заключение (reuse) ================= */
function rReport(v, id, sub){
  const s=sampleById(id)||SAMPLES.find(x=>x.status==='done'); const variant=sub==='full'?'full':'compact';
  v.innerHTML = `<div class="hstack" style="display:flex;gap:8px;max-width:210mm;margin:0 auto 10px" class="no-print">
    <a class="btn btn--sm" href="#/sample/${s.id}">${icon('arrow-left')} к образцу</a><span class="spacer" style="flex:1"></span>
    <button class="btn btn--sm" onclick="window.print()">${icon('printer')} печать / PDF</button></div>` + buildReportDoc(s, variant);
}

/* ================= Роутер ================= */
const ROUTES = { dashboard:['Обзор','dashboard',rDash], storage:['Хранилище','storage',rStorage], processing:['Обработка','processing',rProc], results:['Пациенты','results',rResults],
  conclusions:['Заключения','conclusions',rConcl], sample:['Образец','results',rSample], report:['Заключение','conclusions',rReport], users:['Пользователи','users',rUsers] };
function router(){
  stopT();
  const h=location.hash.replace(/^#\/?/,''); const p=h.split('/'); let route=p[0], id=p[1], sub=p[2];
  if(!route||!ROUTES[route]) route='dashboard';
  const def=ROUTES[route]; shell(def[1], def[0]);
  const v=document.getElementById('view'); v.innerHTML='';
  def[2](v, id, sub); window.scrollTo(0,0);
}
window.addEventListener('hashchange', router);
router();
