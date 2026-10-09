// CALC-START
const P = {
  zusCap: 282600, limit: 85528, thr: 120000, reduction: 3600, monthRed: 300, autLimit: 120000,
  healthMin: 432.54, linHealthLimit: 14100, ryc: [498.35, 830.58, 1495.04],
  fullBase: 5652, prefBase: 1441.80
};
const r2 = x => Math.round(x * 100) / 100;
const scaleTax = b => b <= P.thr ? b * 0.12 : P.thr * 0.12 + (b - P.thr) * 0.32;

function calcEmployment(s) {
  const isUop = s.form === 'uop', isZl = s.form === 'zlecenie', isDz = s.form === 'dzielo';
  const student = isZl && s.student;
  const hasZus = isUop || (isZl && !student);
  const reliefOn = !isDz && (s.powrot || s.mlodzi || student);
  let cumZus = 0, cumEx = 0, cumBase = 0, cumAut = 0;
  const rows = [];
  let flagRelief = false, flag32 = false, flagCap = false;
  for (let m = s.start; m < 12; m++) {
    const G = s.gross;
    let baseER = 0, emer = 0, rent = 0, chor = 0, health = 0;
    if (hasZus) {
      baseER = Math.max(0, Math.min(G, P.zusCap - cumZus)); cumZus += baseER;
      emer = r2(baseER * 0.0976); rent = r2(baseER * 0.015);
      chor = (isUop || s.zlChor) ? r2(G * 0.0245) : 0;
    }
    const social = r2(emer + rent + chor);
    if (hasZus) health = r2((G - social) * 0.09);
    const ppkE = (isUop && s.ppk) ? r2(G * 0.02) : 0;
    const ppkR = (isUop && s.ppk) ? r2(G * 0.015) : 0;
    const revenue = G + ppkR;
    const exempt = reliefOn ? Math.min(revenue, Math.max(0, P.limit - cumEx)) : 0;
    cumEx += exempt;
    const taxRev = revenue - exempt;
    const ratio = revenue > 0 ? taxRev / revenue : 0;
    const socialTax = r2(social * ratio);
    let kup = 0;
    if (isUop) {
      const share = s.aut / 100;
      let aut = 0;
      if (share > 0 && taxRev > 0) {
        aut = Math.max(0, 0.5 * share * (taxRev - socialTax));
        aut = Math.min(aut, Math.max(0, P.autLimit - cumAut)); cumAut += aut;
      }
      const std = (share < 1 && taxRev > 0) ? Math.min(s.kup300 ? 300 : 250, taxRev * (1 - share)) : 0;
      kup = r2(aut + std);
    } else if (isZl) {
      kup = r2(Math.max(0, (taxRev - socialTax) * 0.2));
    } else {
      if (s.dzAut) { kup = Math.min(taxRev * 0.5, Math.max(0, P.autLimit - cumAut)); cumAut += kup; kup = r2(kup); }
      else kup = r2(taxRev * 0.2);
    }
    const base = Math.max(0, Math.round(taxRev - kup - socialTax));
    const below = Math.max(0, Math.min(base, P.thr - cumBase));
    const above = base - below;
    cumBase += base;
    const tax = below * 0.12 + above * 0.32;
    const red = (s.pit2 && !isDz) ? P.monthRed : 0;
    const adv = Math.max(0, Math.round(tax - red));
    const net = r2(G - social - health - ppkE - adv);
    let er = G;
    if (isUop) er = r2(G + baseER * (0.0976 + 0.065) + G * (0.0167 + 0.0245 + 0.001) + ppkR);
    else if (hasZus) er = r2(G + baseER * (0.0976 + 0.065) + G * (0.0167 + 0.0245));
    const tags = [];
    if (reliefOn && !flagRelief && taxRev > 0) { flagRelief = true; tags.push(['pit', exempt > 0 ? 'лимит льготы исчерпан' : 'льгота закончилась']); }
    if (!flag32 && above > 0) { flag32 = true; tags.push(['pit', 'ставка 32%']); }
    if (hasZus && !flagCap && baseER < G) { flagCap = true; tags.push(['zus', 'лимит ZUS']); }
    rows.push({ m, G, social, health, ppkE, ppkR, adv, net, er, exempt, kup, tags });
  }
  const sum = k => r2(rows.reduce((a, r) => a + r[k], 0));
  const sG = sum('G'), sSocial = sum('social'), sHealth = sum('health'), sPpkE = sum('ppkE'), sPpkR = sum('ppkR'),
        sAdv = sum('adv'), sEx = sum('exempt'), sKup = sum('kup'), sEr = sum('er'), sNetMonthly = sum('net');
  const annBase = Math.max(0, Math.round(sG + sPpkR - sEx - sKup - sSocial));
  const annTax = Math.max(0, Math.round(scaleTax(annBase) - P.reduction));
  const settle = annTax - sAdv;
  const netYear = r2(sG - sSocial - sHealth - sPpkE - annTax);
  return { kind: 'emp', n: rows.length, rows, sG, sSocial, sHealth, sPpkE, sPpkR, sAdv, sEx, sKup, sEr, sNetMonthly,
           annBase, annTax, settle, netYear, reliefOn, hasZus };
}

function b2bZus(stage, chor) {
  if (stage === 'start') return { soc: 0, fp: 0 };
  const b = stage === 'full' ? P.fullBase : P.prefBase;
  let soc = r2(b * 0.1952) + r2(b * 0.08) + r2(b * 0.0167) + (chor ? r2(b * 0.0245) : 0);
  const fp = stage === 'full' ? r2(b * 0.0245) : 0;
  return { soc: r2(soc), fp };
}

function calcB2B(s) {
  const n = 12 - s.start;
  const R = s.rev, C = s.cost;
  const { soc, fp } = b2bZus(s.zusStage, s.b2bChor);
  const revA = R * n, costA = C * n, socialA = r2(soc * n), fpA = r2(fp * n);
  const exempt = s.powrot ? Math.min(P.limit, revA) : 0;
  const share = revA > 0 ? exempt / revA : 0;
  const incM = R - C - fp;
  let hm, base, tax, healthA;
  if (s.b2bTax === 'skala') {
    hm = Math.max(r2(0.09 * Math.max(0, incM - soc)), P.healthMin);
    healthA = r2(hm * n);
    base = Math.max(0, Math.round((revA - costA - fpA) * (1 - share) - socialA));
    tax = Math.max(0, Math.round(scaleTax(base) - P.reduction));
  } else if (s.b2bTax === 'liniowy') {
    hm = Math.max(r2(0.049 * Math.max(0, incM - soc)), P.healthMin);
    healthA = r2(hm * n);
    const ded = Math.min(healthA, P.linHealthLimit);
    base = Math.max(0, Math.round((revA - costA - fpA) * (1 - share) - socialA - ded));
    tax = Math.round(base * 0.19);
  } else {
    const tier = revA <= 60000 ? 0 : revA <= 300000 ? 1 : 2;
    hm = P.ryc[tier];
    healthA = r2(hm * n);
    base = Math.max(0, Math.round(revA - exempt - socialA - 0.5 * healthA));
    tax = Math.round(base * s.rycRate / 100);
  }
  const netYear = r2(revA - costA - socialA - fpA - healthA - tax);
  return { kind: 'b2b', n, revA, costA, socialA, fpA, healthA, tax, base, netYear, exempt, soc, fp, hm };
}
// CALC-END

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const fmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const zl = x => fmt.format(x) + ' zł';
const zl0 = x => fmt0.format(x) + ' zł';

const DEF = { form: 'uop', gross: 15000, rev: 20000, cost: 500, start: 0, b2bTax: 'liniowy', rycRate: 12, zusStage: 'full',
  pit2: true, powrot: false, mlodzi: false, student: false, zlChor: true, b2bChor: false, kup300: false, ppk: false, dzAut: false, aut: 0 };
let S = { ...DEF };
try { const saved = JSON.parse(localStorage.getItem('pl-salary-2026') || 'null'); if (saved) S = { ...DEF, ...saved }; } catch (e) {}

const $ = id => document.getElementById(id);
const startSel = $('start');
MONTHS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = 'С 1 ' + MONTHS_GEN[i]; startSel.appendChild(o); });

function parseNum(v) { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; }

function syncInputs() {
  document.querySelector(`input[name=form][value="${S.form}"]`).checked = true;
  document.querySelector(`input[name=b2bTax][value="${S.b2bTax}"]`).checked = true;
  document.querySelector(`input[name=zusStage][value="${S.zusStage}"]`).checked = true;
  $('gross').value = fmt0.format(S.gross); $('rev').value = fmt0.format(S.rev); $('cost').value = fmt0.format(S.cost);
  startSel.value = S.start; $('rycRate').value = String(S.rycRate);
  ['pit2','powrot','mlodzi','student','zlChor','b2bChor','kup300','ppk','dzAut'].forEach(k => $(k).checked = !!S[k]);
  $('aut').value = S.aut; $('autOut').textContent = S.aut + '%';
}

function readInputs() {
  S.form = document.querySelector('input[name=form]:checked').value;
  S.b2bTax = document.querySelector('input[name=b2bTax]:checked').value;
  S.zusStage = document.querySelector('input[name=zusStage]:checked').value;
  S.gross = parseNum($('gross').value); S.rev = parseNum($('rev').value); S.cost = parseNum($('cost').value);
  S.start = +startSel.value; S.rycRate = parseFloat($('rycRate').value);
  ['pit2','powrot','mlodzi','student','zlChor','b2bChor','kup300','ppk','dzAut'].forEach(k => S[k] = $(k).checked);
  S.aut = +$('aut').value; $('autOut').textContent = S.aut + '%';
}

function visibility() {
  document.querySelectorAll('[data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(S.form); });
  $('rycWrap').hidden = S.b2bTax !== 'ryczalt';
  $('monthlyPanel').hidden = S.form === 'b2b';
}

function legendItem(color, name, val, total) {
  const pc = total > 0 ? Math.round(val / total * 1000) / 10 : 0;
  return `<div class="it"><span class="dot" style="background:${color}"></span><span class="nm">${name}</span><span class="vl num">${zl0(val)}<span class="pc">${String(pc).replace('.', ',')}%</span></span></div>`;
}

function renderParts(parts, total) {
  $('bar').innerHTML = parts.filter(p => p.v > 0).map(p => `<div style="width:${(p.v / total * 100).toFixed(3)}%;background:${p.c}" title="${p.n}"></div>`).join('');
  $('legend').innerHTML = parts.filter(p => p.v > 0 || p.always).map(p => legendItem(p.c, p.n, p.v, total)).join('');
}

const css = v => `var(${v})`;

function render() {
  visibility();
  const notes = [];
  const periodTxt = n => n === 12 ? 'за год' : `за ${n} ${n === 1 ? 'месяц' : n < 5 ? 'месяца' : 'месяцев'}`;
  if (S.form === 'b2b') {
    const r = calcB2B(S);
    $('capLine').textContent = 'На руки в среднем за месяц';
    $('netBig').innerHTML = `${fmt0.format(r.netYear / r.n)}<small>zł</small>`;
    $('facts').innerHTML = `<span>${periodTxt(r.n)}: <b class="num">${zl0(r.netYear)}</b></span><span>Выручка ${periodTxt(r.n)}: <b class="num">${zl0(r.revA)}</b></span>`;
    const total = r.revA;
    renderParts([
      { n: 'На руки', v: Math.max(0, r.netYear), c: css('--c-net'), always: true },
      { n: 'Расходы фирмы', v: r.costA, c: css('--c-cost') },
      { n: 'ZUS', v: r.socialA + r.fpA, c: css('--c-zus') },
      { n: 'Zdrowotna', v: r.healthA, c: css('--c-health') },
      { n: 'PIT', v: r.tax, c: css('--c-pit') }
    ], total);
    const taxName = S.b2bTax === 'liniowy' ? 'PIT 19% (liniowy)' : S.b2bTax === 'skala' ? 'PIT по шкале 12% / 32%' : `Ryczałt ${String(S.rycRate).replace('.', ',')}%`;
    const rowsB = [
      ['Выручка (netto на фактуре)', r.revA / r.n, r.revA],
      ['Расходы фирмы', -r.costA / r.n, -r.costA],
      ['ZUS społeczne' + (S.zusStage === 'start' ? ' (ulga na start — 0)' : ''), -r.socialA / r.n, -r.socialA],
      ['Fundusz Pracy', -r.fpA / r.n, -r.fpA],
      ['Składka zdrowotna', -r.healthA / r.n, -r.healthA],
      [taxName, -r.tax / r.n, -r.tax]
    ].filter(x => !(x[0] === 'Fundusz Pracy' && x[2] === 0));
    $('breakdown').innerHTML = `<thead><tr><th></th><th>В месяц</th><th>${periodTxt(r.n).replace(/^за /, 'За ')}</th></tr></thead><tbody>` +
      rowsB.map(x => `<tr><td>${x[0]}</td><td>${zl(x[1])}</td><td>${zl(x[2])}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>На руки</td><td>${zl(r.netYear / r.n)}</td><td>${zl(r.netYear)}</td></tr></tfoot>`;
    if (S.powrot) notes.push(['ok', `Ulga na powrót освобождает ${zl0(r.exempt)} выручки от налога. ZUS и składка zdrowотна платятся в полном размере.`]);
    if (S.b2bTax === 'ryczalt') notes.push(['', `Składka zdrowotna na ryczałt: ${zl(r.hm)} в месяц (порог по годовой выручке ${zl0(r.revA)}). Половину её можно вычесть из выручки.`]);
    if (S.b2bTax === 'liniowy' && r.healthA > P.linHealthLimit) notes.push(['', `Składka zdrowotna na liniowym уменьшает доход только до ${zl0(P.linHealthLimit)} в год, остаток не вычитается.`]);
    if (r.netYear < 0) notes.push(['warn', 'Взносы и налоги больше, чем остаётся после расходов. Проверьте суммы.']);
  } else {
    const r = calcEmployment(S);
    $('capLine').textContent = 'На руки в среднем за месяц';
    const avg = r.netYear / r.n;
    $('netBig').innerHTML = `${fmt0.format(avg)}<small>zł</small>`;
    const first = r.rows[0];
    const facts = [`<span>${periodTxt(r.n)}: <b class="num">${zl0(r.netYear)}</b></span>`];
    if (first) facts.push(`<span>Первая выплата: <b class="num">${zl0(first.net)}</b></span>`);
    if (S.form !== 'dzielo' && r.hasZus) facts.push(`<span>Стоимость для работодателя: <b class="num">${zl0(r.sEr / r.n)}</b> в месяц</span>`);
    $('facts').innerHTML = facts.join('');
    renderParts([
      { n: 'На руки', v: Math.max(0, r.netYear), c: css('--c-net'), always: true },
      { n: 'ZUS', v: r.sSocial, c: css('--c-zus') },
      { n: 'Zdrowotna', v: r.sHealth, c: css('--c-health') },
      { n: 'PIT за год', v: r.annTax, c: css('--c-pit'), always: true },
      { n: 'PPK (ваш взнос)', v: r.sPpkE, c: css('--c-ppk') }
    ], r.sG);
    const rowsE = [
      ['Брутто', r.sG / r.n, r.sG],
      ['ZUS (emerytalne, rentowe, chorobowe)', -r.sSocial / r.n, -r.sSocial],
      ['Składka zdrowotna 9%', -r.sHealth / r.n, -r.sHealth],
      ['Авансы PIT, удержанные бухгалтерией', -r.sAdv / r.n, -r.sAdv],
      ['PPK, ваш взнос 2%', -r.sPpkE / r.n, -r.sPpkE]
    ].filter(x => !(x[0].startsWith('PPK') && x[2] === 0) && !(x[0].startsWith('ZUS') && !r.hasZus) && !(x[0].startsWith('Składka') && !r.hasZus));
    let foot = `<tr><td>На руки по выплатам</td><td>${zl(r.sNetMonthly / r.n)}</td><td>${zl(r.sNetMonthly)}</td></tr>`;
    if (Math.abs(r.settle) >= 1) foot += `<tr><td>${r.settle < 0 ? 'Возврат' : 'Доплата'} в годовой декларации PIT-37</td><td></td><td>${r.settle < 0 ? '+' : '−'}${zl(Math.abs(r.settle))}</td></tr><tr><td>Итого с учётом декларации</td><td>${zl(r.netYear / r.n)}</td><td>${zl(r.netYear)}</td></tr>`;
    $('breakdown').innerHTML = `<thead><tr><th></th><th>В месяц</th><th>${periodTxt(r.n).replace(/^за /, 'За ')}</th></tr></thead><tbody>` +
      rowsE.map(x => `<tr><td>${x[0]}</td><td>${zl(x[1])}</td><td>${zl(x[2])}</td></tr>`).join('') + `</tbody><tfoot>${foot}</tfoot>`;

    const hasPpk = r.sPpkE > 0;
    $('monthly').innerHTML = `<thead><tr><th>Месяц</th><th>Брутто</th>${r.hasZus ? '<th>ZUS</th><th>Zdrowotna</th>' : ''}<th>PIT</th>${hasPpk ? '<th>PPK</th>' : ''}<th>На руки</th></tr></thead><tbody>` +
      r.rows.map(x => `<tr><td>${MONTHS[x.m]}${x.tags.map(t => `<span class="chip ${t[0]}">${t[1]}</span>`).join('')}</td><td>${zl(x.G)}</td>${r.hasZus ? `<td>${zl(x.social)}</td><td>${zl(x.health)}</td>` : ''}<td>${zl(x.adv)}</td>${hasPpk ? `<td>${zl(x.ppkE)}</td>` : ''}<td class="netc">${zl(x.net)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Итого</td><td>${zl(r.sG)}</td>${r.hasZus ? `<td>${zl(r.sSocial)}</td><td>${zl(r.sHealth)}</td>` : ''}<td>${zl(r.sAdv)}</td>${hasPpk ? `<td>${zl(r.sPpkE)}</td>` : ''}<td class="netc">${zl(r.sNetMonthly)}</td></tr></tfoot>`;

    if (r.reliefOn) {
      const used = r.sEx;
      notes.push(['ok', used >= P.limit - 0.5
        ? `Льгота освобождает от PIT первые ${zl0(P.limit)} дохода. Лимит исчерпан в месяце «${MONTHS[r.rows.find(x => x.tags.some(t => t[1].includes('льгот')))?.m ?? 11]}», после этого налог удерживается как обычно.`
        : `Весь доход за период (${zl0(used)}) укладывается в лимит ${zl0(P.limit)} — PIT не удерживается.`]);
    }
    if (S.form === 'dzielo' && S.powrot) notes.push(['warn', 'Ulga na powrót не распространяется на umowa o dzieło.']);
    if (Math.abs(r.settle) >= 1) notes.push(['', r.settle < 0
      ? `После годовой декларации PIT-37 налоговая вернёт около ${zl0(-r.settle)}. ${r.reliefOn ? 'Это взносы ZUS с освобождённого дохода, которые бухгалтерия не может учесть в течение года.' : 'Бухгалтерия в течение года удерживает налог с запасом.'}`
      : `По декларации PIT-37 придётся доплатить около ${zl0(r.settle)}.`]);
    if (S.form === 'uop' && !S.pit2) notes.push(['', 'Без PIT-2 бухгалтерия удерживает на 300 zł в месяц больше. Эту сумму вернут по декларации.']);
  }
  $('notes').innerHTML = notes.map(n => `<div class="note ${n[0] === 'warn' ? 'warn' : ''}">${n[1]}</div>`).join('');
  try { localStorage.setItem('pl-salary-2026', JSON.stringify(S)); } catch (e) {}
}

syncInputs();
$('f').addEventListener('input', () => { readInputs(); render(); });
$('f').addEventListener('change', () => { readInputs(); render(); });
['gross', 'rev', 'cost'].forEach(id => $(id).addEventListener('blur', () => { $(id).value = fmt0.format(parseNum($(id).value)); }));
render();
