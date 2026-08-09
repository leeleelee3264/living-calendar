// 뷰 계층: 화면 렌더링 + 설정 다이얼로그. 상태를 읽어 DOM 을 그린다.
// (이벤트 배선·상호작용은 main.js)
import { FREQS, CHORE_ICONS, NTH, WD, WD_FULL, MON_SHORT, MON_FULL } from './data.js';
import { S, DONE, saveSettings, resetSettings, fillFreq } from './storage.js';
import {
  ymd, parseYMD, fmtDate, fmtShort, inHourRange,
  pick, weekIndex, mod, otherOf,
  addDays, nextWeekdayDate, choresFor,
  choreDef, occIndex, nextOccurrence, freqLabel, shortOf,
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
  const chip = c.who==='both'
    ? `<span class="chip"><span class="dot" style="background:var(--ac)"></span><span class="nm">Both</span></span>`
    : (()=>{ const p = S.people[c.who];
        return `<button class="chip tap" onclick="swapWho(event,'${ds}','${c.id}')">
          <span class="dot" style="background:${p.color}"></span>
          <span class="nm">${swapped?'↔ ':''}${esc(p.name)}</span></button>`; })();
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
    const MAXMINI = 4;                       // 넘치면 마지막을 +N 으로 (셀 높이 넘침 방지)
    const shown = items.length > MAXMINI ? items.slice(0, MAXMINI-1) : items;
    let minis = shown.map(c=>{
      const col = c.who==='both' ? S.accent : S.people[c.who].color;
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
    html += `<div class="cell ${cls}" onclick="openSheet('${ds}')">
      ${party}
      <div class="dn ${wd===0?'sun':wd===6?'sat':''}">${day}</div>
      <div class="minis${dense}">${minis}</div></div>`;
  }
  $('#calGrid').innerHTML = html;

  $('#calLegend').innerHTML =
    `<span class="li"><span class="dot" style="background:${S.people.A.color}"></span>${esc(S.people.A.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.people.B.color}"></span>${esc(S.people.B.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.accent}"></span>Both</span>`
    + `<span class="li"><span class="wow lg">${PARTY}</span>All done</span>`
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
  const tag = allDone(d) ? `<span class="allDoneTag">${PARTY} All done</span>` : '';
  $('#sheet').innerHTML = `<h3>${fmtDate(d)}${tag}</h3>` + list.map(c=>choreRow(c, view.sheetDateStr)).join('');
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

// 번갈아 하는 집안일에서 사용자가 "다음 차례 = OO" 를 탭하면
// → 그 날짜가 OO 가 되도록 내부 first(첫 차례 담당)를 역산한다. 주기 종류와 무관하게 동작.
function flipRotation(c){
  const nx = nextOccurrence(c);
  if(!nx) return;
  const occ = occIndex(c, nx);
  const nw = otherOf(pick(c.first || 'A', occ));
  c.first = mod(occ,2)===0 ? nw : otherOf(nw);
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
// 요일 고르기(복수 선택) — 빨래·쓰레기·청소기가 같이 쓴다
function dayBtns(key, days){
  return `<span style="display:flex;gap:4px;flex-wrap:wrap;">` + WD.map((w,i)=>
    `<button class="dayb ${days.includes(i)?'on':''}" data-act="days" data-k="${key}" data-v="${i}">${w}</button>`
  ).join('') + `</span>`;
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

// 집안일 카드 1개 — 모든 집안일이 같은 모양이다: 이름 · 아이콘 · 주기 · (주기별 상세) · 담당
function choreCard(c, i){
  const p = `chores.${i}`;
  const freqSeg = `<span class="seg">` + FREQS.map(f=>
    `<button data-act="freq" data-i="${i}" data-v="${f.v}" class="${c.freq===f.v?'on':''}">${f.label}</button>`
  ).join('') + `</span>`;

  let detail = '';
  if(c.freq==='weekly'){
    detail = `<div class="frow"><label>Days</label>${dayBtns(p+'.days', c.days||[])}</div>`;
  }else if(c.freq==='biweekly'){
    // "다음은 언제냐"로 격주 주기를 고르게 한다 (내부 주 패리티를 그대로 노출하면 못 알아본다)
    const c1 = nextWeekdayDate(c.day), c2 = addDays(c1, 7);
    detail = `<div class="frow"><label>Day</label>${dSelFull(p+'.day', c.day)}</div>
      <div class="frow"><label>Next</label>
        ${segBtns(p+'.startWeek',
          [{v:mod(weekIndex(c1),2), label:fmtShort(c1)}, {v:mod(weekIndex(c2),2), label:fmtShort(c2)}],
          c.startWeek, 'data-num="1"')}</div>`;
  }else if(c.freq==='monthly'){
    detail = `<div class="frow"><label>Every</label>${nSelM(p+'.nth', c.nth)} ${dSelFull(p+'.day', c.day)}</div>`;
  }

  const ownerSeg = segBtns(p+'.owner', [
    {v:'A', label:esc(S.people.A.name)}, {v:'B', label:esc(S.people.B.name)},
    {v:'both', label:'Both'}, {v:'rotate', label:'Alternate'},
  ], c.owner);
  const nx = nextOccurrence(c);
  const rotRow = (c.owner==='rotate' && nx)
    ? `<div class="frow"><label>Next · ${fmtShort(nx)}</label>
        ${pBtn(pick(c.first||'A', occIndex(c, nx)), `data-act="cflip" data-i="${i}"`)}</div>` : '';

  const icons = `<span class="icoPick">` + CHORE_ICONS.map(ic=>
    `<button class="icob ${c.icon===ic?'on':''}" data-act="seg" data-k="${p}.icon" data-v="${ic}"
      aria-label="${ic}">${svgIcon(ic,17)}</button>`).join('') + `</span>`;

  return `<div class="secCard chCard">
    <div class="chHead">
      <span class="chIco">${svgIcon(c.icon,18)}</span>
      <input class="chName" type="text" value="${esc(c.name)}" data-txt="${p}.name" aria-label="Chore name">
      <button class="chDel" data-act="cdel" data-i="${i}" aria-label="Remove chore">${svgIcon('close',18)}</button>
    </div>
    <div class="frow"><label>Repeat</label>${freqSeg}</div>
    ${detail}
    <div class="frow"><label>Who</label>${ownerSeg}</div>
    ${rotRow}
    <div class="frow"><label>Icon</label>${icons}</div>
  </div>`;
}

function renderSettingsBody(){
  const isFull = !!fsElement();

  $('#dlg').innerHTML = `<div class="dlgIn">
    <h2>${svgIcon('gear',19)} Settings</h2>
    <p class="subNote">Changes apply instantly · add, remove and re-schedule chores here</p>

    <div class="sec secTop">Chores</div>
    ${(S.chores||[]).map(choreCard).join('')}
    <button class="addChore" data-act="cadd">+ Add chore</button>

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
    // ---- 집안일 카드 ----
    else if(act==='freq'){
      const c = S.chores[+b.dataset.i];
      if(c && c.freq !== b.dataset.v){ c.freq = b.dataset.v; fillFreq(c); commitSettings(); }
    }
    else if(act==='cflip'){ const c = S.chores[+b.dataset.i]; if(c){ flipRotation(c); commitSettings(); } }
    else if(act==='cdel'){
      const c = S.chores[+b.dataset.i];
      // 완료 기록(date|chore_id)은 지우지 않는다 — 되살리면 과거 체크가 그대로 보인다
      if(c && confirm(`Remove "${c.name}" from the board?`)){ S.chores.splice(+b.dataset.i, 1); commitSettings(); }
    }
    else if(act==='cadd'){
      S.chores.push(fillFreq({
        id:'c' + Date.now().toString(36), name:'New chore', icon:'broom',
        freq:'weekly', days:[new Date().getDay()], owner:'A',
      }));
      commitSettings();
      const cards = $('#dlg').querySelectorAll('.chCard .chName');
      const last = cards[cards.length-1];
      if(last){ last.focus(); last.select(); }        // 바로 이름부터 치게
    }
    else if(act==='seg'){
      let v = b.dataset.v;
      if(b.dataset.num) v = Number(v);
      if(b.dataset.bool) v = v==='1';
      setPath(S, b.dataset.k, v);
      if(b.dataset.k.endsWith('.owner')) fillFreq(getPath(S, b.dataset.k.slice(0, -6)));  // rotate → first 채움
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
    if(el.dataset && el.dataset.sel){ setPath(S, el.dataset.sel, Number(el.value)); commitSettings(); }
    else if(el.dataset && el.dataset.txt){ pushSettingsCloud(); }   // 이름 편집 끝 → 클라우드에도 반영
  });

  // 집안일 이름은 한 글자마다 반영하되 설정창은 다시 그리지 않는다 (커서가 튀므로)
  $('#dlg').addEventListener('input', e=>{
    const el = e.target;
    if(!el.dataset || !el.dataset.txt) return;
    setPath(S, el.dataset.txt, el.value);
    if(el.dataset.txt.endsWith('.name')){
      const c = getPath(S, el.dataset.txt.slice(0, -5));
      delete c.short;                     // 달력 축약 라벨은 새 이름에서 다시 만든다
    }
    saveSettings();
    renderAll();
  });
}
