/* ============================================================
   EpiPrint — единый SPA-слой (hash-роутинг).
   Разделы: Обзор · Обработка · Результаты · Заключения · Система.
   ============================================================ */

let liveTimer = null;
let samplesSearch = '';
function stopTimers(){ if (liveTimer){ clearInterval(liveTimer); liveTimer=null; } }
function riskColor(r){ return r==='high'?'var(--risk-high)':r==='medium'?'var(--risk-med)':'var(--risk-low)'; }
function tile(label,value,ic,sub){ return `<div class="stat"><div class="stat__label"><span class="ic">${icon(ic)}</span>${label}</div><div class="stat__value">${value}</div><div class="stat__sub">${sub}</div></div>`; }
const STUDY_TYPE = 'Метилирование cfDNA · ранняя диагностика онкологического процесса';
const BIOMATERIAL = 'Плазма крови (cfDNA)';

const NAV_SPA = [
  { route:'dashboard',   label:'Обзор',       icon:'layout-dashboard' },
  { route:'processing',  label:'Обработка',   icon:'list-checks' },
  { route:'results',     label:'Пациенты',    icon:'microscope' },
  { route:'conclusions', label:'Заключения',  icon:'file-text' },
  { group:'Служебное' },
  { route:'users',       label:'Пользователи', icon:'users' },
];

function renderShellSPA(activeNav, title){
  const newCount = STORAGE.reduce((a,r)=> a + r.files.filter(f=>!f.launched).length, 0);
  const activeCount = SAMPLES.filter(s=> s.status==='processing'||s.status==='queued').length;
  const nav = NAV_SPA.map(n=>{
    if (n.group) return `<div class="nav__group">${n.group}</div>`;
    let badge='';
    if (n.route==='processing' && (newCount+activeCount)) badge = `<span class="nav__badge">${newCount+activeCount}</span>`;
    return `<a class="nav__item ${activeNav===n.route?'is-active':''}" href="#/${n.route}">${icon(n.icon)}<span>${n.label}</span>${badge}</a>`;
  }).join('');

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">
      <div class="brand__mark">${icon('fingerprint')}</div>
      <div><div class="brand__name">EpiPrint</div><div class="brand__sub">cfDNA Methylation</div></div>
    </div>
    <nav class="nav">${nav}</nav>
    <div class="sidebar__foot">Прототип · v0.1 · демо-данные</div>`;

  document.getElementById('topbar').innerHTML = `
    <div class="topbar__title">${title}</div>
    <div class="topbar__spacer"></div>
    <label class="topbar__search">${icon('search')}<input placeholder="Поиск по SeqID…" id="globalSearch"></label>
    <div class="topbar__user"><div class="avatar">${CURRENT_USER.initials}</div></div>`;
  const gs = document.getElementById('globalSearch');
  gs.addEventListener('keydown', e=>{ if(e.key==='Enter' && gs.value.trim()){ samplesSearch=gs.value.trim(); location.hash='#/results'; }});
}

/* ================= Обзор (сводка за 7 дней) ================= */
function renderDashboard(param, view){
  const done = SAMPLES.filter(s=>s.status==='done');
  const activeN = SAMPLES.filter(s=> s.status==='processing'||s.status==='queued').length;
  const newN = STORAGE.reduce((a,r)=> a + r.files.filter(f=>!f.launched).length, 0);
  const passN = done.filter(s=>s.qc.verdict==='Pass').length, failN = done.length-passN;
  const processed7d = STATS.throughput7d.reduce((a,b)=>a+b,0);
  const recent = [...SAMPLES].sort((a,b)=>b.id-a.id).slice(0,7);

  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Сводка</div><h1>Обзор</h1></div>
      <a class="btn btn--primary" href="#/processing">${icon('play')} К обработке${newN?' · '+newN:''}</a></div>

    <div class="grid grid-4" style="margin-bottom:16px">
      ${tile('Обработано за 7 дней', processed7d, 'circle-check', 'завершённых образцов')}
      ${tile('В работе', activeN, 'clock', 'в обработке и очереди')}
      ${tile('Осталось запустить', newN, 'folder', 'новых образцов')}
      ${tile('Контроль качества', passN+' / '+failN, 'shield-check', 'pass / fail')}
    </div>

    <div class="card"><div class="card__head"><div class="section-title">${icon('microscope')} Последние образцы</div>
      <a class="btn btn--sm btn--ghost" href="#/results">Все результаты</a></div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>SeqID</th><th>Пациент</th><th>Статус</th><th>QC</th><th>Скор (ML)</th><th>Локализация</th><th>Дата</th>
      </tr></thead><tbody>${recent.map(s=>`
        <tr class="clickable" onclick="location.hash='#/sample/${s.id}'">
          <td class="id">${s.seqId}</td><td style="font-size:.82rem">${s.fio}</td><td>${statusBadge(s.status)}</td>
          <td>${s.status==='done'?qcBadge(s.qc.verdict):'<span class="muted">—</span>'}</td>
          <td>${s.score?`<b style="color:${riskColor(s.score.risk)}">${pct(s.score.cancerProb)}</b>`:'<span class="muted">—</span>'}</td>
          <td>${s.score&&s.score.cancerProb>0.5?cancerLabel(s.score.topType):'<span class="muted">—</span>'}</td>
          <td class="mono muted">${s.date}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ================= Обработка (запуск + очередь) ================= */
function renderProcessing(param, view){
  const selected = new Set();
  const newList = ()=>{ const a=[]; STORAGE.forEach(r=> r.files.forEach(f=>{ if(!f.launched) a.push({run:r.run, f}); })); return a; };

  view.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Обработка образцов</div><h1>Обработка</h1>
        <p class="muted">Запуск и мониторинг обработки образцов.</p></div>
      <button class="btn" id="refreshBtn">${icon('refresh-cw')} Обновить</button>
    </div>

    <div class="card">
      <div class="card__head">
        <div class="section-title">${icon('folder')} К запуску <span class="badge badge--warn" id="newCount"></span></div>
        <div class="hstack">
          <label class="hstack" style="font-size:.82rem"><input type="checkbox" class="checkbox" id="selectAll"> Выбрать все</label>
          <button class="btn btn--sm" id="runSelBtn" disabled>${icon('play')} Запустить выбранные</button>
          <button class="btn btn--primary btn--sm" id="runAllBtn">${icon('play')} Запустить все</button>
        </div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th style="width:34px"></th><th>SeqID</th><th>Размер</th><th>Статус</th></tr></thead>
        <tbody id="newRows"></tbody>
      </table></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card__head">
        <div class="section-title">${icon('list-checks')} Очередь обработки</div>
        <div class="hstack"><span class="chip" id="liveChip"></span>
          <label class="hstack" style="font-size:.85rem;font-weight:600"><input type="checkbox" class="checkbox" id="autoToggle" checked> Автообновление</label></div>
      </div>
      <div style="padding:12px 18px 0"><div class="segmented" id="qfilter">
        <button data-f="all" class="is-active">Все</button><button data-f="processing">В обработке</button>
        <button data-f="queued">В очереди</button><button data-f="done">Завершён</button><button data-f="error">Ошибка</button>
      </div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>ID</th><th>Создан</th><th>SeqID</th><th style="min-width:180px">Стадии анализа</th><th>Статус</th><th>Логи</th>
      </tr></thead><tbody id="qrows"></tbody></table></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card__head" id="archHead" style="cursor:pointer">
        <div class="section-title">${icon('hard-drive')} Архив загрузок</div>
        <span class="hstack muted" style="font-size:.8rem"><span id="archMeta"></span><span id="archChev" style="display:inline-flex;transition:transform .15s">${icon('chevron-right')}</span></span>
      </div>
      <div id="archBody" style="display:none"></div>
    </div>`;

  const newRowsEl = view.querySelector('#newRows');
  function updSel(){ const n=selected.size; view.querySelector('#runSelBtn').disabled=n===0; view.querySelector('#runSelBtn').innerHTML=`${icon('play')} Запустить выбранные${n?' · '+n:''}`; }
  function drawNew(){
    const list = newList();
    view.querySelector('#newCount').textContent = list.length;
    view.querySelector('#runAllBtn').disabled = list.length===0;
    view.querySelector('#selectAll').disabled = list.length===0;
    newRowsEl.innerHTML = list.length ? list.map(({f})=>`
      <tr>
        <td><input type="checkbox" class="checkbox nchk" data-name="${f.basename}" ${selected.has(f.basename)?'checked':''}></td>
        <td class="id">${icon('folder')} ${f.basename}</td>
        <td class="num muted">${f.sizeGb} ГБ</td>
        <td><span class="badge badge--muted"><span class="dot"></span>Готов к запуску</span></td>
      </tr>`).join('')
      : `<tr><td colspan="4" class="tbl__empty">${icon('check')} Новых образцов нет — всё запущено</td></tr>`;
    newRowsEl.querySelectorAll('.nchk').forEach(chk=> chk.addEventListener('change', ()=>{ chk.checked?selected.add(chk.dataset.name):selected.delete(chk.dataset.name); updSel(); }));
    updSel();
  }
  function drawArch(){
    view.querySelector('#archMeta').textContent = `${STORAGE.length} загрузок · `;
    view.querySelector('#archBody').innerHTML = STORAGE.map(r=>{
      const total=r.files.length, nw=r.files.filter(f=>!f.launched).length;
      const rows = r.files.map(f=>`<tr>
        <td class="id">${icon('folder')} ${f.basename}</td>
        <td class="num muted">${f.sizeGb} ГБ</td>
        <td>${f.launched? statusBadge(f.status):'<span class="badge badge--muted"><span class="dot"></span>Готов</span>'}</td></tr>`).join('');
      return `<div style="border-top:1px solid var(--line-2)">
        <div class="hstack" style="padding:11px 18px;justify-content:space-between">
          <div class="hstack"><b class="mono">${r.run}</b><span class="chip">${r.ref}</span>${nw?`<span class="badge badge--warn">${nw} к запуску</span>`:`<span class="badge badge--pass">${icon('check')}запущены</span>`}</div>
          <span class="muted" style="font-size:.78rem">${r.created} · ${total} обр.</span>
        </div>
        <div class="table-wrap" style="padding:0 10px 10px"><table class="tbl">
          <thead><tr><th>SeqID</th><th>Размер</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
    }).join('');
  }
  function launch(names){
    if(!names.length){ toast('Нет готовых к запуску образцов'); return; }
    STORAGE.forEach(r=> r.files.forEach(f=>{ if(names.includes(f.basename)){ f.launched=true; f.status='queued'; }}));
    selected.clear(); view.querySelector('#selectAll').checked=false;
    drawNew(); drawArch();
    toast(`${names.length} образц(ов) поставлено в очередь обработки`);
  }
  view.querySelector('#selectAll').addEventListener('change', e=>{
    newRowsEl.querySelectorAll('.nchk').forEach(chk=>{ chk.checked=e.target.checked; chk.checked?selected.add(chk.dataset.name):selected.delete(chk.dataset.name); }); updSel();
  });
  view.querySelector('#runSelBtn').addEventListener('click', ()=> launch([...selected]));
  view.querySelector('#runAllBtn').addEventListener('click', ()=> launch(newList().map(x=>x.f.basename)));
  view.querySelector('#refreshBtn').addEventListener('click', ()=> toast('Обновлено'));
  view.querySelector('#archHead').addEventListener('click', ()=>{
    const b=view.querySelector('#archBody'), open=b.style.display!=='none';
    b.style.display=open?'none':''; view.querySelector('#archChev').style.transform=open?'':'rotate(90deg)';
  });

  const Q = JSON.parse(JSON.stringify(QUEUE));
  let filter='all', lastUpdate=0;
  const openStages = new Set();
  const stStatus = (q,i)=> (q.status==='error'&&i===q.stageIdx)?'error' : i<q.stageIdx?'done' : (i===q.stageIdx&&q.status==='processing')?'active' : 'wait';
  const pips = q=>`<div class="stages">`+PIPELINE_STAGES.map((_,i)=>`<span class="stage-pip ${stStatus(q,i)==='wait'?'':stStatus(q,i)}"></span>`).join('')+`</div>
      <div class="muted mono" style="font-size:.7rem;margin-top:3px">${q.status==='processing'?PIPELINE_STAGES[q.stageIdx]:q.status==='error'?'⚠ '+PIPELINE_STAGES[q.stageIdx]:q.status==='done'?'готово':'ожидает'} <span style="opacity:.6">${icon('chevron-right')}</span></div>`;
  function stageDetail(q){
    const rng = rngFor(q.seqId+'_stg');
    const dm = q.created.match(/(\d+)\s+(\S+?)\.?\s+(\d+):(\d+)/);
    let day=dm?dm[1]:'09', mon=dm?dm[2]:'июл', hh=dm?+dm[3]:15, mm=dm?+dm[4]:0, ss=between(rng,0,59);
    return PIPELINE_STAGES.map((name,i)=>{
      const st = stStatus(q,i);
      let timeStr='', durStr='';
      if(st==='done'){
        timeStr = `${day} ${mon}. ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        const dMin=between(rng,0,26), dSec=between(rng,1,59);
        durStr = dMin? `${dMin} мин` : `${dSec} сек`;
        mm+=dMin; ss=(ss+dSec)%60; while(mm>=60){mm-=60;hh++;}
      } else if(st==='active'){ timeStr='выполняется…'; }
      else if(st==='error'){ timeStr='ошибка'; }
      else { timeStr='ожидает'; }
      const mark = st==='done'?icon('check'):st==='error'?icon('x'):st==='active'?'':(i+1);
      return `<div class="stage-row" style="padding:3px 0"><div class="stage-ic ${st}" style="width:19px;height:19px;font-size:.6rem">${mark}</div>
        <div class="stage-name" style="font-size:.8rem">${name}</div><div class="stage-time">${timeStr}${durStr?' · '+durStr:''}</div></div>`;
    }).join('');
  }
  const logs = `<div class="wrap-gap">
    <a class="chip" onclick="toast('Скачивание status.log')" style="cursor:pointer">status.log</a>
    <a class="chip" onclick="toast('Скачивание err.log')" style="cursor:pointer">err.log</a></div>`;
  function drawQ(){
    const rows = view.querySelector('#qrows');
    // запоминаем раскрытые стадии перед перерисовкой
    rows.querySelectorAll('details[data-qid]').forEach(d=>{ if(d.open) openStages.add(d.dataset.qid); else openStages.delete(d.dataset.qid); });
    const list = Q.filter(q=> filter==='all'||q.status===filter);
    rows.innerHTML = list.length? list.map(q=>`
      <tr class="${q.status==='done'?'clickable':''}" ${q.status==='done'?`onclick="location.hash='#/sample/${q.id}'"`:''}>
        <td class="mono muted">${q.id}</td><td class="mono" style="font-size:.78rem">${q.created}</td>
        <td class="id">${q.seqId}</td>
        <td><details class="dd dd--stages" data-qid="${q.id}" ${openStages.has(String(q.id))?'open':''} onclick="event.stopPropagation()"><summary>${pips(q)}</summary>
          <div class="stage-list" style="margin-top:6px">${stageDetail(q)}</div></details></td>
        <td>${statusBadge(q.status)}</td><td>${logs}</td></tr>`).join('')
      : `<tr><td colspan="6" class="tbl__empty">Нет образцов в этом статусе</td></tr>`;
  }
  function chip(){ const a=Q.filter(q=>q.status==='processing').length; view.querySelector('#liveChip').innerHTML=`<span class="live-dot"></span> ${a} в работе · обновлено ${lastUpdate}с назад`; }
  function tick(force){
    const auto = view.querySelector('#autoToggle').checked;
    if(!auto && !force){ lastUpdate+=2; chip(); return; }
    lastUpdate=0;
    Q.forEach(q=>{ if(q.status==='processing' && Math.random()>0.4){ q.stageIdx++;
      if(q.stageIdx>=PIPELINE_STAGES.length){ q.status='done'; q.stageIdx=PIPELINE_STAGES.length;
        const nx=Q.find(x=>x.status==='queued'); if(nx){ nx.status='processing'; nx.stageIdx=1; } } } });
    drawQ(); chip();
  }
  view.querySelectorAll('#qfilter button').forEach(b=> b.addEventListener('click', ()=>{
    view.querySelectorAll('#qfilter button').forEach(x=>x.classList.remove('is-active')); b.classList.add('is-active'); filter=b.dataset.f; drawQ();
  }));
  drawNew(); drawArch(); drawQ(); chip();
  liveTimer = setInterval(()=>{ lastUpdate+=2; if(view.querySelector('#autoToggle') && view.querySelector('#autoToggle').checked) tick(); else chip(); }, 2000);
}

/* ================= Результаты (Образцы + Контроль качества) ================= */
function renderResults(param, view, sub){
  let tab = sub==='qc' ? 'qc' : 'reg';
  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Реестр</div><h1>Пациенты</h1>
      <p class="muted">Реестр пациентов и контроль качества.</p></div></div>
    <div class="subtabs" id="rtabs">
      <button data-t="reg">${icon('microscope')} Реестр</button>
      <button data-t="qc">${icon('shield-check')} Контроль качества</button>
    </div>
    <div id="rcontent"></div>`;
  const content = view.querySelector('#rcontent');
  function setTab(t){
    tab=t; view.querySelectorAll('#rtabs button').forEach(b=> b.classList.toggle('is-active', b.dataset.t===t));
    if (t==='qc') drawQCTable(content); else drawPatientsTable(content);
  }
  view.querySelectorAll('#rtabs button').forEach(b=> b.addEventListener('click', ()=> setTab(b.dataset.t)));
  setTab(tab);
}

function drawPatientsTable(container){
  container.innerHTML = `
    <div class="toolbar">
      <label class="topbar__search" id="searchLabel" style="min-width:280px"><input class="input" style="border:0;padding:0;width:100%" placeholder="ФИО, SeqID, код, ERP…" id="q"></label>
      <select class="select" id="fStatus"><option value="">Все статусы</option><option value="done">Завершён</option><option value="processing">В обработке</option><option value="queued">В очереди</option><option value="error">Ошибка</option></select>
      <select class="select" id="fRisk"><option value="">Любой риск</option><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select>
      <div class="toolbar__spacer"></div><span class="badge badge--muted" id="count"></span>
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>ID</th><th>ФИО пациента</th><th>Контрагент</th><th>ERP заказ</th><th>SeqID</th><th>Статус</th><th>QC</th><th>Скор (ML)</th><th>Заключение</th><th>Дата</th>
    </tr></thead><tbody id="srows"></tbody></table></div></div>`;
  container.querySelector('#searchLabel').insertAdjacentHTML('afterbegin', icon('search'));
  const qInput = container.querySelector('#q'); qInput.value = samplesSearch || '';
  const resultCell = s=>{ if(!s.score) return '<span class="muted">—</span>';
    return `<b style="color:${riskColor(s.score.risk)}">${pct(s.score.cancerProb)}</b> ${riskBadge(s.score.risk)}`; };
  const conclCell = s=> s.status==='done'
    ? `<a class="chip" href="#/report/${s.id}" onclick="event.stopPropagation()">${icon('file-text')} открыть</a>`
    : '<span class="muted">—</span>';
  function apply(){
    const q=qInput.value.trim().toLowerCase(); samplesSearch=qInput.value.trim();
    const st=container.querySelector('#fStatus').value, risk=container.querySelector('#fRisk').value;
    const list = SAMPLES.filter(s=>{
      if(q && !(s.seqId.toLowerCase().includes(q)||s.patientCode.toLowerCase().includes(q)||String(s.patientNo).toLowerCase().includes(q)||s.fio.toLowerCase().includes(q))) return false;
      if(st && s.status!==st) return false;
      if(risk && (!s.score||s.score.risk!==risk)) return false; return true;
    }).sort((a,b)=>b.id-a.id);
    container.querySelector('#count').textContent=`Показано: ${list.length} из ${SAMPLES.length}`;
    container.querySelector('#srows').innerHTML = list.length? list.map(s=>`
      <tr class="clickable" onclick="location.hash='#/sample/${s.id}'">
        <td class="mono muted">${s.id}</td>
        <td style="font-size:.86rem">${s.fio}<div class="muted" style="font-size:.72rem">${s.sex}, ${s.age} л.</div></td>
        <td style="font-size:.8rem">${s.contractor}</td>
        <td class="mono muted">${s.patientNo}</td>
        <td class="id">${s.seqId}</td>
        <td>${statusBadge(s.status)}</td><td>${s.status==='done'?qcBadge(s.qc.verdict):'<span class="muted">—</span>'}</td>
        <td class="nowrap">${resultCell(s)}</td>
        <td>${conclCell(s)}</td><td class="mono muted">${s.date}</td></tr>`).join('')
      : `<tr><td colspan="10" class="tbl__empty">Ничего не найдено</td></tr>`;
  }
  qInput.addEventListener('input', apply);
  ['fStatus','fRisk'].forEach(id=> container.querySelector('#'+id).addEventListener('change', apply));
  apply();
}

function drawQCTable(container){
  const done = SAMPLES.filter(s=>s.status==='done');
  const passN = done.filter(s=>s.qc.verdict==='Pass').length, failN=done.length-passN;
  container.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:16px">
      ${tile('Завершено', done.length, 'shield-check', 'с рассчитанным QC')}
      ${tile('Pass', passN, 'circle-check', Math.round(passN/done.length*100)+'% потока')}
      ${tile('Fail', failN, 'alert-triangle', 'требуют внимания')}
      ${tile('Ср. конверсия', (done.reduce((a,s)=>a+s.qc.metrics[0].value,0)/done.length).toFixed(2)+'%', 'flask', 'бисульфитная конверсия')}
    </div>
    <div class="toolbar"><div class="segmented" id="qcfilter"><button data-f="all" class="is-active">Все</button><button data-f="Pass">Pass</button><button data-f="Fail">Fail</button></div>
      <div class="toolbar__spacer"></div><label class="topbar__search" id="qcSearch" style="min-width:220px"><input class="input" style="border:0;padding:0;width:100%" placeholder="SeqID…" id="qcq"></label></div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>SeqID</th><th>Результат</th><th>failed metrics</th><th class="num">Конверсия</th><th class="num">Глубина покрытия</th><th class="num">Равномерность</th>
      <th class="num">CpG ≥5×</th><th class="num">Дупликейты</th><th class="num">Вставка</th><th class="num">Картир.</th><th class="num">Опух. фр.</th>
    </tr></thead><tbody id="qcrows"></tbody></table></div></div>`;
  container.querySelector('#qcSearch').insertAdjacentHTML('afterbegin', icon('search'));
  let filter='all';
  const mv=(s,k)=>s.qc.metrics.find(x=>x.key===k);
  const cell=m=>{ if(!m) return '<td class="num muted">—</td>'; const col=m.threshold==='справочно'?'var(--ink-2)':m.pass?'var(--ink)':'var(--fail)'; return `<td class="num" style="color:${col};font-weight:${m.pass?400:700}">${m.value}</td>`; };
  function draw(){
    const q=container.querySelector('#qcq').value.trim().toLowerCase();
    const list = done.filter(s=>(filter==='all'||s.qc.verdict===filter)&&(!q||s.seqId.toLowerCase().includes(q)));
    container.querySelector('#qcrows').innerHTML = list.length? list.map(s=>`
      <tr class="clickable" onclick="location.hash='#/sample/${s.id}'"><td class="id">${s.seqId}</td><td>${qcBadge(s.qc.verdict)}</td>
        <td style="font-size:.78rem;color:var(--fail)">${s.qc.failed.length?s.qc.failed.map(f=>f.split(' ').slice(0,2).join(' ')).join(', '):'<span class="muted">—</span>'}</td>
        ${cell(mv(s,'conversion'))}${cell(mv(s,'meanDepth'))}${cell(mv(s,'uniformity'))}${cell(mv(s,'cpgCov'))}${cell(mv(s,'dup'))}${cell(mv(s,'insert'))}${cell(mv(s,'mapped'))}${cell(mv(s,'tumorFrac'))}</tr>`).join('')
      : `<tr><td colspan="11" class="tbl__empty">Ничего не найдено</td></tr>`;
  }
  container.querySelectorAll('#qcfilter button').forEach(b=> b.addEventListener('click', ()=>{ container.querySelectorAll('#qcfilter button').forEach(x=>x.classList.remove('is-active')); b.classList.add('is-active'); filter=b.dataset.f; draw(); }));
  container.querySelector('#qcq').addEventListener('input', draw);
  draw();
}

/* ================= Заключения ================= */
function renderConclusions(param, view){
  const done = SAMPLES.filter(s=>s.status==='done' && s.score);
  const posEx = done.find(s=>s.score.cancerProb>0.5 && s.qc.verdict==='Pass') || done.find(s=>s.score.cancerProb>0.5);
  const negEx = done.find(s=>s.score.cancerProb<=0.5);
  const exCard = (s, positive)=>`
    <a class="card clickable" href="#/report/${s.id}" style="text-decoration:none;color:inherit;display:block">
      <div class="card__body" style="display:flex;align-items:center;gap:14px">
        <div style="width:46px;height:46px;border-radius:50%;flex:none;display:grid;place-items:center;background:${positive?'var(--fail-bg)':'var(--pass-bg)'};color:${positive?'var(--fail)':'var(--pass)'}">${positive?icon('alert-triangle'):icon('circle-check')}</div>
        <div><div style="font-family:var(--disp);font-weight:800;font-size:1rem">${positive?'Онкологический сигнал обнаружен':'Онкологический сигнал не обнаружен'}</div>
          <div class="muted" style="font-size:.82rem">Пример заключения · ${s.seqId}</div></div>
        <div class="spacer"></div>${icon('chevron-right')}
      </div></a>`;

  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Заключения</div><h1>Заключения</h1>
      <p class="muted">Лабораторные заключения по образцам.</p></div></div>
    <div class="grid grid-2" style="margin-bottom:18px">${posEx?exCard(posEx,true):''}${negEx?exCard(negEx,false):''}</div>
    <div class="card"><div class="card__head"><div class="section-title">${icon('file-text')} Все заключения</div>
      <span class="badge badge--muted">${done.length}</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>SeqID</th><th>Пациент</th><th>Результат</th><th>Риск</th><th>Дата</th><th></th>
      </tr></thead><tbody>${done.sort((a,b)=>b.id-a.id).map(s=>{
        const det = s.score.cancerProb>0.5;
        return `<tr class="clickable" onclick="location.hash='#/report/${s.id}'">
          <td class="id">${s.seqId}</td><td style="font-size:.82rem">${s.fio}</td>
          <td><span class="badge badge--${det?'fail':'pass'}">${det?icon('alert-triangle')+'обнаружен':icon('check')+'не обнаружен'}</span></td>
          <td>${riskBadge(s.score.risk)}</td><td class="mono muted">${s.date}</td>
          <td class="text-right"><a class="btn btn--sm btn--ghost" href="#/report/${s.id}" onclick="event.stopPropagation()">Открыть ${icon('chevron-right')}</a></td></tr>`;
      }).join('')}</tbody></table></div></div>`;
}

/* ================= Карточка образца ================= */
function renderSampleDetail(param, view){
  const s = sampleById(param) || SAMPLES[0];
  const d = new Date(s.date+'T00:00:00');
  const fmtD = dt=>`${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
  const collect = new Date(d); collect.setDate(d.getDate()-3);
  const dob = `[дд.мм.]${2026 - s.age}`;

  const header = `
    <a class="btn btn--sm btn--ghost" href="#/results" style="margin-bottom:14px">${icon('arrow-left')} К результатам</a>
    <div class="card" style="margin-bottom:16px">
      <div class="card__body">
        <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start">
          <div><div class="eyebrow">Образец</div>
            <div style="font-family:var(--disp);font-weight:800;font-size:1.4rem;letter-spacing:-.02em">${s.seqId}</div>
            <div class="wrap-gap" style="margin-top:10px">${statusBadge(s.status)}${s.status==='done'?qcBadge(s.qc.verdict):''}${s.score?riskBadge(s.score.risk):''}</div></div>
          <div class="vstack" style="min-width:210px">
            <button class="btn" onclick="toast('Скачивание profile.tsv (~1.5 ГБ)')">${icon('table')} Профиль метилирования (TSV)</button>
            <button class="btn" onclick="toast('Скачивание qc.json')">${icon('file-json')} Контроль качества (JSON)</button>
            <a class="btn btn--primary" href="#/report/${s.id}">${icon('file-text')} Предпросмотр заключения</a></div>
        </div>
        <hr class="divider">
        <div class="grid grid-3" style="gap:18px">
          <dl class="kv"><dt>ФИО пациента</dt><dd style="font-family:var(--body)">${s.fio}</dd>
            <dt>ERP ID пациента</dt><dd>${s.patientNo}</dd>
            <dt>Дата рождения</dt><dd>${dob}</dd><dt>Пол</dt><dd>${s.sex==='Ж'?'Женский':'Мужской'}</dd></dl>
          <dl class="kv"><dt>Номер договора</dt><dd>Д-${s.id}/26</dd>
            <dt>Контрагент</dt><dd style="font-family:var(--body)">${s.contractor}</dd>
            <dt>Направительный диагноз</dt><dd style="font-family:var(--body)">—</dd>
            <dt>Дата забора</dt><dd>${fmtD(collect)}</dd></dl>
          <dl class="kv"><dt>Вид исследования</dt><dd style="font-family:var(--body)">${STUDY_TYPE}</dd>
            <dt>Вид биоматериала</dt><dd style="font-family:var(--body)">${BIOMATERIAL}</dd>
            <dt>Референсный геном</dt><dd>GRCh38 (${s.ref})</dd>
            <dt>Дата готовности</dt><dd>${fmtD(d)}</dd></dl>
        </div>
      </div>
    </div>`;

  if (s.status!=='done'){
    const stageIdx = s.status==='processing'?4 : s.status==='error'?3 : 0;
    view.innerHTML = header + `
      <div class="card"><div class="card__body">
        <div class="section-title" style="margin-bottom:14px">${icon('clock')} Обработка образца</div>
        <div class="stage-list">${PIPELINE_STAGES.map((name,i)=>{
          let st=i<stageIdx?'done':(i===stageIdx&&s.status==='processing')?'active':(i===stageIdx&&s.status==='error')?'error':'wait';
          const mark = st==='done'?icon('check'):st==='error'?icon('x'):st==='active'?'':(i+1);
          return `<div class="stage-row"><div class="stage-ic ${st}">${mark}</div><div class="stage-name">${name}</div>
            <div class="stage-time">${st==='done'?'готово':st==='active'?'выполняется…':st==='error'?'ошибка':'ожидает'}</div></div>`; }).join('')}</div>
        ${s.status==='error'?`<div class="report-block" style="border-color:var(--fail);background:var(--fail-bg);margin-top:16px">
          <b style="color:var(--fail)">Обработка остановлена на этапе «${PIPELINE_STAGES[stageIdx]}».</b>
          <div class="muted" style="margin-top:4px;font-size:.84rem">Требуется проверка логов. Частая причина — качество пробоподготовки.</div></div>`:''}
        <div class="wrap-gap" style="margin-top:16px"><a class="chip" onclick="toast('status.log')" style="cursor:pointer">status.log</a>
          <a class="chip" onclick="toast('err.log')" style="cursor:pointer">err.log</a></div>
      </div></div>`;
    return;
  }

  const sc = s.score;
  const summary = sc.cancerProb>0.5
    ? `Расчётная вероятность онкопроцесса — <b>${pct(sc.cancerProb)}</b>. Наиболее вероятная локализация — <b>${cancerLabel(sc.topType)}</b> (${pct(sc.localization[sc.topType],1)}).`
    : `Расчётная вероятность онкопроцесса — <b>${pct(sc.cancerProb)}</b>; признаков онкопроцесса не выявлено.`;
  const g = s.qc.metrics.find.bind(s.qc.metrics);

  view.innerHTML = header + `
    <div class="grid" style="grid-template-columns:1.15fr 1fr;align-items:start;margin-bottom:16px">
      <div class="card"><div class="card__head"><div class="section-title">${icon('activity')} Скор ML-модели</div></div>
        <div class="card__body"><div class="gauge-wrap">${gaugeHtml(sc.cancerProb, sc.risk)}
          <div><div style="margin-bottom:8px">${riskBadge(sc.risk)}</div><div class="muted" style="font-size:.88rem;line-height:1.5">${summary}</div></div></div>
          <hr class="divider"><div class="section-title" style="font-size:.86rem;margin-bottom:12px">${icon('dna')} Локализация</div>
          ${localizationBars(sc.localization, sc.cancerProb>0.5?sc.topType:null)}</div></div>
      <div class="card"><div class="card__head"><div class="section-title">${icon('shield-check')} Контроль качества</div>${qcBadge(s.qc.verdict)}</div>
        <div class="card__body">
          <div class="muted" style="font-size:.84rem">${s.qc.verdict==='Pass'?'Все метрики в пределах установленных порогов.':'Часть метрик вне порогов — см. ниже.'}</div>
          ${s.qc.failed.length?`<div class="report-block" style="border-color:var(--warn);background:var(--warn-bg);margin:10px 0 0;padding:12px 14px">
            <b style="color:var(--warn)">Не прошли пороги:</b> <span style="font-size:.84rem">${s.qc.failed.join(', ')}</span></div>`:''}
          <details class="dd" style="margin-top:12px"><summary>${icon('chevron-right')} Метрики качества для биоинформатика</summary>
            <div id="qcList" style="margin-top:6px"></div>
            <div class="section-title" style="font-size:.82rem;margin:14px 0 4px">${icon('activity')} Дополнительные скоры</div>
            <div id="qcAdv"></div>
          </details>
        </div></div>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card__head"><div class="section-title">${icon('table')} Профиль метилирования</div>
      <button class="btn btn--sm" onclick="toast('Скачивание profile.tsv (~1.5 ГБ)')">${icon('download')} TSV</button></div>
      <div class="card__body"><p class="muted" style="margin-top:0;font-size:.83rem">Тепловая карта уровней метилирования по маркерным регионам: строка «Образец» в сравнении с референсными нормой и опухолью.</p>
        <div id="heatmap"></div></div></div>
    <div class="grid" style="grid-template-columns:1fr 1.1fr;align-items:start">
      <div class="card"><div class="card__head"><div class="section-title">${icon('microscope')} Покрытие</div></div><div class="card__body">
        <div class="grid grid-2" style="gap:12px">
          ${covTile('Глубина покрытия', g(m=>m.key==='meanDepth').value+'×')}
          ${covTile('Равномерность', g(m=>m.key==='uniformity').value+'%')}
          ${covTile('CpG ≥ 5×', g(m=>m.key==='cpgCov').value+'%')}
          ${covTile('Опух. фракция', g(m=>m.key==='tumorFrac').value+'%')}</div>
        <hr class="divider"><div class="muted" style="font-size:.8rem"><span class="mono">${s.heatmap.N}</span> регионов · профиль ~1.5 ГБ (TSV) · контексты CpG / CHG / CHH</div></div></div>
      <div class="card"><div class="card__head"><div class="section-title">${icon('users')} Обратная связь</div></div>
        <div class="card__body"><p class="muted" style="margin-top:0;font-size:.83rem">Подтверждённый клинический исход используется для дообучения модели.</p>
          <div id="fb"></div></div></div>
    </div>`;

  view.querySelector('#qcList').innerHTML = s.qc.metrics.map(m=>`
    <div class="metric"><div class="metric__name">${m.name}<small>порог: ${m.threshold}</small></div>
      <div class="metric__val" style="color:${m.threshold==='справочно'?'var(--ink-2)':m.pass?'var(--pass)':'var(--fail)'}">${m.value}${m.unit==='%'?'%':' '+m.unit}</div>
      <div>${m.threshold==='справочно'?'<span class="badge badge--muted">инфо</span>':m.pass?`<span class="badge badge--pass">${icon('check')}</span>`:`<span class="badge badge--fail">${icon('x')}</span>`}</div></div>`).join('');
  const rAdv = rngFor(s.seqId+'_adv');
  const advanced = [
    ['Всего ридов', between(rAdv,180,520)+' M'],
    ['Q30', between(rAdv,88,97,1)+' %'],
    ['GC-состав', between(rAdv,38,44,1)+' %'],
    ['Библиотечная сложность', between(rAdv,72,96,1)+' %'],
    ['Доля off-target', between(rAdv,3,18,1)+' %'],
    ['Неконверсия в CHH-контексте', between(rAdv,0.2,1.2,2)+' %'],
    ['Оценка контаминации', between(rAdv,0.1,1.5,2)+' %'],
    ['Средняя длина рида', between(rAdv,142,151)+' bp'],
    ['Доля картированных пар', between(rAdv,94,99.5,1)+' %'],
    ['Медианная MAPQ', between(rAdv,52,60)],
  ];
  view.querySelector('#qcAdv').innerHTML = advanced.map(([n,v])=>`
    <div class="metric" style="grid-template-columns:1fr auto"><div class="metric__name" style="font-size:.82rem">${n}</div>
      <div class="metric__val">${v}</div></div>`).join('');
  view.querySelector('#heatmap').innerHTML = heatmapHtml(s.heatmap);
  renderFeedbackBlock(s, view);
}
function covTile(label,val){ return `<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:11px 13px">
  <div class="muted" style="font-size:.74rem">${label}</div><div style="font-family:var(--disp);font-weight:800;font-size:1.25rem;margin-top:3px">${val}</div></div>`; }

function renderFeedbackBlock(s, view){
  const host = view.querySelector('#fb');
  const fb = getFeedback(s);
  host.innerHTML = `<div class="feedback">
    <div><div style="font-weight:600;font-size:.86rem;margin-bottom:8px">Диагноз подтверждён по результатам дообследования?</div>
      <div class="radio-cards">
        <label class="radio-card ${fb.confirmed==='yes'?'is-sel-yes':''}" id="rcYes"><input type="radio" name="fb" value="yes" ${fb.confirmed==='yes'?'checked':''} style="accent-color:var(--pass)"><span style="color:var(--pass)">${icon('circle-check')}</span> Да, подтверждён</label>
        <label class="radio-card ${fb.confirmed==='no'?'is-sel-no':''}" id="rcNo"><input type="radio" name="fb" value="no" ${fb.confirmed==='no'?'checked':''} style="accent-color:var(--fail)"><span style="color:var(--fail)">${icon('circle-x')}</span> Нет, не подтверждён</label></div></div>
    <div id="locWrap" style="${fb.confirmed==='yes'?'':'display:none'}"><div style="font-weight:600;font-size:.86rem;margin-bottom:6px">Подтверждённая локализация</div>
      <select class="select" id="locSel" style="width:100%"><option value="">— не указана —</option>${CANCER_TYPES.map(t=>`<option value="${t.key}" ${fb.locConfirmed===t.key?'selected':''}>${t.label}</option>`).join('')}</select></div>
    <div><div style="font-weight:600;font-size:.86rem;margin-bottom:6px">Комментарий</div><textarea class="textarea" id="fbNote" placeholder="Метод подтверждения, стадия, примечания…">${escapeHtml(fb.note||'')}</textarea></div>
    <div class="hstack"><button class="btn btn--primary" id="fbSave">${icon('check')} Сохранить исход</button>${fb.date?`<span class="muted" style="font-size:.8rem">Обновлено ${fb.date}</span>`:''}</div></div>`;
  host.querySelectorAll('input[name="fb"]').forEach(r=> r.addEventListener('change', ()=>{
    host.querySelector('#rcYes').classList.toggle('is-sel-yes', r.value==='yes'&&r.checked);
    host.querySelector('#rcNo').classList.toggle('is-sel-no', r.value==='no'&&r.checked);
    host.querySelector('#locWrap').style.display=(host.querySelector('input[name="fb"]:checked')||{}).value==='yes'?'':'none';
  }));
  host.querySelector('#fbSave').addEventListener('click', ()=>{
    const val=(host.querySelector('input[name="fb"]:checked')||{}).value||null;
    if(!val){ toast('Выберите вариант исхода'); return; }
    saveFeedback(s.id, { confirmed:val, locConfirmed:host.querySelector('#locSel').value, note:host.querySelector('#fbNote').value, date:'2026-07-09' });
    toast('Исход сохранён'); renderFeedbackBlock(s, view);
  });
}

/* ================= Пользователи ================= */
function renderUsers(param, view){
  const users = [
    { name:'Варвара Юхина',      login:'vyukhina',  role:'Администратор',            cls:'info',  perms:'полный доступ ко всем разделам',   last:'сегодня, 09:41', active:true },
    { name:'А. Петрова',      login:'vsmirnova', role:'Биоинформатик',            cls:'muted', perms:'обработка, пайплайн, контроль качества', last:'сегодня, 08:12', active:true },
    { name:'Даниил Орлов',       login:'dorlov',    role:'Биоинформатик',            cls:'muted', perms:'обработка, пайплайн',              last:'вчера, 19:03',   active:true },
    { name:'Зав. лабораторией',  login:'headlab',   role:'Заведующий лабораторией',  cls:'med',   perms:'подпись и выдача заключений',      last:'вчера, 17:30',   active:true },
    { name:'Ольга Лаборант',     login:'olab',      role:'Лаборант',                 cls:'muted', perms:'загрузка и запуск образцов',       last:'вчера, 10:05',   active:true },
    { name:'Наблюдатель',        login:'viewer',    role:'Наблюдатель',              cls:'muted', perms:'только просмотр',                  last:'—',              active:false },
  ];
  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Служебное</div><h1>Пользователи</h1>
      <p class="muted">Доступ к платформе и роли.</p></div>
      <button class="btn btn--primary" onclick="toast('Добавление пользователя')">${icon('users')} Добавить пользователя</button></div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Пользователь</th><th>Роль</th><th>Права</th><th>Последний вход</th><th>Статус</th>
    </tr></thead><tbody>${users.map(u=>`
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="width:30px;height:30px;font-size:.72rem">${u.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
          <div><div style="font-weight:600">${u.name}</div><div class="muted mono" style="font-size:.72rem">${u.login}</div></div></div></td>
        <td><span class="badge badge--${u.cls}">${u.role}</span></td>
        <td style="font-size:.84rem">${u.perms}</td>
        <td class="mono muted" style="font-size:.8rem">${u.last}</td>
        <td>${u.active?'<span class="badge badge--pass"><span class="dot"></span>активен</span>':'<span class="badge badge--muted"><span class="dot"></span>отключён</span>'}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

/* ================= Заключение ================= */
function renderReport(param, view, sub){
  const s = sampleById(param) || SAMPLES.find(x=>x.status==='done');
  const variant = sub==='full' ? 'full' : 'compact';
  view.innerHTML = `
    <div class="rp-toolbar hstack">
      <a class="btn btn--sm btn--ghost" href="#/sample/${s.id}">${icon('arrow-left')} К образцу</a>
      <div class="spacer"></div>
      <button class="btn btn--sm" onclick="toast('Заключение отправлено на e-mail лаборатории')">${icon('file-text')} На e-mail</button>
      <button class="btn btn--primary btn--sm" onclick="window.print()">${icon('printer')} Печать / Сохранить PDF</button>
    </div>` + buildReportDoc(s, variant);
}

/* ================= Роутер ================= */
const ROUTES = {
  dashboard:   { title:'Обзор',            nav:'dashboard',   render:renderDashboard },
  processing:  { title:'Обработка',        nav:'processing',  render:renderProcessing },
  results:     { title:'Пациенты',         nav:'results',     render:renderResults },
  conclusions: { title:'Заключения',       nav:'conclusions', render:renderConclusions },
  sample:      { title:'Карточка образца', nav:'results',     render:renderSampleDetail },
  report:      { title:'Заключение',       nav:'conclusions', render:renderReport },
  users:       { title:'Пользователи',     nav:'users',       render:renderUsers },
};
function router(){
  stopTimers();
  const h = location.hash.replace(/^#\/?/,'');
  const parts = h.split('/');
  let route = parts[0], param = parts[1], sub = parts[2];
  if (!route || !ROUTES[route]) route='dashboard';
  const def = ROUTES[route];
  renderShellSPA(def.nav, def.title);
  const viewEl = document.getElementById('view');
  viewEl.innerHTML='';
  def.render(param, viewEl, sub);
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', router);
router();
