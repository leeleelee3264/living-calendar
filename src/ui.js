// 뷰 계층: 화면 렌더링 + 설정 다이얼로그. 상태를 읽어 DOM 을 그린다.
// (이벤트 배선·상호작용은 main.js)
import { FREQS, ACCENTS, START, WD, WD_FULL, MON_SHORT, MON_FULL } from './data.js';
import { S, DONE, saveSettings, resetSettings, fillFreq } from './storage.js';
import {
  ymd, parseYMD, fmtDate, inHourRange,
  choresFor, eventsFor, choreDef, freqLabel, shortOf,
  allDone, currentStreak,
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
  dishes:'dishwasher_gen', cart:'shopping_cart', plant:'potted_plant', pets:'pets',
  iron:'iron', window:'window', tools:'handyman', soap:'soap',
  close:'close',
  // UI
  coins:'savings', gear:'settings', expand:'fullscreen', sun:'sunny', party:'celebration',
  // 날씨
  cloudSun:'partly_cloudy_day', cloud:'cloud', fog:'foggy', rain:'rainy',
  snow:'weather_snowy', storm:'thunderstorm', umbrella:'umbrella', drop:'humidity_percentage',
};
export function svgIcon(name, size=20, sw=1.7){
  const lig = ICON_LIG[name] || name;
  return `<span class="msym" style="font-size:${size}px">${lig}</span>`;
}
const CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0c0d10" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 20 6.5"/></svg>`;
// 축하 표시 — 다 한 날은 이모지로. (Material Symbols 는 단색이라 축하 느낌이 안 남)
const PARTY = '🎉';

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
  const ch = choreDef(c.id);
  if(!ch) return '';
  const swapped = c.who !== c.base;
  const p = S.people[c.who];
  const chip = `<button class="chip tap" onclick="swapWho(event,'${ds}','${c.id}')">
    <span class="dot" style="background:${p.color}"></span>
    <span class="nm">${swapped?'↔ ':''}${esc(p.name)}</span></button>`;
  const freq = ch.freq==='daily' ? '' : `<small>${freqLabel(ch)}</small>`;   // "매일" 은 노이즈라 생략
  return `<div class="chore ${done?'done':''}" onclick="toggleDone('${ds}','${c.id}')">
    <span class="cbox">${done?CHECK:''}</span>
    <span class="cicon">${svgIcon(ch.icon, 20)}</span>
    <span class="cname"><span class="ttl">${esc(ch.name)}</span>${freq}</span>
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
  const perfect = total>0 && doneN===total;
  // 연속 완료는 2일 이상일 때만 — 1일은 "연속"이라 부를 게 없다
  const st = currentStreak();
  const streakTxt = st>=2 ? ` · <b>${st}-day streak</b>` : '';
  $('#todayCard').innerHTML =
    `<div class="cardHead">
      <div>
        <h2>Today</h2>
        <div class="subline">${perfect ? `All done for today! ${PARTY}` : `${doneN} / ${total} done`}${streakTxt}</div>
      </div>
      <div class="ring ${perfect?'full':''}">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="none" stroke="var(--track)" stroke-width="5"/>
          <circle cx="30" cy="30" r="25" fill="none" stroke="var(--ac)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"
            transform="rotate(-90 30 30)"/>
        </svg>
        <div class="rTxt">${perfect ? `<span class="rParty">${PARTY}</span>` : `${doneN}/${total}`}</div>
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
    // 매일 하는 건 달력에 안 띄운다 (매일 뜨면 정보가 아님)
    const items = choresFor(d).filter(c=>{ const def = choreDef(c.id); return def && def.freq!=='daily'; });
    const evs = eventsFor(d);
    // 셀 높이가 고정이라 돈 일정이 한 줄 차지하는 날은 집안일을 그만큼 덜 보여준다 (넘치면 +N)
    const MAXMINI = evs.length ? 2 : 4;
    const shown = items.length > MAXMINI ? items.slice(0, MAXMINI-1) : items;
    let minis = shown.map(c=>{
      const col = S.people[c.who].color;
      return `<span class="mini" style="color:${col};background:${col}2e">${esc(shortOf(choreDef(c.id)))}</span>`;
    }).join('');
    if(items.length > MAXMINI) minis += `<span class="mini more">+${items.length-(MAXMINI-1)}</span>`;
    const dense = items.length >= 3 ? ' dense' : '';   // 3개↑ → 한 줄에 2개
    // 그날 집안일을 전부 끝낸 날 = 우상단에 🎉 배지만. absolute 라 셀 높이에 영향 없음
    // (6주짜리 달에서도 마지막 주가 안 밀린다). 배경 틴트/워터마크는 다크에서 셀이
    // 칙칙해져서 뺐다 — 배지 하나로도 "다 한 날"이 충분히 스캔됨
    const perfect = allDone(d);
    const cls = [ds===todayStr ? 'today' : '', perfect ? 'perfect' : ''].join(' ').trim();
    const party = perfect ? `<span class="wow" aria-label="All done">${PARTY}</span>` : '';
    // 돈 일정(12일 입금 · 28일 월세)은 날짜 바로 밑에 한 줄 바로 깔고,
    // 그 아래로 한 줄 띄워서 집안일 알약이 붙는다 (섞여 보이지 않게)
    const evtHTML = evs.length
      ? `<div class="evts">${evs.map(e=>`<span class="evt">${esc(e.short)}</span>`).join('')}</div>` : '';
    html += `<div class="cell ${cls}" onclick="openSheet('${ds}')">
      ${party}
      <div class="dn ${wd===0?'sun':wd===6?'sat':''}">${day}</div>
      ${evtHTML}
      <div class="minis${dense}${evs.length?' afterEvt':''}">${minis}</div></div>`;
  }
  $('#calGrid').innerHTML = html;
  // 같이 살기 전(2026-07 이전)으로는 못 넘어간다
  const st = parseYMD(START);
  $('#btnPrev').disabled = (view.y === st.getFullYear() && view.m === st.getMonth());

  $('#calLegend').innerHTML =
    `<span class="li"><span class="dot" style="background:${S.people.A.color}"></span>${esc(S.people.A.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.people.B.color}"></span>${esc(S.people.B.name)}</span>`
    + `<span class="li"><span class="evt lg">Save</span>12th<span class="evt lg">Rent</span>28th</span>`
    + `<span class="li"><span class="wow lg">${PARTY}</span>All done</span>`
    + `<span class="note">Daily chores hidden · tap a date for the full list</span>`;
}

/* ---------- 날씨 바 / 시간별 시트 ---------- */
export function renderWeather(){
  const el = $('#wxBar');
  if(!el) return;
  const win = wx24();
  if(!win){ el.innerHTML = `<span class="wxLoad">Loading weather…</span>`; return; }
  const temps = win.map(x=>x.temp);
  const ic = wxIconFor(repWeather(win));
  const nowT = win[0] ? win[0].temp : null;      // 창의 첫 칸 = 지금 시각
  const hum = win[0] && win[0].humidity!=null
    ? `<span class="wxHum">Humidity ${win[0].humidity}%</span>` : `<span class="wxHum"></span>`;
  el.innerHTML =
    `<span class="wxIcon" style="color:${ic.color}">${svgIcon(ic.name, 26, 1.6)}</span>`
    + `<span class="wxNow">${nowT!=null ? nowT+'°' : '—'}</span>`
    + `<span class="wxTemp"><span class="wxHi">${Math.max(...temps)}°</span>`
    + `<span class="wxMin">/ ${Math.min(...temps)}°</span></span>`
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
        oninput="acctFormInput('amount', this.value, this)"></div>
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
  const tag = allDone(d) ? `<span class="allDoneTag">${PARTY} All done</span>` : '';
  const evts = eventsFor(d).map(e=>`<div class="evtRow"><span class="evt">${esc(e.short)}</span>${esc(e.name)}</div>`).join('');
  $('#sheet').innerHTML = `<h3>${fmtDate(d)}${tag}</h3>${evts}`
    + list.map(c=>choreRow(c, view.sheetDateStr)).join('');
}

/* ---------- 축하 배너 ----------
   그날 마지막 항목을 체크해 100% 가 된 "순간"에만 뜬다 (main 의 toggleDone 에서 호출).
   renderAll 안에 두지 않는 이유: 60초 클라우드 동기화 재렌더마다 다시 떠서 거슬린다. */
let cheerT = 0;
export function cheer(streak){
  const el = $('#cheer');
  if(!el) return;
  el.innerHTML = `<span class="cheerIco">${PARTY}</span>
    <span class="cheerTxt"><b>All done!</b>
    <small>${streak>=2 ? `${streak} days in a row` : 'Everything checked off'}</small></span>`;
  el.classList.add('on');
  clearTimeout(cheerT);
  cheerT = setTimeout(()=>el.classList.remove('on'), 3600);
}

export function renderAll(){
  applyAccent(); applyTheme(); applySleep(); applyShift(); renderClock();
  renderToday(); renderWeather(); renderAccount(); renderCalendar(); renderSheet();
}

/* ====================================================================
   설정 다이얼로그 — 쉬운 말 + 실제 날짜/이름, 변경 즉시 저장·적용
==================================================================== */

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
// 홈 화면에 설치된 PWA 는 이미 전체화면이다. 여기서 requestFullscreen 을 부르면
// 사파리의 전체화면 UI(모서리 X 버튼)만 덧씌워져서 오히려 방해가 된다 → 줄 자체를 감춘다.
// (사파리 탭에서 열었을 땐 여전히 쓸모 있으므로 그대로 보여준다)
function isInstalled(){
  return navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function getPath(o, p){ return p.split('.').reduce((x,k)=>x[k], o); }
function setPath(o, p, v){
  const ks = p.split('.'); let x = o;
  for(let i=0; i<ks.length-1; i++) x = x[ks[i]];
  x[ks[ks.length-1]] = v;
}

/* ---------- 폼 위젯 빌더 ---------- */
function segBtns(k, opts, cur, extra){
  return `<span class="seg">` + opts.map(o=>
    `<button data-act="seg" data-k="${k}" data-v="${o.v}" ${extra||''}
      class="${String(o.v)===String(cur)?'on':''}">${o.label}</button>`).join('') + `</span>`;
}
// 요일 고르기(복수 선택) — 빨래·쓰레기·청소기가 같이 쓴다
function dayBtns(key, days){
  return `<span style="display:flex;gap:4px;flex-wrap:wrap;">` + WD.map((w,i)=>
    `<button class="dayb ${days.includes(i)?'on':''}" data-act="days" data-k="${key}" data-v="${i}">${w}</button>`
  ).join('') + `</span>`;
}
function hSel(key, val){
  let opts = '';
  for(let h=0; h<24; h++) opts += `<option value="${h}" ${h===val?'selected':''}>${String(h).padStart(2,'0')}:00</option>`;
  return `<select data-sel="${key}">${opts}</select>`;
}

// 담당 고르기 — 두 사람뿐이라 토글 두 개. 고른 쪽만 그 사람 색, 나머지는 회색.
function ownerToggle(path, cur){
  return `<span class="whoTog">` + ['A','B'].map(k=>{
    const p = S.people[k], on = (cur === k);
    const style = on ? `background:${p.color}1f;border-color:${p.color};color:${p.color}` : '';
    return `<button class="whoBtn ${on?'on':''}" data-act="seg" data-k="${path}" data-v="${k}" style="${style}">
      <span class="dot" style="background:${on?p.color:'currentColor'}"></span>${esc(p.name)}</button>`;
  }).join('') + `</span>`;
}

// 집안일 카드 1개 — 주기 · (주기별 상세) · 담당. 이름/아이콘은 고정이라 건드리지 않는다.
function choreCard(c, i){
  const p = `chores.${i}`;
  const freqSeg = `<span class="seg">` + FREQS.map(f=>
    `<button data-act="freq" data-i="${i}" data-v="${f.v}" class="${c.freq===f.v?'on':''}">${f.label}</button>`
  ).join('') + `</span>`;

  let detail = '';
  if(c.freq==='weekly'){
    detail = `<div class="frow"><label>Days</label>${dayBtns(p+'.days', c.days||[])}</div>`;
  }else if(c.freq==='biweekly' || c.freq==='monthly'){
    // 시작 날짜 하나만 고르면 된다 — 그 날짜의 요일(격주) / 일(매월)이 그대로 규칙이 된다
    detail = `<div class="frow"><label>Starts</label>
        <input type="date" data-selstr="${p}.start" value="${esc(c.start||'')}" min="${START}"></div>
      <p class="help">${freqLabel(c)}</p>`;
  }

  return `<div class="secCard chCard">
    <div class="chHead">
      <span class="chIco">${svgIcon(c.icon,18)}</span>
      <span class="chTtl">${esc(c.name)}</span>
    </div>
    <div class="frow"><label>Repeat</label>${freqSeg}</div>
    ${detail}
    <div class="frow"><label>Who</label>${ownerToggle(p+'.owner', c.owner)}</div>
  </div>`;
}

function renderSettingsBody(){
  const isFull = !!fsElement();

  $('#dlg').innerHTML = `<div class="dlgIn">
    <h2>${svgIcon('gear',19)} Settings</h2>
    <p class="subNote">Changes apply instantly · set how often each chore repeats and who does it</p>

    <div class="sec secTop">Chores</div>
    ${(S.chores||[]).map(choreCard).join('')}

    <div class="secCard">
      <div class="sec">Display</div>
      <div class="frow"><label>${svgIcon('sun',16)}Theme</label>
        ${segBtns('theme', [{v:'auto',label:'Auto'},{v:'light',label:'Light'},{v:'dark',label:'Dark'}], S.theme)}</div>
      <p class="help">Auto follows the time of day — light by day, dark from 6 PM.</p>
      ${isInstalled() ? '' : `<div class="frow"><label>${svgIcon('expand',16)}Fullscreen</label>
        <button class="fullBtn" data-act="full">${isFull?'Off':'On'}</button></div>`}
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
    // 주기를 바꾸면 그 주기가 요구하는 필드(요일 / 시작일)를 채워 준다
    else if(act==='freq'){
      const c = S.chores[+b.dataset.i];
      if(c && c.freq !== b.dataset.v){ c.freq = b.dataset.v; fillFreq(c); commitSettings(); }
    }
    else if(act==='seg'){
      let v = b.dataset.v;
      if(b.dataset.num) v = Number(v);
      if(b.dataset.bool) v = v==='1';
      setPath(S, b.dataset.k, v);
      commitSettings();
    }
    else if(act==='days'){
      const k = b.dataset.k, v = Number(b.dataset.v), cur = getPath(S, k);
      if(cur.includes(v)){
        if(cur.length > 1) setPath(S, k, cur.filter(x=>x!==v));   // 마지막 하나는 못 끄게 (요일 0개 방지)
      }else{
        setPath(S, k, [...cur, v].sort((a,b2)=>a-b2));
      }
      commitSettings();
    }
  });

  $('#dlg').addEventListener('change', e=>{
    const el = e.target;
    if(!el.dataset) return;
    if(el.dataset.sel){ setPath(S, el.dataset.sel, Number(el.value)); commitSettings(); }
    else if(el.dataset.selstr && el.value){ setPath(S, el.dataset.selstr, el.value); commitSettings(); }
  });
}
