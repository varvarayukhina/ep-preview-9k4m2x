/* ============================================================
   EpiPrint — мок-данные прототипа (детерминированные).
   Ничего из этого не является реальными медицинскими данными.
   ============================================================ */

// --- детерминированный PRNG (mulberry32) ---
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function rngFor(s){ return mulberry32(hashStr(s)); }
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
function between(rng, a, b, dp=0){ const v=a+rng()*(b-a); return dp?+v.toFixed(dp):Math.round(v); }

// --- справочники ---
const CANCER_TYPES = [
  { key:'breast',     label:'Молочная железа' },
  { key:'colorectal', label:'Колоректальный' },
  { key:'prostate',   label:'Предстательная железа' },
  { key:'lung',       label:'Лёгкое' },
  { key:'liver',      label:'Печень' },
  { key:'stomach',    label:'Желудок' },
  { key:'pancreas',   label:'Поджелудочная железа' },
  { key:'esophagus',  label:'Пищевод' },
];
const KITS = [
  { key:'vazyme', label:'Vazyme',       method:'WGBS' },
  { key:'rasel',  label:'Rasel',        method:'WGBS' },
  { key:'brock',  label:'Burning Rock', method:'Таргетный (ELSA-seq)' },
];
const REF = 'hg38';

// стадии пайплайна — по реальному status.log (Nanodigm) + downstream
const PIPELINE_STAGES = [
  'fastp',
  'Выравнивание (bwa-meth)',
  'MarkDuplicates',
  'CollectMultipleMetrics',
  'CollectWgsMetrics',
  'Uniformity',
  'MethylDackel',
  'Cytosine QC',
  'Build JSON',
  'Классификатор',
  'Формирование заключения',
];

// панель маркерных регионов метилирования, сгруппированная по типу рака
// (реальные гены-маркеры cfDNA-метилирования, позиции — демо)
const _MK = {
  breast:     ['RASSF1A','GSTP1','CDH13','RARB','BRCA1','SFRP1'],
  colorectal: ['SEPT9','BCAT1','NDRG4','SFRP2','TFPI2','VIM','APC'],
  prostate:   ['GSTP1','APC','RASSF1A','PTGS2','RARB','TIG1'],
  lung:       ['SHOX2','RASSF1A','PTGER4','HOXA7','SCT','CDO1'],
  liver:      ['BMPR1A','HOXA10','SEPT9','RASSF1A','APC'],
  stomach:    ['RPRM','RNF180','CDH1','TFPI2','MLH1'],
  pancreas:   ['BNC1','ADAMTS1','SFRP2','NPTX2','CDKN2A'],
  esophagus:  ['SFRP1','TAC1','HPP1','CDH13','APC'],
};
const MARKER_PANEL = CANCER_TYPES.flatMap(ct => (_MK[ct.key]||[]).map((g,i)=>{
  const r = rngFor(ct.key+'_'+g+'_'+i);
  return { gene:g, cancer:ct.key, pos: between(r, 1000000, 199000000) };
}));

// --- генерация выборки образцов ---
const FEMALE_CODES = ['SII','LNV','TRI','TIS','BAS','ESR','KMA','ONA'];
const MALE_CODES   = ['RAM','GEL','ARV','ZVP','URM','PNI','SIV','DKO'];
const SURNAMES = ['Соколов','Кузнецов','Попов','Лебедев','Козлов','Новиков','Морозов','Волков','Соловьёв','Васильев','Зайцев','Павлов','Семёнов','Голубев','Виноградов','Богданов','Воробьёв','Фёдоров','Михайлов','Беляев','Тарасов','Комаров','Орлов','Киселёв','Макаров','Андреев','Ковалёв','Ильин','Гусев','Титов'];
const INITS = ['А','Б','В','Г','Д','Е','И','К','Л','М','Н','О','П','Р','С','Т','Ю','Я'];
function makeFio(seed, isFemale){ const r=rngFor(seed+'_fio'); let sur=pick(r,SURNAMES); if(isFemale) sur+='а'; return `${sur} ${pick(r,INITS)}. ${pick(r,INITS)}.`; }

// Блоки QC — как в реальном qc.json (Nanodigm): coverage, cpg, duplicates,
// insert_size, conversion_rate, strand_ratio; reads — отдельным (скрытым) блоком.
const QC_BLOCKS = [
  { key:'coverage',   label:'Покрытие' },
  { key:'cpg',        label:'CpG' },
  { key:'dup',        label:'Дупликаты' },
  { key:'insert',     label:'Размер вставки' },
  { key:'conversion', label:'Конверсия' },
  { key:'strand',     label:'Соотношение цепей' },
];
const QC_READS_LABEL = 'Дополнительные метрики (риды)';

// QC-метрики строго по формату реального qc.json (Nanodigm) — те же поля, те же
// единицы: где в файле доля (0..1) — храним долю; проценты pct_* — как в файле;
// reads.total_* — «сырые» счётчики. Пороги, которых нет в файле, помечены «справочно».
function qcMetricsFrom(v){
  const metrics = [
    // Пороги — из литературы (см. src). Где стандарта нет — «справочно» (не выдумываем).
    // блок «Покрытие» (coverage)
    { key:'meanDepth',  block:'coverage',   name:'Средняя глубина покрытия', short:'Средняя глубина', unit:'×', value:v.meanDepth, threshold:'≥ 10', pass: v.meanDepth>=10, src:'Ziller, Nat Methods 2014 — эффективный диапазон WGBS 5–15×, предпочт. 10–15×' },
    { key:'covMedian',  block:'coverage',   name:'Медианная глубина покрытия', short:'Медиана', unit:'×', value:v.covMedian, threshold:'≥ 5', pass: v.covMedian>=5, src:'Ziller, Nat Methods 2014 — нижняя граница 5×' },
    { key:'cov0x',      block:'coverage',   name:'Доля оснований 0× (без покрытия)', short:'0× (без покрытия)', unit:'%', value:v.cov0x, threshold:'справочно', pass:true }, // при ~15× порога в литературе нет (Ziller 2014)
    { key:'cov10',      block:'coverage',   name:'Доля оснований ≥ 10×', short:'≥ 10×', unit:'%', value:v.cov10, threshold:'справочно', pass:true }, // ENCODE ≥10× — уровень на сайт, не доля генома
    { key:'cov30x',     block:'coverage',   name:'Доля оснований ≥ 30×', short:'≥ 30×', unit:'%', value:v.cov30x, threshold:'справочно', pass:true },
    { key:'fold80',     block:'coverage',   name:'fold-80 (равномерность покрытия)', short:'fold-80', unit:'', value:v.fold80, threshold:'≤ 3', pass: v.fold80<=3, src:'Picard FOLD_80_BASE_PENALTY; клин. панели 1.77–3.57 = высокая равномерность' },
    { key:'uniformity', block:'coverage',   name:'Равномерность покрытия', short:'Равномерность', unit:'', value:v.uniformity, threshold:'справочно', pass:true }, // кастомная метрика; стандарт равномерности — fold-80
    // блок «CpG» (cpg)
    { key:'cpgMean',    block:'cpg',        name:'Среднее покрытие CpG', short:'Среднее покрытие', unit:'×', value:v.cpgMean, threshold:'≥ 5', pass: v.cpgMean>=5, src:'Ziller 2014 / ENCODE — нижняя граница на CpG для оценки метилирования' },
    { key:'cpg15x',     block:'cpg',        name:'Доля CpG ≥ 15×', short:'≥ 15×', unit:'%', value:v.cpg15x, threshold:'справочно', pass:true },
    { key:'cpg10x',     block:'cpg',        name:'Доля CpG ≥ 10×', short:'≥ 10×', unit:'%', value:v.cpg10x, threshold:'справочно', pass:true },
    { key:'cpgCov',     block:'cpg',        name:'Доля CpG ≥ 5×', short:'≥ 5×', unit:'%', value:v.cpgCov, threshold:'справочно', pass:true }, // стандарта на долю CpG на этой глубине нет
    { key:'cpg0x',      block:'cpg',        name:'Доля CpG 0× (без покрытия)', short:'0× (без покрытия)', unit:'%', value:v.cpg0x, threshold:'справочно', pass:true },
    { key:'cpgUnif',    block:'cpg',        name:'Равномерность CpG', short:'Равномерность', unit:'', value:v.cpgUnif, threshold:'справочно', pass:true },
    { key:'mbias',      block:'cpg',        name:'M-bias, разница', short:'M-bias', unit:'', value:v.mbias, threshold:'справочно', pass:true }, // оценивается качественно (плоский M-bias), числового порога в литературе нет
    // блок «Дупликаты» (duplicates)
    { key:'dup',        block:'dup',        name:'Уровень дупликатов', short:'Уровень дупликатов', unit:'%', value:v.dup, threshold:'≤ 20', pass: v.dup<=20, src:'Sci Rep 2019 — рабочий диапазон ~5–20%, <10% хорошо' },
    // блок «Размер вставки» (insert_size)
    { key:'insertMean', block:'insert',     name:'Размер вставки, среднее', short:'Среднее', unit:'bp', value:v.insertMean, threshold:'справочно', pass:true },
    { key:'insert',     block:'insert',     name:'Размер вставки, медиана', short:'Медиана', unit:'bp', value:v.insert, threshold:'100–200', pass: v.insert>=100&&v.insert<=200, src:'Snyder 2016 / Mouliere 2018 — мононуклеосомная cfDNA ~140–170 bp, ctDNA 90–150 bp' },
    { key:'insertMode', block:'insert',     name:'Размер вставки, мода', short:'Мода', unit:'bp', value:v.insertMode, threshold:'справочно', pass:true },
    // блок «Конверсия» (conversion_rate) — доля, как в файле
    { key:'conversion', block:'conversion', name:'Эффективность бисульфитной конверсии', short:'Эффективность', unit:'', value:v.conversion, threshold:'≥ 0.99', pass: v.conversion>=0.99, src:'GRAIL CCGA 2022 (cfDNA MCED ≥0.99); ENCODE ≥0.98' },
    // блок «Соотношение цепей» (strand_ratio)
    { key:'strand',     block:'strand',     name:'Соотношение цепей', short:'Соотношение', unit:'', value:v.strand, threshold:'справочно', pass:true }, // ~1:1 ожидаемо (Bismark), числового порога в литературе нет
    // блок «Риды» (reads) — по умолчанию скрыт: «Дополнительные метрики».
    // Как в qc.json: after_filtering (основное) + before_filtering.
    { key:'totalReads', block:'reads', name:'Всего ридов (после фильтрации)', short:'Ридов (после)', unit:'', value:v.totalReads, threshold:'справочно', pass:true },
    { key:'totalBases', block:'reads', name:'Всего оснований (после фильтрации)', short:'Оснований (после)', unit:'', value:v.totalBases, threshold:'справочно', pass:true },
    { key:'q20bases',   block:'reads', name:'Оснований Q20 (после фильтрации)', short:'Q20-осн. (после)', unit:'', value:v.q20bases, threshold:'справочно', pass:true },
    { key:'q30bases',   block:'reads', name:'Оснований Q30 (после фильтрации)', short:'Q30-осн. (после)', unit:'', value:v.q30bases, threshold:'справочно', pass:true },
    { key:'q20',        block:'reads', name:'Доля оснований Q20 (после фильтрации)', short:'Q20 (после)', unit:'', value:v.q20, threshold:'≥ 0.90', pass: v.q20>=0.90, src:'Illumina — Q20 = точность 99%' },
    { key:'q30',        block:'reads', name:'Доля оснований Q30 (после фильтрации)', short:'Q30 (после)', unit:'', value:v.q30, threshold:'≥ 0.80', pass: v.q30>=0.80, src:'Illumina / NGS QC — ≥80% оснований Q30 = успешный ран' },
    { key:'r1len',      block:'reads', name:'Средняя длина R1 (после фильтрации)', short:'Длина R1 (после)', unit:'bp', value:v.r1len, threshold:'справочно', pass:true },
    { key:'r2len',      block:'reads', name:'Средняя длина R2 (после фильтрации)', short:'Длина R2 (после)', unit:'bp', value:v.r2len, threshold:'справочно', pass:true },
    { key:'gc',         block:'reads', name:'GC-состав (после фильтрации)', short:'GC (после)', unit:'', value:v.gc, threshold:'справочно', pass:true },
    { key:'brReads',    block:'reads', name:'Всего ридов (до фильтрации)', short:'Ридов (до)', unit:'', value:v.brReads, threshold:'справочно', pass:true },
    { key:'brBases',    block:'reads', name:'Всего оснований (до фильтрации)', short:'Оснований (до)', unit:'', value:v.brBases, threshold:'справочно', pass:true },
    { key:'brQ20bases', block:'reads', name:'Оснований Q20 (до фильтрации)', short:'Q20-осн. (до)', unit:'', value:v.brQ20bases, threshold:'справочно', pass:true },
    { key:'brQ30bases', block:'reads', name:'Оснований Q30 (до фильтрации)', short:'Q30-осн. (до)', unit:'', value:v.brQ30bases, threshold:'справочно', pass:true },
    { key:'brQ20',      block:'reads', name:'Доля оснований Q20 (до фильтрации)', short:'Q20 (до)', unit:'', value:v.brQ20, threshold:'справочно', pass:true },
    { key:'brQ30',      block:'reads', name:'Доля оснований Q30 (до фильтрации)', short:'Q30 (до)', unit:'', value:v.brQ30, threshold:'справочно', pass:true },
    { key:'brR1',       block:'reads', name:'Средняя длина R1 (до фильтрации)', short:'Длина R1 (до)', unit:'bp', value:v.brR1, threshold:'справочно', pass:true },
    { key:'brR2',       block:'reads', name:'Средняя длина R2 (до фильтрации)', short:'Длина R2 (до)', unit:'bp', value:v.brR2, threshold:'справочно', pass:true },
    { key:'brGc',       block:'reads', name:'GC-состав (до фильтрации)', short:'GC (до)', unit:'', value:v.brGc, threshold:'справочно', pass:true },
  ];
  const failed = metrics.filter(m=>!m.pass && m.threshold!=='справочно').map(m=>m.name);
  return { metrics, failed, verdict: failed.length? 'Fail':'Pass' };
}

// демо-образец: значения генерируются в единицах и диапазонах реального qc.json
function makeQC(rng, kit){
  // reads: after_filtering и before_filtering (до фильтрации — ридов/оснований больше)
  const readsA = between(rng, 180000000, 740000000), basesA = between(rng, 90000000000, 115000000000);
  const q20a = between(rng, 0.96, 0.986, 4), q30a = between(rng, 0.925, 0.96, 4);
  const basesB = Math.round(basesA * between(rng, 1.10, 1.22, 4)), readsB = Math.round(readsA * between(rng, 1.004, 1.03, 4));
  const q20b = between(rng, 0.955, 0.977, 4), q30b = between(rng, 0.915, 0.95, 4);
  const v = {
    meanDepth: between(rng, 12, 22, 1), covMedian: between(rng, 12, 20),
    cov0x: between(rng, 2, 9, 2), cov10: between(rng, 70, 90, 1), cov30x: between(rng, 2, 12, 1),
    fold80: between(rng, 1.5, 2.2, 2), uniformity: between(rng, 0.96, 0.995, 4),
    cpgMean: between(rng, 5.2, 8, 2), cpg15x: between(rng, 1.5, 6, 2), cpg10x: between(rng, 10, 20, 1),
    cpgCov: between(rng, 46, 66, 1), cpg0x: between(rng, 8, 15, 1), cpgUnif: between(rng, 0.78, 0.9, 3),
    mbias: between(rng, -0.06, 0.06, 3), dup: between(rng, 4, 13, 1),
    insertMean: between(rng, 135, 150, 1), insert: between(rng, 138, 152), insertMode: between(rng, 140, 150),
    conversion: between(rng, 0.991, 0.9985, 4), strand: between(rng, 0.985, 1.02, 3),
    totalReads: readsA, totalBases: basesA, q20bases: Math.round(basesA*q20a), q30bases: Math.round(basesA*q30a),
    q20: q20a, q30: q30a, r1len: between(rng, 125, 150), r2len: between(rng, 120, 145), gc: between(rng, 0.19, 0.24, 4),
    brReads: readsB, brBases: basesB, brQ20bases: Math.round(basesB*q20b), brQ30bases: Math.round(basesB*q30b),
    brQ20: q20b, brQ30: q30b, brR1: 150, brR2: 150, brGc: between(rng, 0.20, 0.25, 4),
  };
  // ~20% образцов — одна метрика вне порога (реализм потока)
  if (rng() < 0.20){
    const w = Math.floor(rng()*5);
    if (w===0) v.conversion = between(rng, 0.983, 0.989, 4);      // < 0.99
    else if (w===1) v.meanDepth = between(rng, 6, 9.5, 1);        // < 10×
    else if (w===2) v.fold80 = between(rng, 3.1, 4.6, 2);         // > 3
    else if (w===3){ v.q30 = between(rng, 0.72, 0.79, 4); v.q30bases = Math.round(v.totalBases*v.q30); } // < 0.80
    else v.dup = between(rng, 21, 30, 1);                          // > 20
  }
  return qcMetricsFrom(v);
}

// реальный образец — ТОЧНЫЕ значения из RnDL_251101_05_NanoMetcfDNA.qc.json (без округления)
function makeRealQC(){
  return qcMetricsFrom({
    meanDepth: 15.723873, covMedian: 15, cov0x: 4.8664, cov10: 78.5456, cov30x: 4.741, fold80: 1.747097, uniformity: 0.99284,
    cpgMean: 5.35654, cpg15x: 2.20991, cpg10x: 13.6815, cpgCov: 52.2085, cpg0x: 10.9954, cpgUnif: 0.819006, mbias: -0.0403493,
    dup: 5.0629, insertMean: 140.066427, insert: 142, insertMode: 145, conversion: 0.995861, strand: 1.00067,
    // reads.after_filtering
    totalReads: 728100162, totalBases: 95289458748, q20bases: 92713176174, q30bases: 90040579590,
    q20: 0.972964, q30: 0.944916, r1len: 136, r2len: 125, gc: 0.203053,
    // reads.before_filtering
    brReads: 737587514, brBases: 110638127100, brQ20bases: 107083536687, brQ30bases: 103770859135,
    brQ20: 0.967872, brQ30: 0.93793, brR1: 150, brR2: 150, brGc: 0.209115,
  });
}

function makeScore(rng, forcedCancer){
  const isCancer = forcedCancer!==undefined ? forcedCancer : rng()>0.55;
  let cancerProb;
  if (isCancer) cancerProb = between(rng, 0.62, 0.94, 3);
  else          cancerProb = between(rng, 0.02, 0.34, 3);

  // локализация: один доминирующий тип + фон
  const weights = CANCER_TYPES.map(()=> rng());
  const domIdx = Math.floor(rng()*CANCER_TYPES.length);
  weights[domIdx] += isCancer ? 2.4 : 0.4;
  const sum = weights.reduce((a,b)=>a+b,0);
  const localization = {};
  CANCER_TYPES.forEach((t,i)=> localization[t.key] = +(weights[i]/sum).toFixed(3));

  let risk = 'low';
  if (cancerProb>=0.7) risk='high'; else if (cancerProb>=0.45) risk='medium';
  return { cancerProb, risk, localization, topType: CANCER_TYPES[domIdx].key };
}

// heatmap по панели маркеров (регион × [Образец, Норма, Опухоль]).
// Образец тяготеет к норме; при онкопроцессе регионы соответствующей
// локализации сильнее сдвигаются к «опухолевому» паттерну.
function makeHeatmap(seqId, isCancer, topType){
  const rng = rngFor(seqId+'_hm');
  const regions = MARKER_PANEL;
  const N = regions.length;
  const norm = [], tumor = [], sample = [], loci = [];
  regions.forEach((reg, i)=>{
    const n = +(rng()*0.32).toFixed(3);           // норма — низкое
    const t = +(0.55 + rng()*0.45).toFixed(3);    // опухоль — высокое
    let shift = rng()*0.10;
    if (isCancer) shift = (reg.cancer===topType) ? (0.40 + rng()*0.40) : (0.05 + rng()*0.22);
    const s = +Math.min(1, n*(1-shift) + t*shift).toFixed(3);
    norm.push(n); tumor.push(t); sample.push(s);
    loci.push({ gene:reg.gene, pos:reg.pos, cancer:reg.cancer, sample:s, norm:n, delta:+(s-n).toFixed(3) });
  });
  const topLoci = [...loci].sort((a,b)=> b.delta - a.delta).slice(0, 8);
  // «Норма» и «Опухоль» — усреднённые референсные профили (когорты из нескольких
  // образцов), а не единичные пробы. Δ метилирования считается относительно
  // усреднённой нормы. Способ агрегации по когорте — открытый вопрос (см. ревью).
  return { N, regions, topLoci, rows:[
    { label:'Образец', strong:true, values:sample },
    { label:'Норма (референс)', values:norm },
    { label:'Опухоль (референс)', values:tumor },
  ]};
}

// --- сборка образцов ---
function buildSamples(){
  const runs = ['R2026-018','R2026-019','R2026-020','R2026-021'];
  const statuses = [
    // распределение статусов по образцам
    'done','done','done','done','done','done','done','done','done','done','done','done',
    'done','done','processing','processing','processing','queued','queued','queued','error','done','done','done'
  ];
  const out = [];
  for (let i=0;i<statuses.length;i++){
    const status = statuses[i];
    const rng = rngFor('sample'+i);
    const isFemale = rng()>0.5;
    const codeSet = isFemale? FEMALE_CODES: MALE_CODES;
    const pcode = pick(rng, codeSet) + String(between(rng,10,31)).padStart(2,'0') + String(between(rng,1,12)).padStart(2,'0') + String(between(rng,40,99));
    const kit = KITS[i % 3];
    const run = runs[i % runs.length];
    const idx = 30 + i;
    const isReal = i===0; // первый образец — реальный (значения QC из qc.json)
    const seqId = isReal ? 'RnDL_251101_05_NanoMetcfDNA' : `EP_${run.slice(5)}_${String(idx).padStart(2,'0')}_${pcode}`;
    const patientNo = 'P-' + String(hashStr(seqId)%900000+100000);
    const day = 3 + Math.floor(i/6);
    const date = `2026-07-0${day}`;

    const done = status==='done';
    const qc = isReal ? makeRealQC() : makeQC(rngFor(seqId+'_qc'), kit);
    const sc = done ? makeScore(rngFor(seqId+'_sc')) : null;
    const isCancer = sc ? sc.cancerProb>0.5 : (rng()>0.5);

    // обратная связь — только для части завершённых
    let feedback = { confirmed:null, note:'', date:'', locConfirmed:'' };
    if (done && i%4===0 && sc){
      const agree = sc.cancerProb>0.5 ? rng()>0.25 : rng()>0.15;
      feedback = {
        confirmed: sc.cancerProb>0.5 ? (agree?'yes':'no') : (agree?'no':'yes'),
        note: '',
        date: `2026-07-0${day+1}`,
        locConfirmed: (sc.cancerProb>0.5 && agree) ? sc.topType : ''
      };
    }

    out.push({
      i, id: 5100+i, seqId, run, ref:REF, kit,
      patientCode: pcode, patientNo, fio: makeFio(seqId, isFemale), sex: isFemale?'Ж':'М', age: between(rng,38,74),
      contractor: pick(rng, ['ООО «Медикал Поинт»','АО «ЕМЦ»','КДЛ ДОМОДЕДОВО','Внутр. валидация','ООО «Юни Медика»']),
      date, status,
      qc, score: sc, isCancer,
      heatmap: makeHeatmap(seqId, isCancer, sc ? sc.topType : null),
      feedback,
    });
  }
  return out;
}

const SAMPLES = buildSamples();
const sampleById = id => SAMPLES.find(s=> String(s.id)===String(id));

// --- очередь (из образцов + тайминги/стадии) ---
function buildQueue(){
  return SAMPLES.filter(s=> s.status!=='queued' || true).map(s=>{
    const rng = rngFor(s.seqId+'_q');
    let stageIdx, stageStatuses;
    if (s.status==='done'){ stageIdx = PIPELINE_STAGES.length; }
    else if (s.status==='processing'){ stageIdx = between(rng,2,7); }
    else if (s.status==='error'){ stageIdx = between(rng,3,6); }
    else { stageIdx = 0; }

    const created = `07 июл. ${String(between(rng,9,17)).padStart(2,'0')}:${String(between(rng,10,59)).padStart(2,'0')}`;
    const startAt = s.status==='queued'? '—' : created.replace(/(\d+):(\d+)/,(m,h,mm)=>`${h}:${String((+mm+2)%60).padStart(2,'0')}`);
    const endAt   = s.status==='done'? created.replace(/(\d+):(\d+)/,(m,h,mm)=>`${(+h+1)}:${String((+mm+5)%60).padStart(2,'0')}`) : '—';

    const stages = PIPELINE_STAGES.map((name,idx)=>{
      let st='wait';
      if (s.status==='error' && idx===stageIdx) st='error';
      else if (idx<stageIdx) st='done';
      else if (idx===stageIdx && s.status==='processing') st='active';
      return { name, status: st, dur: idx<stageIdx? `${between(rngFor(s.seqId+idx),1,9)}м ${between(rngFor(s.seqId+idx+'s'),1,59)}с` : '' };
    });
    return { ...s, stageIdx, stages, created, startAt, endAt,
      progress: Math.round(stageIdx/PIPELINE_STAGES.length*100) };
  }).sort((a,b)=> b.id-a.id);
}
const QUEUE = buildQueue();

// --- хранилище (загрузки → образцы-папки) ---
function buildStorage(){
  const runs = ['R2026-021','R2026-020','R2026-019','R2026-018'];
  return runs.map((run, ri)=>{
    const rng = rngFor(run+'_st');
    const samplesInRun = SAMPLES.filter(s=> s.run===run);
    const files = samplesInRun.map(s=>({
      basename: s.seqId,
      sizeGb: between(rngFor(s.seqId+'_sz'), 3.2, 9.8, 1),
      kit: s.kit.label,
      ready: true,
      launched: s.status!=='queued',
      status: s.status,
      id: s.id,
    }));
    // пара «сырых, ещё не запущенных» папок в самой свежей загрузке
    if (ri===0){
      for (let k=0;k<2;k++){
        const sid = `EP_021_${90+k}_NEW${between(rng,100,999)}`;
        files.unshift({ basename:sid, sizeGb:between(rng,3.5,8.5,1), kit:'Vazyme', ready:true, launched:false, status:'new', id:'new'+k });
      }
    }
    return {
      run, ref:REF,
      created: `0${4-ri} июл. 2026, ${String(8+ri).padStart(2,'0')}:${String(between(rng,10,55)).padStart(2,'0')}`,
      files,
    };
  });
}
const STORAGE = buildStorage();

// --- мониторинг монтирований (Главная) ---
const MOUNTS = [
  { name:'storage-38 → srv-72',  path:'/mnt/storage38/epiprint',    status:'ok',   note:'чтение' },
  { name:'srv-72 → srv-60',      path:'/mnt/mirror60/epiprint',     status:'ok',   note:'зеркало' },
  { name:'srv-60 → web',         path:'/var/www/epiprint/storage',  status:'ok',   note:'веб' },
  { name:'cluster-BS → srv-72',  path:'/mnt/cluster/results',       status:'warn', note:'высокая нагрузка' },
  { name:'backup-41',            path:'/mnt/backup41/epiprint',     status:'ok',   note:'резерв' },
];

// --- агрегаты для дашборда ---
const STATS = (()=>{
  const done = SAMPLES.filter(s=>s.status==='done');
  const proc = SAMPLES.filter(s=>s.status==='processing');
  const q    = SAMPLES.filter(s=>s.status==='queued');
  const err  = SAMPLES.filter(s=>s.status==='error');
  const qcPass = done.filter(s=>s.qc.verdict==='Pass').length;
  const highRisk = done.filter(s=>s.score && s.score.risk==='high').length;
  const withFb = SAMPLES.filter(s=>s.feedback.confirmed).length;
  return {
    total: SAMPLES.length, done: done.length, processing: proc.length, queued: q.length, error: err.length,
    qcPassRate: done.length? Math.round(qcPass/done.length*100):0,
    highRisk, withFb,
    throughput7d: [3,5,4,6,2,5,4], // образцов/день за неделю
  };
})();

const CURRENT_USER = { initials:'ВЮ', name:'Варвара Юхина', role:'Биоинформатик / администратор' };
