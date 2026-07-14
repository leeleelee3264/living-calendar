// 뷰 계층: 화면 렌더링 + 설정 다이얼로그. 상태를 읽어 DOM 을 그린다.
// (이벤트 배선·상호작용은 main.js)
import { CHORES, NTH, WD_KO, WD_EN, WD_EN_FULL, MON_EN, t } from './data.js';
import { S, DONE, saveSettings, resetSettings } from './storage.js';
import {
  ymd, parseYMD, fmtDate, fmtShort, inHourRange,
  pick, weekIndex, monthIndex, mod, otherOf,
  addDays, nextWeekdayDate, nextBiweekly, nextMonthly, choresFor,
} from './core.js';
import { wx24, wxInfo, repWeather } from './weather.js';
import { accountData, hasAccountUrl, thisMonthTotal, recentTxs } from './livingAccount.js';

export const $ = s => document.querySelector(s);
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}

// 달력 이동 · 바텀시트 상태. 라이브 바인딩 대신 객체로 노출해 main 에서 프로퍼티를 갱신한다.
const now0 = new Date();
export const view = {
  y: now0.getFullYear(),
  m: now0.getMonth(),
  sheetDateStr: null,
  sheetMode: null,
  curDate: ymd(new Date()),
};

/* ====================================================================
   렌더링
==================================================================== */

// 오늘 체크리스트 / 바텀시트의 한 줄
function choreRow(c, ds){
  const done = !!DONE[ds+'|'+c.id];
  const ch = CHORES[c.id];
  const swapped = c.who !== c.base;
  const tap = c.who==='both' ? '' : `onclick="swapWho(event,'${ds}','${c.id}')"`;
  const p = c.who==='both' ? null : S.people[c.who];
  const chip = c.who==='both'
    ? `<span class="chip both">${t('together')}</span>`
    : `<span class="chip tap" ${tap} style="background:${p.color};color:#fff;border-color:${p.color}">${swapped?t('swapped')+' ':''}${esc(p.name)}</span>`;
  const freq = ch.daily ? '' : `<small>${ch.freq[S.lang]}</small>`;   // "매일" 은 노이즈라 생략
  return `<label class="chore ${done?'done':''}">
    <input type="checkbox" ${done?'checked':''} onchange="toggleDone('${ds}','${c.id}')">
    <span class="emoji">${ch.emoji}</span>
    <span class="cname">${ch[S.lang]}${freq}</span>
    ${chip}
  </label>`;
}

export function renderChrome(){
  $('#btnLang').textContent = S.lang==='ko' ? 'EN' : '한';
  $('#btnCalToday').textContent = t('todayBtn');
}

export function renderClock(){
  const n = new Date();
  $('#clkTime').textContent = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  $('#clkDate').textContent = S.lang==='ko'
    ? `${n.getMonth()+1}월 ${n.getDate()}일 ${WD_KO[n.getDay()]}요일`
    : `${WD_EN_FULL[n.getDay()]}, ${MON_EN[n.getMonth()]} ${n.getDate()}`;
}

/* ---------- 상시 노출 대응: 테마 · 심야 화면끄기 · 픽셀 시프트 ---------- */
export function applyTheme(){
  const h = new Date().getHours();
  const dark = S.theme==='dark' || (S.theme==='auto' && inHourRange(h, S.darkStart, S.darkEnd));
  document.body.classList.toggle('dark', dark);
}

// 번인 방지: 심야엔 검은 오버레이 + 은은하게 떠다니는 시계
let sleepPeekUntil = 0;
export function applySleep(){
  const n = new Date();
  const active = S.sleep.on && inHourRange(n.getHours(), S.sleep.start, S.sleep.end)
    && Date.now() > sleepPeekUntil;
  $('#sleep').classList.toggle('on', active);
  if(active){
    $('#sleepClk').textContent =
      String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
    const k = Math.floor(Date.now()/60000);   // 시계 위치도 1분마다 이동
    $('#sleepClk').style.transform = `translate(${(k*37)%160-80}px, ${(k*53)%200-100}px)`;
  }
}
// 심야 모드 깨우기: 터치 시점부터 1분 유지 (main 의 pointerdown 에서 호출)
export function wakeSleep(){
  const n = new Date();
  if(S.sleep.on && inHourRange(n.getHours(), S.sleep.start, S.sleep.end)){
    sleepPeekUntil = Date.now() + 60000;
    applySleep();
  }
}
export function applyShift(){
  const k = Math.floor(Date.now()/300000);    // 5분마다 화면 전체 1~2px 이동
  const app = document.querySelector('.app');
  if(app) app.style.transform = `translate(${(k*7)%5-2}px, ${(k*13)%5-2}px)`;
}

export function renderToday(){
  const d = new Date();
  const ds = ymd(d);
  const list = choresFor(d);
  const doneN = list.filter(c=>DONE[ds+'|'+c.id]).length;
  const pct = Math.round(doneN/list.length*100);
  $('#todayCard').innerHTML =
    `<div class="cardHead"><h2>${t('today')}</h2>
       <span class="prog">${doneN===list.length ? t('allDone') : doneN+'/'+list.length}</span></div>
     <div class="pbar"><i style="width:${pct}%"></i></div>` +
    list.map(c=>choreRow(c, ds)).join('');
}

export function renderCalendar(){
  $('#calTitle').textContent = S.lang==='ko' ? `${view.y}년 ${view.m+1}월` : `${MON_EN[view.m]} ${view.y}`;
  const wds = S.lang==='ko' ? WD_KO : WD_EN;
  let html = wds.map((w,i)=>`<div class="wdh ${i===0?'sun':i===6?'sat':''}">${w}</div>`).join('');

  const firstWd = new Date(view.y, view.m, 1).getDay();
  const dim = new Date(view.y, view.m+1, 0).getDate();
  const todayStr = ymd(new Date());
  for(let i=0;i<firstWd;i++) html += `<div class="cell empty"></div>`;

  for(let day=1; day<=dim; day++){
    const d = new Date(view.y, view.m, day);
    const ds = ymd(d);
    const wd = d.getDay();
    const items = choresFor(d).filter(c=>!CHORES[c.id].daily);
    const minis = items.map(c=>{
      let grad;
      if(c.who==='both') grad = `linear-gradient(90deg,${S.people.A.color},${S.people.B.color})`;
      else grad = `linear-gradient(${S.people[c.who].color},${S.people[c.who].color})`;
      return `<span class="mini" style="background:${grad} left bottom no-repeat;background-size:100% 3px;">${CHORES[c.id].emoji}</span>`;
    }).join('');
    html += `<div class="cell ${ds===todayStr?'today':''}" onclick="openSheet('${ds}')">
      <div class="dn ${wd===0?'sun':wd===6?'sat':''}">${day}</div>
      <div class="minis">${minis}</div></div>`;
  }
  $('#calGrid').innerHTML = html;

  $('#calLegend').innerHTML =
    ['laundry','mop','bathroomClean','bedding','fridge']
      .map(id=>`<span class="li">${CHORES[id].emoji} ${CHORES[id][S.lang]}</span>`).join('');
}

/* ---------- 날씨 바 / 시간별 시트 ---------- */
export function renderWeather(){
  const el = $('#wxBar');
  if(!el) return;
  const win = wx24();
  if(!win){ el.innerHTML = `<span class="wxDesc">${S.lang==='ko'?'날씨 불러오는 중…':'Loading weather…'}</span>`; return; }
  const temps = win.map(x=>x.temp);
  const w = wxInfo(repWeather(win));
  const hum = win[0] && win[0].humidity!=null ? `<span class="wxHum">💦${win[0].humidity}%</span>` : '';
  el.innerHTML =
    `<span class="wxIcon">${w.emoji}</span>`
    + `<span class="wxTemp">${Math.max(...temps)}°<span class="wxMin">/ ${Math.min(...temps)}°</span></span>`
    + `<span class="wxDesc ${w.precip?'rain':''}">${w[S.lang]}</span>`
    + hum
    + `<span class="wxMore">${S.lang==='ko'?'24시간':'24h'} ›</span>`;
}
function wxDateLabel(ds){
  const d = parseYMD(ds);
  return S.lang==='ko'
    ? `${d.getMonth()+1}월 ${d.getDate()}일 (${WD_KO[d.getDay()]})`
    : `${WD_EN[d.getDay()]}, ${MON_EN[d.getMonth()]} ${d.getDate()}`;
}
export function renderWeatherSheet(){
  const title = S.lang==='ko' ? '앞으로 24시간 · 서울' : 'Next 24 hours · Seoul';
  const win = wx24();
  if(!win){ $('#sheet').innerHTML = `<h3>${title}</h3><p class="hint">${S.lang==='ko'?'날씨 정보를 불러오지 못했어요.':'Weather unavailable.'}</p>`; return; }
  const nowStr = ymd(new Date()), nowH = new Date().getHours();
  let lastDate = null, rows = '';
  for(const x of win){
    if(x.date !== lastDate){ lastDate = x.date; rows += `<div class="hDate">${wxDateLabel(x.date)}</div>`; }
    const w = wxInfo(x.code);
    const hl = S.lang==='ko' ? `${x.h}시` : `${String(x.h).padStart(2,'0')}:00`;
    const pop = (x.pop!=null && x.pop>0) ? `<span class="hPop">☔${x.pop}%</span>` : '';
    const hum = (x.humidity!=null) ? `<span class="hHum">💦${x.humidity}%</span>` : '';
    const now = (x.date===nowStr && x.h===nowH) ? 'now' : '';
    rows += `<div class="hRow ${now}">
      <span class="hH">${hl}</span><span class="hIco">${w.emoji}</span>
      <span class="hDesc">${w[S.lang]}</span>${pop}${hum}<span class="hT">${x.temp}°</span></div>`;
  }
  $('#sheet').innerHTML = `<h3>${title}</h3><div class="hourly">${rows}</div>`;
}

/* ---------- 생활비 통장 바 / 상세 시트 ---------- */
function fmtWon(n){ return (n==null ? '—' : Number(n).toLocaleString('ko-KR')) + '원'; }

export function renderAccount(){
  const el = $('#moneyCard');
  if(!el) return;
  const label = S.lang==='ko' ? '💰 남은 생활비' : '💰 Balance';
  let bal;
  if(!hasAccountUrl()) bal = `<div class="mcBal muted">${S.lang==='ko'?'설정에서 연결':'Connect in settings'}</div>`;
  else{
    const a = accountData();
    bal = (a && a.balance!=null)
      ? `<div class="mcBal">${fmtWon(a.balance)}</div>`
      : `<div class="mcBal muted">${S.lang==='ko'?'불러오는 중…':'Loading…'}</div>`;
  }
  el.innerHTML = `<div class="mcLabel">${label}<span class="mcMore">›</span></div>${bal}`;
}

export function renderAccountSheet(){
  const title = S.lang==='ko' ? '💰 생활비 통장' : '💰 Living account';
  if(!hasAccountUrl()){
    $('#sheet').innerHTML = `<h3>${title}</h3><p class="hint">${S.lang==='ko'
      ? '⚙️ 설정 → 생활비에서 구글 시트 CSV 게시 URL 을 넣으면 잔액과 내역이 보여요.'
      : 'Add your Google Sheet CSV URL in ⚙️ Settings → Living account.'}</p>`;
    return;
  }
  const a = accountData();
  const bal = a && a.balance!=null ? fmtWon(a.balance) : '—';
  const month = fmtWon(thisMonthTotal());
  const txs = recentTxs(5);
  const rows = txs.length ? txs.map(t=>{
    const md = String(t.date).slice(5).replace('-','/');   // "07-13" → "07/13"
    return `<div class="txRow"><span class="txDate">${md}</span>
      <span class="txMemo">${esc(t.memo||'')}</span>
      <span class="txAmt">${fmtWon(t.amount)}</span></div>`;
  }).join('') : `<p class="hint">${S.lang==='ko'?'내역이 아직 없어요.':'No transactions yet.'}</p>`;

  $('#sheet').innerHTML = `<h3>${title}</h3>
    <div class="acctBal">${bal}<small>${S.lang==='ko'?'남은 잔액':'balance'}</small></div>
    <div class="acctSub">${S.lang==='ko'?'이번 달 지출':'This month'} <b>${month}</b></div>
    <div class="hDate">${S.lang==='ko'?'최근 내역':'Recent'}</div>${rows}`;
}

// 바텀시트: 날씨 / 생활비 / 날짜별 집안일 목록
export function renderSheet(){
  if(view.sheetMode==='weather'){ renderWeatherSheet(); return; }
  if(view.sheetMode==='account'){ renderAccountSheet(); return; }
  if(!view.sheetDateStr) return;
  const d = parseYMD(view.sheetDateStr);
  const list = choresFor(d);
  $('#sheet').innerHTML = `<h3>${fmtDate(d)}</h3>` + list.map(c=>choreRow(c, view.sheetDateStr)).join('');
}

export function renderAll(){
  applyTheme(); applySleep(); applyShift(); renderChrome(); renderClock();
  renderToday(); renderWeather(); renderAccount(); renderCalendar(); renderSheet();
}

/* ====================================================================
   설정 다이얼로그 — 쉬운 말 + 실제 날짜/이름, 변경 즉시 저장·적용
==================================================================== */

function getPath(o, p){ return p.split('.').reduce((x,k)=>x[k], o); }
function setPath(o, p, v){
  const ks = p.split('.'); let x = o;
  for(let i=0; i<ks.length-1; i++) x = x[ks[i]];
  x[ks[ks.length-1]] = v;
}

// 사용자가 "다음 차례 = OO" 를 탭하면 → 그 날짜가 OO 가 되도록 내부 first-owner 를 역산
function flipDerived(kind){
  if(kind==='mop'){
    const wi = weekIndex(nextWeekdayDate(S.mop.day));
    const nw = otherOf(pick(S.mop.first, wi));
    S.mop.first = mod(wi,2)===0 ? nw : otherOf(nw);
  }else if(kind==='bath'){
    const cfg = S.bathroomClean;
    const occ = Math.floor((weekIndex(nextBiweekly(cfg)) - cfg.startWeek)/2);
    const nw = otherOf(pick(cfg.first, occ));
    cfg.first = mod(occ,2)===0 ? nw : otherOf(nw);
  }else{
    const cfg = S.fridge;
    const mi = monthIndex(nextMonthly(cfg));
    const nw = otherOf(pick(cfg.first, mi));
    cfg.first = mod(mi,2)===0 ? nw : otherOf(nw);
  }
}

/* ---------- 폼 위젯 빌더 ---------- */
function pBtn(who, attrs){
  const p = S.people[who];
  return `<button class="chip tap" ${attrs}
    style="background:${p.color}1e;color:${p.color};border-color:${p.color}66">${esc(p.name)}</button>`;
}
function segBtns(k, opts, cur, extra){
  return `<span class="seg">` + opts.map(o=>
    `<button data-act="seg" data-k="${k}" data-v="${o.v}" ${extra||''}
      class="${String(o.v)===String(cur)?'on':''}">${o.label}</button>`).join('') + `</span>`;
}
function dSelFull(key, val){
  const wds = S.lang==='ko' ? WD_KO.map(w=>w+'요일') : WD_EN_FULL;
  return `<select data-sel="${key}">` +
    wds.map((w,i)=>`<option value="${i}" ${i===val?'selected':''}>${w}</option>`).join('') + `</select>`;
}
function nSelM(key, val){
  return `<select data-sel="${key}">` +
    NTH[S.lang].map((n,i)=>`<option value="${i+1}" ${i+1===val?'selected':''}>${n}</option>`).join('') + `</select>`;
}
function hSel(key, val){
  let opts = '';
  for(let h=0; h<24; h++){
    const label = S.lang==='ko' ? h+'시' : String(h).padStart(2,'0')+':00';
    opts += `<option value="${h}" ${h===val?'selected':''}>${label}</option>`;
  }
  return `<select data-sel="${key}">${opts}</select>`;
}

function renderSettingsBody(){
  const mopNext = nextWeekdayDate(S.mop.day);
  const mopWho = S.mop.mode==='fixed' ? S.mop.first : pick(S.mop.first, weekIndex(mopNext));
  const bath = S.bathroomClean;
  const bathNext = nextBiweekly(bath);
  const bathWho = pick(bath.first, Math.floor((weekIndex(bathNext) - bath.startWeek)/2));
  const bathC1 = nextWeekdayDate(bath.day), bathC2 = addDays(bathC1, 7);
  const bedC1 = nextWeekdayDate(S.bedding.day), bedC2 = addDays(bedC1, 7);
  const frNext = nextMonthly(S.fridge), frWho = pick(S.fridge.first, monthIndex(frNext));
  const wdsShort = S.lang==='ko' ? WD_KO : WD_EN;

  $('#dlg').innerHTML = `<div class="dlgIn">
    <h2>⚙️ ${t('settings')}</h2>
    <p class="subNote">${t('instantNote')} · ${t('tapNote')}</p>

    <div class="secCard">
      <div class="sec">${t('people')}</div>
      <div class="frow"><input type="text" data-inp="people.A.name" value="${esc(S.people.A.name)}">
        <input type="color" data-inp="people.A.color" value="${S.people.A.color}"></div>
      <div class="frow"><input type="text" data-inp="people.B.name" value="${esc(S.people.B.name)}">
        <input type="color" data-inp="people.B.color" value="${S.people.B.color}"></div>
    </div>

    <div class="secCard">
      <div class="sec">${t('dailyFixed')}</div>
      <div class="frow"><label>🗑️ ${CHORES.trashBathroom[S.lang]}</label>
        ${pBtn(S.daily.trashBathroom, `data-act="flip" data-path="daily.trashBathroom"`)}</div>
      <div class="frow"><label>♻️ ${CHORES.trashRecycle[S.lang]}</label>
        ${pBtn(S.daily.trashRecycle, `data-act="flip" data-path="daily.trashRecycle"`)}</div>
      <div class="frow"><label>🧹 ${CHORES.vacuum[S.lang]}</label>
        ${pBtn(S.daily.vacuum, `data-act="flip" data-path="daily.vacuum"`)}</div>
      <div class="frow"><label>🛌 ${CHORES.makeBed[S.lang]}</label>
        ${segBtns('daily.makeBed', [{v:'both',label:t('together')},{v:'A',label:esc(S.people.A.name)},{v:'B',label:esc(S.people.B.name)}], S.daily.makeBed)}</div>
    </div>

    <div class="secCard">
      <div class="sec">🧺 ${t('laundryS')}</div>
      <div class="frow"><label>${t('washDays')}</label>
        <span style="display:flex;gap:4px;flex-wrap:wrap;">${wdsShort.map((w,i)=>
          `<button class="dayb ${S.laundry.days.includes(i)?'on':''}" data-act="ld" data-v="${i}">${w}</button>`).join('')}</span></div>
      <div class="frow"><label>${t('owner')}</label>
        ${pBtn(S.laundry.owner, `data-act="flip" data-path="laundry.owner"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">🧽 ${t('mopS')}</div>
      <div class="frow"><label>${t('day')}</label>${dSelFull('mop.day', S.mop.day)}
        ${segBtns('mop.mode', [{v:'rotate',label:t('rotate')},{v:'fixed',label:t('fixed')}], S.mop.mode)}</div>
      <div class="frow"><label>${S.mop.mode==='fixed' ? t('owner') : t('nextTurn')+' · '+fmtShort(mopNext)}</label>
        ${S.mop.mode==='fixed'
          ? pBtn(S.mop.first, `data-act="flip" data-path="mop.first"`)
          : pBtn(mopWho, `data-act="flipd" data-kind="mop"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">🚽 ${t('bathS')}</div>
      <div class="frow"><label>${t('day')}</label>${dSelFull('bathroomClean.day', bath.day)}</div>
      <div class="frow"><label>${t('nextTurn')}</label>
        ${segBtns('bathroomClean.startWeek',
          [{v:mod(weekIndex(bathC1),2), label:fmtShort(bathC1)},
           {v:mod(weekIndex(bathC2),2), label:fmtShort(bathC2)}],
          bath.startWeek, 'data-num="1"')}</div>
      <div class="frow"><label>${t('owner')} · ${fmtShort(bathNext)}</label>
        ${pBtn(bathWho, `data-act="flipd" data-kind="bath"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">🛏️ ${t('bedS')}</div>
      <div class="frow"><label>${t('day')}</label>${dSelFull('bedding.day', S.bedding.day)}</div>
      <div class="frow"><label>${t('nextTurn')}</label>
        ${segBtns('bedding.startWeek',
          [{v:mod(weekIndex(bedC1),2), label:fmtShort(bedC1)},
           {v:mod(weekIndex(bedC2),2), label:fmtShort(bedC2)}],
          S.bedding.startWeek, 'data-num="1"')}</div>
    </div>

    <div class="secCard">
      <div class="sec">🧊 ${t('fridgeS')}</div>
      <div class="frow"><label>${t('monthPrefix')}</label>
        ${nSelM('fridge.nth', S.fridge.nth)} ${dSelFull('fridge.day', S.fridge.day)}</div>
      <div class="frow"><label>${t('nextTurn')} · ${fmtShort(frNext)}</label>
        ${pBtn(frWho, `data-act="flipd" data-kind="fridge"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">💰 ${S.lang==='ko'?'생활비':'Living account'}</div>
      <div class="frow" style="flex-direction:column;align-items:stretch;gap:5px;">
        <label style="min-width:0">${S.lang==='ko'?'구글 시트 CSV 게시 URL':'Google Sheet CSV URL'}</label>
        <input type="url" data-inp="account.url" value="${esc(S.account.url)}"
          placeholder="https://docs.google.com/.../pub?output=csv" style="width:100%">
      </div>
      <p class="help">${S.lang==='ko'
        ? '시트 → 파일 → 공유 → 웹에 게시 → CSV 선택 → URL 붙여넣기. URL 은 이 기기에만 저장돼요.'
        : 'Sheet → File → Share → Publish to web → CSV. Stored on this device only.'}</p>
    </div>

    <div class="secCard">
      <div class="sec">${t('display')}</div>
      <div class="frow"><label>${t('themeS')}</label>
        ${segBtns('theme',
          [{v:'auto',label:t('thAuto')},{v:'light',label:t('thLight')},{v:'dark',label:t('thDark')}],
          S.theme)}</div>
      <div class="frow"><label>${t('darkHours')}</label>
        ${hSel('darkStart', S.darkStart)} ~ ${hSel('darkEnd', S.darkEnd)}</div>
      <p class="help">${t('thAutoHelp')}</p>
      <div class="frow"><label>${t('sleepS')}</label>
        ${segBtns('sleep.on', [{v:1,label:t('onL')},{v:0,label:t('offL')}], S.sleep.on?1:0, 'data-bool="1"')}
        ${hSel('sleep.start', S.sleep.start)} ~ ${hSel('sleep.end', S.sleep.end)}</div>
      <p class="help">${t('sleepHelp')}</p>
    </div>

    <div class="dlgBtns">
      <button class="primary" data-act="close">${t('close')}</button>
    </div>
    <button class="resetLink" data-act="reset">${t('reset')}</button>
  </div>`;
}

function commitSettings(){ saveSettings(); renderAll(); renderSettingsBody(); }
function openSettings(){ renderSettingsBody(); $('#dlg').showModal(); }

// 설정 버튼 + 다이얼로그 이벤트 배선 (main 에서 1회 호출)
export function initSettings(){
  $('#btnSet').onclick = openSettings;

  $('#dlg').addEventListener('click', e=>{
    if(e.target === e.currentTarget){ $('#dlg').close(); return; }  // 바깥(백드롭) 클릭 → 닫기 (변경은 이미 저장됨)
    const b = e.target.closest('[data-act]');
    if(!b) return;
    const act = b.dataset.act;
    if(act==='close'){ $('#dlg').close(); return; }
    if(act==='reset'){
      if(confirm(t('resetQ'))){
        resetSettings();
        commitSettings();
      }
      return;
    }
    if(act==='flip'){ setPath(S, b.dataset.path, otherOf(getPath(S, b.dataset.path))); commitSettings(); }
    else if(act==='flipd'){ flipDerived(b.dataset.kind); commitSettings(); }
    else if(act==='seg'){
      let v = b.dataset.v;
      if(b.dataset.num) v = Number(v);
      if(b.dataset.bool) v = v==='1';
      setPath(S, b.dataset.k, v);
      commitSettings();
    }
    else if(act==='ld'){
      const v = Number(b.dataset.v);
      if(S.laundry.days.includes(v)){
        if(S.laundry.days.length > 1) S.laundry.days = S.laundry.days.filter(x=>x!==v);
      }else{
        S.laundry.days.push(v);
        S.laundry.days.sort((a,b2)=>a-b2);
      }
      commitSettings();
    }
  });

  $('#dlg').addEventListener('change', e=>{
    const el = e.target;
    if(el.dataset && el.dataset.sel){ setPath(S, el.dataset.sel, Number(el.value)); commitSettings(); }
    else if(el.dataset && el.dataset.inp){
      let v = el.value;
      if(el.dataset.inp.endsWith('.name')) v = v.trim() || '?';
      setPath(S, el.dataset.inp, v);
      commitSettings();
    }
  });
}
