/* ============================================================
   EpiPrint — построение заключения (общий модуль).
   buildReportDoc(sample, variant) → HTML <div class="doc">…</div>.
   variant: 'full' (по умолчанию) | 'compact' (сжатое).
   Бланк лаборатории «Геномед» + структура результата в стиле Galleri.
   ============================================================ */

function genomedLogoSVG(){
  return `<img src="${typeof GENOMED_LOGO!=='undefined'?GENOMED_LOGO:''}" alt="Геномед" class="gm-logo-img">`;
}
function miniIcon(path){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
const _IC_PHONE = '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.98.36 1.93.7 2.85a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.34 1.87.57 2.85.7A2 2 0 0 1 22 16.92z"/>';
const _IC_MAIL = '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>';
const _IC_GLOBE = '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>';

function reportSealSVG(){
  return `<svg viewBox="0 0 200 200" fill="none">
    <defs><path id="arcTop" d="M 22 100 A 78 78 0 0 1 178 100"/><path id="arcBot" d="M 28 100 A 72 72 0 0 0 172 100"/></defs>
    <circle cx="100" cy="100" r="95" stroke="#12599c" stroke-width="3"/><circle cx="100" cy="100" r="88" stroke="#12599c" stroke-width="1"/><circle cx="100" cy="100" r="63" stroke="#12599c" stroke-width="1.4"/>
    <g fill="#12599c" font-family="Montserrat, sans-serif" font-weight="700" letter-spacing="1.1">
      <text font-size="10.2"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">ООО «ГЕНОМЕД» · ЛАБОРАТОРИЯ МОЛЕКУЛЯРНОЙ ПАТОЛОГИИ</textPath></text>
      <text font-size="11"><textPath href="#arcBot" startOffset="50%" text-anchor="middle">EpiPrint · cfDNA METHYLATION · МОСКВА</textPath></text></g>
    <text x="20" y="105" fill="#12599c" font-size="15" text-anchor="middle">✦</text><text x="180" y="105" fill="#12599c" font-size="15" text-anchor="middle">✦</text>
    <g transform="translate(100,72)" stroke="#12599c" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M-9 -8 C-3 -3, 3 3, 9 8"/><path d="M9 -8 C3 -3, -3 3, -9 8"/><path d="M-7 -8 H7"/><path d="M-4 -3 H4"/><path d="M-4 3 H4"/><path d="M-7 8 H7"/></g>
    <text x="100" y="108" fill="#12599c" font-family="Montserrat, sans-serif" font-weight="800" font-size="12" text-anchor="middle" letter-spacing="1">ОГРН</text>
    <text x="100" y="124" fill="#12599c" font-family="monospace" font-size="10.5" text-anchor="middle" letter-spacing="1">1077763509977</text></svg>`;
}

function buildReportDoc(s, variant){
  const compact = variant === 'compact';
  const sc = s.score, detected = sc.cancerProb > 0.5;
  const d = new Date(s.date+'T00:00:00');
  const fmtD = dt=>`${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
  const collect = new Date(d); collect.setDate(d.getDate()-3);
  const recv = new Date(d); recv.setDate(d.getDate()-2);
  const reportNo = 'EP-'+s.id+'/'+s.run.slice(2);
  const top2 = CANCER_TYPES.map(t=>({...t, v:sc.localization[t.key]})).sort((a,b)=>b.v-a.v).slice(0,2);
  const detColor = detected ? (sc.risk==='high' ? '#c0392b' : '#c8820a') : '#1a8a52';
  const riskWord = { high:'высокая', medium:'средняя', low:'низкая' }[sc.risk];

  const detectionText = detected
    ? `В образце свободно циркулирующей ДНК плазмы крови выявлен профиль метилирования, характерный для онкологического процесса. Расчётная вероятность наличия онкологического процесса — <b>${pct(sc.cancerProb)}</b>; категория риска — <b>${riskWord}</b>. Результат подлежит подтверждению методами клинического и инструментального обследования.`
    : `В образце свободно циркулирующей ДНК плазмы крови профиль метилирования, характерный для онкологического процесса, не выявлен. Расчётная вероятность наличия онкологического процесса — <b>${pct(sc.cancerProb)}</b>; категория риска — <b>${riskWord}</b>. Отрицательный результат не исключает наличия онкологического заболевания.`;

  // Интерпретация (в сжатом — с добавлением сути методики)
  let interpText = detected
    ? `Выявленный профиль метилирования ассоциирован с онкологическим процессом. Показано дообследование у профильного специалиста для верификации результата и установления окончательного диагноза.`
    : `Признаки онкологического процесса в исследованном образце не обнаружены. Рекомендовано продолжение планового скринингового наблюдения в соответствии с возрастом и факторами риска пациента.`;
  if (compact) interpText += ` Исследование выполнено методом анализа метилирования свободно циркулирующей ДНК плазмы крови (панель из ${s.heatmap.N} маркерных регионов, референсный геном GRCh38; секвенирование DNBSEQ/Illumina; контроль качества образца — ${s.qc.verdict==='Pass'?'пройден':'с замечаниями'}).`;

  // Ограничения интерпретации (в сжатом — с добавлением сути ограничений метода)
  let limitText = detected
    ? `Результат исследования не является установленным диагнозом и не может служить единственным основанием для его постановки. Окончательная интерпретация осуществляется лечащим врачом с учётом клинической картины и данных иных методов обследования.`
    : `Отрицательный результат не исключает наличия онкологического заболевания, в том числе локализаций, не входящих в исследуемую панель. Окончательная интерпретация осуществляется лечащим врачом с учётом клинической картины.`;
  if (compact) limitText += ` Исследование не заменяет стандартные методы обследования; диагностическая чувствительность снижается на ранних стадиях заболевания и при низкой доле опухолевой ДНК в образце; панель охватывает ограниченный перечень локализаций.`;

  // --- реквизиты образца: полный (тех.) vs сжатый (в стиле бланка Геномед) ---
  const infoFull = `
    <div class="rp-info">
      <div><h4>Пациент</h4><dl>
        <dt>Код</dt><dd>${s.patientCode}</dd>
        <dt>Индивидуальный №</dt><dd>${s.patientNo}</dd>
        <dt>Пол</dt><dd>${s.sex==='Ж'?'женский':'мужской'}</dd>
        <dt>Возраст</dt><dd>${s.age} лет</dd>
      </dl></div>
      <div><h4>Образец и метод</h4><dl>
        <dt>Идентификатор</dt><dd>${s.seqId}</dd>
        <dt>Биоматериал</dt><dd>плазма крови, cfDNA</dd>
        <dt>Метод · набор</dt><dd>${s.kit.method} · ${s.kit.label}</dd>
        <dt>Референсный геном</dt><dd>GRCh38 (${s.ref})</dd>
      </dl></div>
      <div><h4>Сроки исследования</h4><dl>
        <dt>Направитель</dt><dd style="font-family:var(--body)">${s.contractor}</dd>
        <dt>Забор материала</dt><dd>${fmtD(collect)}</dd>
        <dt>Поступление</dt><dd>${fmtD(recv)}</dd>
        <dt>Готовность</dt><dd>${fmtD(d)}</dd>
        <dt>Заключение №</dt><dd>${reportNo}</dd>
      </dl></div>
    </div>`;

  const infoCompact = `
    <div class="rp-gm-info">
      <div>
        <div class="r"><b>Номер договора:</b><span>Д-${s.id}/26</span></div>
        <div class="r"><b>Пациент:</b><span>${s.patientCode}</span></div>
        <div class="r"><b>Дата рождения · пол:</b><span>[дд.мм.гггг] · ${s.sex==='Ж'?'женский':'мужской'}</span></div>
        <div class="r"><b>Вид биоматериала:</b><span>плазма крови (cfDNA)</span></div>
        <div class="r"><b>Вид исследования:</b><span>EpiPrint — метилирование cfDNA (MCED)</span></div>
      </div>
      <div>
        <div class="r"><b>Дата забора материала:</b><span>${fmtD(collect)}</span></div>
        <div class="r"><b>Поступление в лабораторию:</b><span>${fmtD(recv)}</span></div>
        <div class="r"><b>Дата готовности:</b><span>${fmtD(d)}</span></div>
        <div class="r"><b>Заключение №:</b><span>${reportNo}</span></div>
      </div>
    </div>`;

  const infoBlock = compact ? infoCompact : infoFull;

  const predictionBlock = detected ? `
    <div class="rp-sec">
      <div class="rp-sec__tab" style="background:var(--pred)">Локализация</div>
      <div class="rp-sec__body">
        <div class="pred-h">Предполагаемая локализация источника сигнала</div>
        <hr class="pred-rule">
        <div class="pred-grid">
          <div class="cso-card">
            <div class="cso-card__hd">Источник сигнала</div>
            <div class="cso-card__bd">
              <div class="cso-label">Наиболее вероятная локализация</div>
              <div class="cso-name">${top2[0].label}</div>
              <div class="cso-meter"><i style="width:100%"></i></div>
              <div class="cso-second">
                <div class="cso-label">Альтернативная локализация</div>
                <div class="cso-name" style="font-size:13px">${top2[1].label}</div>
                <div class="cso-meter"><i style="width:${Math.round(top2[1].v/top2[0].v*100)}%"></i></div>
              </div>
            </div>
          </div>
          <div class="pred-expl">
            <p>Предполагаемая локализация источника сигнала указывает ткань или орган, ассоциированные с выявленным профилем метилирования, и предназначена для определения приоритетного направления диагностического поиска.</p>
            <p>Протяжённость индикатора отражает степень соответствия профиля метилирования опухолям указанной локализации: большей протяжённости соответствует более высокая степень соответствия. Диагностическую оценку следует начинать с наиболее вероятной локализации.</p>
            <p class="it">Протяжённость индикатора не отражает вероятность наличия злокачественного новообразования и не заменяет топической диагностики.</p>
          </div>
        </div>
      </div>
    </div>`
  : `
    <div class="rp-sec">
      <div class="rp-sec__tab" style="background:var(--pred)">Локализация</div>
      <div class="rp-sec__body">
        <div class="pred-h">Локализация источника сигнала</div>
        <hr class="pred-rule">
        <p style="font-size:9.4px;color:#6b7280;line-height:1.5;margin:0;text-align:justify">Определение локализации источника сигнала не проводится при отсутствии онкологического сигнала.</p>
      </div>
    </div>`;

  // блок «Ограничения метода / Методика» — только в полном варианте
  const fineBlock = compact ? '' : `
    <div class="rp-fine">
      <div><h6>Ограничения метода</h6><ul>
        <li>Исследование не заменяет установленный клинический диагноз и требует подтверждения стандартными методами обследования.</li>
        <li>Диагностическая чувствительность метода снижается на ранних стадиях заболевания и при низкой доле опухолевой ДНК в образце.</li>
        <li>Панель охватывает ограниченный перечень локализаций; отдельные нозологические формы могут не выявляться.</li>
      </ul></div>
      <div><h6>Методика</h6><p>Исследование профиля метилирования свободно циркулирующей ДНК плазмы крови по панели из ${s.heatmap.N} маркерных регионов. Референсный геном — GRCh38 (${s.ref}); платформа секвенирования — DNBSEQ/Illumina. Контроль качества образца — <b>${s.qc.verdict==='Pass'?'пройден':'с замечаниями'}</b>. Оценка вероятности выполнена путём сопоставления профиля метилирования образца с референсными профилями.</p></div>
    </div>`;

  return `
  <div class="doc" style="--det:${detColor};--pred:#463c8c">
    <div class="gm-head">
      <div class="gm-logo">${genomedLogoSVG()}</div>
      <div class="gm-org">
        <div class="gm-reg"><span>ООО «ГЕНОМЕД»</span><span>ИНН/КПП 7701759381/770101001</span><span>ОГРН 1077763509977</span></div>
        <div class="gm-lab">ЛАБОРАТОРИЯ МОЛЕКУЛЯРНОЙ ПАТОЛОГИИ</div>
        <div class="gm-addr">Юр. адрес: 105005, Россия, г. Москва, ул. Бауманская, д. 50/12, стр. 1</div>
      </div>
      <div class="gm-contacts">
        <div>${miniIcon(_IC_PHONE)} +7 (495) 660-83-77</div>
        <div>${miniIcon(_IC_PHONE)} +7 800-333-45-38</div>
        <div>${miniIcon(_IC_MAIL)} callcenter@genomed.ru</div>
        <div>${miniIcon(_IC_GLOBE)} www.genomed.ru</div>
      </div>
    </div>
    <hr class="gm-rule"><hr class="gm-rule2">

    <div class="rp-titleblock">
      <div class="rp-title">ЗАКЛЮЧЕНИЕ</div>
      <div class="rp-subtitle">по результатам исследования метилирования свободно циркулирующей ДНК · тест <b>EpiPrint</b> (ранняя диагностика онкологического процесса)</div>
    </div>

    ${infoBlock}

    <div class="rp-sec">
      <div class="rp-sec__tab" style="background:var(--det)">Выявление</div>
      <div class="rp-sec__body">
        <div class="resultbox">
          <div class="resultbox__legend">Результат</div>
          <div class="result-icon">${detected ? '!' : icon('check')}</div>
          <div>
            <div class="result-h">${detected ? 'Онкологический сигнал обнаружен' : 'Онкологический сигнал не обнаружен'}</div>
            <p class="result-p">${detectionText}</p>
          </div>
        </div>
        <div class="rp-two">
          <div><h5>${icon('circle-check')} Интерпретация</h5><p>${interpText}</p></div>
          <div><h5>${icon('alert-triangle')} Ограничения интерпретации</h5><p>${limitText}</p></div>
        </div>
      </div>
    </div>

    ${predictionBlock}

    ${fineBlock}

    <div class="rp-sign">
      <div>
        <div class="rp-sign__who">Заведующий лабораторией</div>
        <div class="rp-sign__line">
          <div class="rp-sign__name">[И. О. Фамилия]</div>
          <div class="rp-sign__role">врач клинической лабораторной диагностики</div>
        </div>
        <div class="rp-sign__who" style="margin-top:8px">Дата выдачи: ${fmtD(d)}</div>
      </div>
      <div class="seal">${reportSealSVG()}</div>
    </div>

    <div class="rp-foot">
      <div>ООО «Геномед» · Лаборатория молекулярной патологии · г. Москва, ул. Бауманская, д. 50/12, стр. 1</div>
      <div style="text-align:right">Конфиденциально · содержит персональные данные<br>Заключение № ${reportNo} · сформировано ЛИС EpiPrint</div>
    </div>
  </div>`;
}
