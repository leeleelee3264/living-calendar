// 뷰 계층: 화면 렌더링 + 설정 다이얼로그. 상태를 읽어 DOM 을 그린다.
// (이벤트 배선·상호작용은 main.js)
import { CHORES, NTH, WD, WD_FULL, MON_SHORT, MON_FULL } from './data.js';
import { S, DONE, saveSettings, resetSettings } from './storage.js';
import {
  ymd, parseYMD, fmtDate, fmtShort, inHourRange,
  pick, weekIndex, monthIndex, mod, otherOf,
  addDays, nextWeekdayDate, nextBiweekly, nextMonthly, choresFor,
} from './core.js';
import { wx24, wxWeek, wxInfo, repWeather } from './weather.js';
import { accountData, balance, thisMonthTotal, monthTxs, earlierTxs } from './livingAccount.js';
import { putSettings } from './supabase.js';

export const $ = s => document.querySelector(s);
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}

/* ====================================================================
   아이콘 (Material Symbols Rounded — ligature 이름으로 렌더)
   내부 이름 → Material Symbols ligature 매핑. 호출부는 기존 이름 그대로 사용.
==================================================================== */
const ICON_LIG = {
  // 집안일
  trash:'delete', recycle:'recycling', broom:'cleaning_services', bed:'bed',
  basket:'local_laundry_service', droplets:'mop', toilet:'wc', fridge:'kitchen',
  // UI
  coins:'savings', gear:'settings', expand:'fullscreen', sun:'sunny',
  // 날씨
  cloudSun:'partly_cloudy_day', cloud:'cloud', fog:'foggy', rain:'rainy',
  snow:'weather_snowy', storm:'thunderstorm', umbrella:'umbrella', drop:'humidity_percentage',
};
export function svgIcon(name, size=20, sw=1.7){
  const lig = ICON_LIG[name] || name;
  return `<span class="msym" style="font-size:${size}px">${lig}</span>`;
}
const CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0c0d10" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 20 6.5"/></svg>`;

// WMO 날씨 코드 → 아이콘 + 색
function wxIconFor(code){
  if(code>=95) return {name:'storm', color:'#cbb0e6'};
  if((code>=71&&code<=77)||code===85||code===86) return {name:'snow', color:'#aec6e6'};
  if((code>=51&&code<=67)||(code>=80&&code<=82)) return {name:'rain', color:'#7ea6d6'};
  if(code===45||code===48) return {name:'fog', color:'#98a0aa'};
  if(code===3) return {name:'cloud', color:'#98a0aa'};
  if(code===1||code===2) return {name:'cloudSun', color:'#c4bda5'};
  return {name:'sun', color:'#e3c089'};
}

// 달력 이동 · 바텀시트 상태. 라이브 바인딩 대신 객체로 노출해 main 에서 프로퍼티를 갱신한다.
const now0 = new Date();
export const view = {
  y: now0.getFullYear(),
  m: now0.getMonth(),
  sheetDateStr: null,
  sheetMode: null,
  curDate: ymd(new Date()),
  // 생활비 입력 폼 상태 (열림 여부 · 지출/입금 · 날짜 · 입력 중인 값)
  acctForm: { open:false, type:'out', amount:'', memo:'', date: ymd(new Date()) },
};
export function resetAcctForm(){ view.acctForm = { open:false, type:'out', amount:'', memo:'', date: ymd(new Date()) }; }

/* ====================================================================
   렌더링
==================================================================== */

// 설정된 포인트 색을 CSS 변수로 반영 (--acSoft 는 색상혼합 미지원 브라우저 대비 JS 에서 계산)
export function applyAccent(){
  const r = document.documentElement.style;
  r.setProperty('--ac', S.accent);
  r.setProperty('--acSoft', S.accent + '21');
}

// 테마 적용: 'light'/'dark' 는 강제, 'auto' 는 시간대 기반(낮 라이트 / 저녁·밤 다크).
// 심야 검정 오버레이(applySleep)는 이와 별개로 얹힌다 → 저녁=다크, 새벽=검정 (C안).
const DARK_FROM = 18, LIGHT_FROM = 6;   // auto: 18시부터 다크, 6시부터 라이트
export function applyTheme(){
  const el = document.documentElement;
  const t = S.theme || 'auto';
  let eff = t;
  if(t === 'auto'){
    const h = new Date().getHours();
    eff = (h >= DARK_FROM || h < LIGHT_FROM) ? 'dark' : 'light';
  }
  el.setAttribute('data-theme', eff);
}

// 오늘 체크리스트 / 바텀시트의 한 줄 — 줄 탭 = 완료, 이름표 탭 = 담당 교체
function choreRow(c, ds){
  const done = !!DONE[ds+'|'+c.id];
  const ch = CHORES[c.id];
  const swapped = c.who !== c.base;
  const chip = c.who==='both'
    ? `<span class="chip"><span class="dot" style="background:var(--ac)"></span><span class="nm">Both</span></span>`
    : (()=>{ const p = S.people[c.who];
        return `<button class="chip tap" onclick="swapWho(event,'${ds}','${c.id}')">
          <span class="dot" style="background:${p.color}"></span>
          <span class="nm">${swapped?'↔ ':''}${esc(p.name)}</span></button>`; })();
  const freq = ch.daily ? '' : `<small>${ch.freq}</small>`;   // "매일" 은 노이즈라 생략
  return `<div class="chore ${done?'done':''}" onclick="toggleDone('${ds}','${c.id}')">
    <span class="cbox">${done?CHECK:''}</span>
    <span class="cicon">${svgIcon(ch.icon, 20)}</span>
    <span class="cname"><span class="ttl">${ch.name}</span>${freq}</span>
    ${chip}
  </div>`;
}

export function renderClock(){
  const n = new Date();
  $('#clkTime').textContent = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  $('#clkDate').textContent = `${WD_FULL[n.getDay()]}, ${MON_SHORT[n.getMonth()]} ${n.getDate()}`;
}

/* ---------- 상시 노출 대응: 심야 화면끄기 · 픽셀 시프트 ---------- */
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
  const total = list.length;
  const C = 2*Math.PI*25;
  const off = (C*(1-(total ? doneN/total : 0))).toFixed(1);
  $('#todayCard').innerHTML =
    `<div class="cardHead">
      <div>
        <h2>Today</h2>
        <div class="subline">${doneN===total ? 'All done for today!' : `${doneN} / ${total} done`}</div>
      </div>
      <div class="ring">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="none" stroke="var(--track)" stroke-width="5"/>
          <circle cx="30" cy="30" r="25" fill="none" stroke="var(--ac)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"
            transform="rotate(-90 30 30)"/>
        </svg>
        <div class="rTxt">${doneN}/${total}</div>
      </div>
    </div>`
    + list.map(c=>choreRow(c, ds)).join('')
    + `<div class="hint">Tap a row to check it off · tap a name to swap for that day · checks are saved on this device only</div>`;
}

export function renderCalendar(){
  $('#calTitle').textContent = `${MON_FULL[view.m]} ${view.y}`;
  const firstWd = new Date(view.y, view.m, 1).getDay();
  const dim = new Date(view.y, view.m+1, 0).getDate();
  const cells = Math.ceil((firstWd+dim)/7)*7;
  const todayStr = ymd(new Date());
  let html = '';

  for(let i=0; i<cells; i++){
    const day = i-firstWd+1;
    if(day<1 || day>dim){ html += `<div class="cell empty"></div>`; continue; }
    const d = new Date(view.y, view.m, day);
    const ds = ymd(d);
    const wd = d.getDay();
    const items = choresFor(d).filter(c=>!CHORES[c.id].daily);
    const MAXMINI = 4;                       // 넘치면 마지막을 +N 으로 (셀 높이 넘침 방지)
    const shown = items.length > MAXMINI ? items.slice(0, MAXMINI-1) : items;
    let minis = shown.map(c=>{
      const col = c.who==='both' ? S.accent : S.people[c.who].color;
      return `<span class="mini" style="color:${col};background:${col}2e">${CHORES[c.id].short}</span>`;
    }).join('');
    if(items.length > MAXMINI) minis += `<span class="mini more">+${items.length-(MAXMINI-1)}</span>`;
    const dense = items.length >= 3 ? ' dense' : '';   // 3개↑ → 한 줄에 2개
    html += `<div class="cell ${ds===todayStr?'today':''}" onclick="openSheet('${ds}')">
      <div class="dn ${wd===0?'sun':wd===6?'sat':''}">${day}</div>
      <div class="minis${dense}">${minis}</div></div>`;
  }
  $('#calGrid').innerHTML = html;

  $('#calLegend').innerHTML =
    `<span class="li"><span class="dot" style="background:${S.people.A.color}"></span>${esc(S.people.A.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.people.B.color}"></span>${esc(S.people.B.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.accent}"></span>Both</span>`
    + `<span class="note">Daily chores hidden · tap a date for the full list</span>`;
}

/* ---------- 날씨 바 / 시간별 시트 ---------- */
export function renderWeather(){
  const el = $('#wxBar');
  if(!el) return;
  const win = wx24();
  if(!win){ el.innerHTML = `<span class="wxDesc">Loading weather…</span>`; return; }
  const temps = win.map(x=>x.temp);
  const code = repWeather(win);
  const w = wxInfo(code);
  const ic = wxIconFor(code);
  const hum = win[0] && win[0].humidity!=null
    ? `<span class="wxHum">Humidity ${win[0].humidity}%</span>` : `<span class="wxHum"></span>`;
  el.innerHTML =
    `<span class="wxIcon" style="color:${ic.color}">${svgIcon(ic.name, 26, 1.6)}</span>`
    + `<span class="wxTemp">${Math.max(...temps)}°<span class="wxMin">/ ${Math.min(...temps)}°</span></span>`
    + `<span class="wxDesc ${w.precip?'rain':''}">${w.en}</span>`
    + hum
    + `<span class="wxMore">›</span>`;
}
export function renderWeatherSheet(){
  const title = 'Seoul';
  const win = wx24();
  if(!win){ $('#sheet').innerHTML = `<h3>${title}</h3><p class="hint">Couldn't load weather.</p>`; return; }
  const nowStr = ymd(new Date()), nowH = new Date().getHours();

  // ① 시간별 — 가로 스크롤 스트립 (지금 → 앞으로 24시간)
  const cells = win.map((x,i)=>{
    const ic = wxIconFor(x.code);
    const isNow = (x.date===nowStr && x.h===nowH);
    const label = i===0 ? 'Now' : String(x.h).padStart(2,'0');
    const pop = (x.pop!=null && x.pop>0) ? `${x.pop}%` : '';
    return `<div class="hCell ${isNow?'now':''}">
      <span class="hcH">${label}</span>
      <span class="hcIco" style="color:${ic.color}">${svgIcon(ic.name,22,1.7)}</span>
      <span class="hcPop">${pop}</span>
      <span class="hcT">${x.temp}°</span></div>`;
  }).join('');

  // ② 주간 — 요일 · 아이콘 · 강수% · 최저—막대—최고
  const week = wxWeek();
  let weekHTML = '';
  if(week && week.length){
    const lo = Math.min(...week.map(d=>d.tmin));
    const hi = Math.max(...week.map(d=>d.tmax));
    const span = Math.max(1, hi-lo);
    weekHTML = week.map((d,i)=>{
      const ic = wxIconFor(d.code);
      const name = i===0 ? 'Today' : WD[parseYMD(d.date).getDay()];
      const pop = (d.pop!=null && d.pop>0) ? `${d.pop}%` : '';
      const left = ((d.tmin-lo)/span*100).toFixed(1);
      const width = Math.max(6, (d.tmax-d.tmin)/span*100).toFixed(1);
      return `<div class="wkRow">
        <span class="wkDay">${name}</span>
        <span class="wkIco" style="color:${ic.color}">${svgIcon(ic.name,20,1.7)}</span>
        <span class="wkPop">${pop}</span>
        <span class="wkLo">${d.tmin}°</span>
        <span class="wkBar"><span class="wkFill" style="left:${left}%;width:${width}%"></span></span>
        <span class="wkHi">${d.tmax}°</span></div>`;
    }).join('');
  }
  const weekBlock = weekHTML
    ? `<div class="hDate">7-day forecast</div><div class="wkList">${weekHTML}</div>` : '';

  $('#sheet').innerHTML = `<h3>${title}</h3>
    <div class="hStrip">${cells}</div>
    ${weekBlock}`;
}

/* ---------- 생활비 카드 / 상세 시트 ---------- */
function fmtWon(n){ return n==null ? '—' : '₩' + Number(n).toLocaleString('en-US'); }

export function renderAccount(){
  const el = $('#moneyCard');
  if(!el) return;
  const head = `<div class="mcHead"><span class="ic">${svgIcon('coins',22)}</span>
    <span class="t">Living expenses</span><span class="more">›</span></div>`;
  const body = `<div class="mcRow">
      <div><div class="mcLbl">Remaining</div><div class="mcBal">${fmtWon(balance())}</div></div>
      <div class="mcSpent"><div class="mcLbl">This month</div><div class="v">${fmtWon(thisMonthTotal())}</div></div>
    </div>`;
  el.innerHTML = head + body;
}

// 입력 폼(열렸을 때) — 금액 · 메모 · 지출/입금 토글 · 담당
function acctFormHTML(){
  const f = view.acctForm;
  if(!f.open) return `<button class="acctAddBtn" data-act="acctOpen">+ Add entry</button>`;
  const typeSeg = `<span class="seg">`
    + `<button data-act="acctType" data-v="out" class="${f.type==='out'?'on':''}">Spent</button>`
    + `<button data-act="acctType" data-v="in" class="${f.type==='in'?'on':''}">Added</button>`
    + `</span>`;
  return `<div class="acctForm">
    <div class="afTop">${typeSeg}</div>
    <div class="afRow"><span class="afWon">₩</span>
      <input class="afAmt" inputmode="numeric" placeholder="0" value="${esc(f.amount)}"
        oninput="acctFormInput('amount', this.value)"></div>
    <input class="afMemo" type="text" placeholder="Note (e.g. groceries)" value="${esc(f.memo)}"
      oninput="acctFormInput('memo', this.value)">
    <label class="afDate"><span>Date</span>
      <input type="date" value="${esc(f.date)}" oninput="acctFormInput('date', this.value)"></label>
    <div class="afBtns">
      <button class="afCancel" data-act="acctClose">Close</button>
      <button class="afAdd" data-act="acctSubmit">Add</button>
    </div>
  </div>`;
}

function txRowHTML(t){
  const md = String(t.date).slice(5).replace('-','/');   // "07-13" → "07/13"
  const isIn = t.type==='in';
  const memo = t.memo || (isIn ? 'Added' : 'Expense');
  return `<div class="txRow">
    <span class="txDate">${md}</span>
    <span class="txMemo">${esc(memo)}</span>
    <span class="txAmt ${isIn?'in':''}">${isIn?'+':'−'}${fmtWon(t.amount)}</span>
    <button class="txDel" data-act="acctDel" data-id="${t.id}" aria-label="Delete">×</button>
  </div>`;
}

export function renderAccountSheet(){
  const title = 'Living expenses';
  const bal = fmtWon(balance());
  const month = fmtWon(thisMonthTotal());
  const mtx = monthTxs(), etx = earlierTxs();   // 이번 달 전부 + 이전 달
  const monthRows = mtx.length
    ? mtx.map(txRowHTML).join('')
    : `<p class="hint">No entries this month yet. Tap “Add entry” to log one.</p>`;
  const earlierBlock = etx.length ? `<div class="hDate">Earlier</div>${etx.map(txRowHTML).join('')}` : '';

  $('#sheet').innerHTML = `<h3>${title}</h3>
    <div class="acctBal">${bal}<small>Remaining</small></div>
    <div class="acctSub">This month <b>${month}</b> · ${mtx.length} ${mtx.length===1?'entry':'entries'}</div>
    ${acctFormHTML()}
    <div class="hDate">This month</div>${monthRows}${earlierBlock}`;
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
  applyAccent(); applyTheme(); applySleep(); applyShift(); renderClock();
  renderToday(); renderWeather(); renderAccount(); renderCalendar(); renderSheet();
}

/* ====================================================================
   설정 다이얼로그 — 쉬운 말 + 실제 날짜/이름, 변경 즉시 저장·적용
==================================================================== */

const ACCENTS = ['#7ec8a3', '#e6a95c', '#6ea8ff', '#c9a2e0'];

/* ---------- 전체화면 (iOS Safari 는 webkit 접두사 필요) ---------- */
function fsElement(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
function enterFull(el){
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if(fn){ try{ const p = fn.call(el); if(p && p.catch) p.catch(()=>{}); }catch(e){} }
}
function exitFull(){
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if(fn){ try{ fn.call(document); }catch(e){} }
}

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
    style="background:${p.color}1e;border-color:${p.color}66">
    <span class="dot" style="background:${p.color}"></span>
    <span class="nm" style="color:${p.color}">${esc(p.name)}</span></button>`;
}
function segBtns(k, opts, cur, extra){
  return `<span class="seg">` + opts.map(o=>
    `<button data-act="seg" data-k="${k}" data-v="${o.v}" ${extra||''}
      class="${String(o.v)===String(cur)?'on':''}">${o.label}</button>`).join('') + `</span>`;
}
function dSelFull(key, val){
  return `<select data-sel="${key}">` +
    WD_FULL.map((w,i)=>`<option value="${i}" ${i===val?'selected':''}>${w}</option>`).join('') + `</select>`;
}
function nSelM(key, val){
  return `<select data-sel="${key}">` +
    NTH.map((n,i)=>`<option value="${i+1}" ${i+1===val?'selected':''}>${n}</option>`).join('') + `</select>`;
}
function hSel(key, val){
  let opts = '';
  for(let h=0; h<24; h++) opts += `<option value="${h}" ${h===val?'selected':''}>${String(h).padStart(2,'0')}:00</option>`;
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
  const isFull = !!fsElement();

  $('#dlg').innerHTML = `<div class="dlgIn">
    <h2>${svgIcon('gear',19)} Settings</h2>
    <p class="subNote">Changes apply instantly · tap a name to change who does it</p>

    <div class="secCard">
      <div class="sec">Daily</div>
      <div class="frow"><label>${svgIcon('trash',16)}${CHORES.trashBathroom.name}</label>
        ${pBtn(S.daily.trashBathroom, `data-act="flip" data-path="daily.trashBathroom"`)}</div>
      <div class="frow"><label>${svgIcon('recycle',16)}${CHORES.trashRecycle.name}</label>
        ${pBtn(S.daily.trashRecycle, `data-act="flip" data-path="daily.trashRecycle"`)}</div>
      <div class="frow"><label>${svgIcon('broom',16)}${CHORES.vacuum.name}</label>
        ${pBtn(S.daily.vacuum, `data-act="flip" data-path="daily.vacuum"`)}</div>
      <div class="frow"><label>${svgIcon('bed',16)}${CHORES.makeBed.name}</label>
        ${segBtns('daily.makeBed', [{v:'both',label:'Both'},{v:'A',label:esc(S.people.A.name)},{v:'B',label:esc(S.people.B.name)}], S.daily.makeBed)}</div>
    </div>

    <div class="secCard">
      <div class="sec">Laundry (3×/week)</div>
      <div class="frow"><label>${svgIcon('basket',16)}Days</label>
        <span style="display:flex;gap:4px;flex-wrap:wrap;">${WD.map((w,i)=>
          `<button class="dayb ${S.laundry.days.includes(i)?'on':''}" data-act="ld" data-v="${i}">${w}</button>`).join('')}</span></div>
      <div class="frow"><label>Who</label>
        ${pBtn(S.laundry.owner, `data-act="flip" data-path="laundry.owner"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">Mopping (weekly)</div>
      <div class="frow"><label>${svgIcon('droplets',16)}Day</label>${dSelFull('mop.day', S.mop.day)}
        ${segBtns('mop.mode', [{v:'rotate',label:'Alternate'},{v:'fixed',label:'Fixed'}], S.mop.mode)}</div>
      <div class="frow"><label>${S.mop.mode==='fixed' ? 'Who' : 'Next · '+fmtShort(mopNext)}</label>
        ${S.mop.mode==='fixed'
          ? pBtn(S.mop.first, `data-act="flip" data-path="mop.first"`)
          : pBtn(mopWho, `data-act="flipd" data-kind="mop"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">Bathroom (biweekly)</div>
      <div class="frow"><label>${svgIcon('toilet',16)}Day</label>${dSelFull('bathroomClean.day', bath.day)}</div>
      <div class="frow"><label>Next</label>
        ${segBtns('bathroomClean.startWeek',
          [{v:mod(weekIndex(bathC1),2), label:fmtShort(bathC1)},
           {v:mod(weekIndex(bathC2),2), label:fmtShort(bathC2)}],
          bath.startWeek, 'data-num="1"')}</div>
      <div class="frow"><label>Who · ${fmtShort(bathNext)}</label>
        ${pBtn(bathWho, `data-act="flipd" data-kind="bath"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">Bedding (biweekly · both)</div>
      <div class="frow"><label>${svgIcon('bed',16)}Day</label>${dSelFull('bedding.day', S.bedding.day)}</div>
      <div class="frow"><label>Next</label>
        ${segBtns('bedding.startWeek',
          [{v:mod(weekIndex(bedC1),2), label:fmtShort(bedC1)},
           {v:mod(weekIndex(bedC2),2), label:fmtShort(bedC2)}],
          S.bedding.startWeek, 'data-num="1"')}</div>
    </div>

    <div class="secCard">
      <div class="sec">Fridge (monthly)</div>
      <div class="frow"><label>${svgIcon('fridge',16)}Every</label>
        ${nSelM('fridge.nth', S.fridge.nth)} ${dSelFull('fridge.day', S.fridge.day)}</div>
      <div class="frow"><label>Next · ${fmtShort(frNext)}</label>
        ${pBtn(frWho, `data-act="flipd" data-kind="fridge"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">Display</div>
      <div class="frow"><label>${svgIcon('sun',16)}Theme</label>
        ${segBtns('theme', [{v:'auto',label:'Auto'},{v:'light',label:'Light'},{v:'dark',label:'Dark'}], S.theme)}</div>
      <p class="help">Auto follows the time of day — light by day, dark from 6 PM.</p>
      <div class="frow"><label>${svgIcon('expand',16)}Fullscreen</label>
        <button class="fullBtn" data-act="full">${isFull?'Off':'On'}</button></div>
      <div class="frow"><label>Accent</label>
        <span class="swatches">${ACCENTS.map(c=>
          `<button class="sw ${S.accent===c?'on':''}" data-act="accent" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</span></div>
      <div class="frow"><label>Night off</label>
        ${segBtns('sleep.on', [{v:1,label:'On'},{v:0,label:'Off'}], S.sleep.on?1:0, 'data-bool="1"')}
        ${hSel('sleep.start', S.sleep.start)} ~ ${hSel('sleep.end', S.sleep.end)}</div>
      <p class="help">At night the screen goes black with just a faint clock. Tap to show it for 1 minute. (burn-in protection)</p>
    </div>

    <div class="dlgBtns">
      <button class="primary" data-act="close">Close</button>
    </div>
    <button class="resetLink" data-act="reset">Reset settings</button>
  </div>`;
}

// 설정을 클라우드(settings 싱글톤)에 밀어넣는다. base 는 account.base 로 함께 실어 보낸다.
function pushSettingsCloud(){
  const data = JSON.parse(JSON.stringify(S));
  data.account = { base: accountData().base || 0 };
  putSettings(data).catch(()=>{});   // 실패해도 로컬은 유지
}
function commitSettings(){ saveSettings(); pushSettingsCloud(); renderAll(); renderSettingsBody(); }
function openSettings(){ renderSettingsBody(); $('#dlg').showModal(); }

// 설정 버튼 + 다이얼로그 이벤트 배선 (main 에서 1회 호출)
export function initSettings(){
  $('#btnSet').onclick = openSettings;

  // 전체화면 상태가 바뀌면 (설정 버튼 또는 ESC) 버튼 라벨 갱신
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
    document.addEventListener(ev, ()=>{ if($('#dlg').open) renderSettingsBody(); }));

  $('#dlg').addEventListener('click', e=>{
    if(e.target === e.currentTarget){ $('#dlg').close(); return; }  // 바깥(백드롭) 클릭 → 닫기 (변경은 이미 저장됨)
    const b = e.target.closest('[data-act]');
    if(!b) return;
    const act = b.dataset.act;
    if(act==='close'){ $('#dlg').close(); return; }
    if(act==='full'){
      const goFull = !fsElement();
      // 모달 다이얼로그를 top layer 에서 먼저 내린다: iOS Safari 는 모달이 열린 채 전체화면에
      // 진입하면 진입 후 페이지 나머지가 inert 로 남아 ⚙️ 버튼이 안 눌리는 버그가 있음
      $('#dlg').close();
      if(goFull) enterFull(document.documentElement);
      else exitFull();
      return;
    }
    if(act==='reset'){
      if(confirm('Reset all settings to defaults?')){
        resetSettings();
        commitSettings();
      }
      return;
    }
    if(act==='accent'){ S.accent = b.dataset.v; commitSettings(); }
    else if(act==='flip'){ setPath(S, b.dataset.path, otherOf(getPath(S, b.dataset.path))); commitSettings(); }
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
  });
}
