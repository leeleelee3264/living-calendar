// 뷰 계층: 화면 렌더링 + 설정 다이얼로그. 상태를 읽어 DOM 을 그린다.
// (이벤트 배선·상호작용은 main.js)
import { CHORES, NTH, WD_KO } from './data.js';
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

/* ====================================================================
   라인 아이콘 (lucide 스타일 stroke path)
==================================================================== */
const ICONS = {
  trash:['M3 6h18','M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2','M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6','M10 11v6','M14 11v6'],
  recycle:['M9.5 4.7a1.8 1.8 0 0 1 3 0l1.7 3','M18 9.5l1.9 3.3a1.8 1.8 0 0 1-1.5 2.7H15','M9 20H5.6a1.8 1.8 0 0 1-1.5-2.7L6 14','M6 14l-2.2.4L3 12','M15 15l-1 3 3 1','M14.2 7.7 17 7l.6 2.9'],
  broom:['M15 4l5 5','M13.6 5.4 18.6 10.4','M11 8 4.9 14.1a2.2 2.2 0 0 0 3.1 3.1L14 11','M12.5 15l-1.3 3.6','M15.4 12.7l-1.3 3.6'],
  bed:['M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6','M3 15h18','M6.5 10V8.7a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V10','M13 10V8.7a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V10','M4 18v2','M20 18v2'],
  basket:['M5 9h14l-1.3 9.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5 9Z','M6 9l2-4.5h8L18 9','M9.5 12.5v4','M12 12.5v4','M14.5 12.5v4'],
  droplets:['M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z','M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97'],
  toilet:['M7 3h7v6.5','M4.5 9.5h15a7.5 7.5 0 0 1-7.5 7h-.5a7.5 7.5 0 0 1-7-7Z','M10 16.5 8.5 21h7L14 16.5'],
  fridge:['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z','M5 10h14','M9 5v2.5','M9 13v3'],
  coins:['M3.2 6.2c0-1.2 2.6-2.2 5.8-2.2s5.8 1 5.8 2.2-2.6 2.2-5.8 2.2S3.2 7.4 3.2 6.2Z','M3.2 6.2v3.9c0 1.2 2.6 2.2 5.8 2.2','M9.2 13.7c.6.05 1.2.08 1.8.08 3.2 0 5.8-1 5.8-2.2','M20.8 13.9v3.7c0 1.2-2.6 2.2-5.8 2.2-1.6 0-3-.25-4-.65','M15 11.5c3.2 0 5.8-1 5.8-2.2S18.2 7.1 15 7.1c-.6 0-1.2.04-1.8.1'],
  gear:['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z','M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z'],
  expand:['M8 3H5a2 2 0 0 0-2 2v3','M16 3h3a2 2 0 0 1 2 2v3','M21 16v3a2 2 0 0 1-2 2h-3','M3 16v3a2 2 0 0 0 2 2h3'],
  sun:['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M12 2v2','M12 20v2','M4.93 4.93l1.41 1.41','M17.66 17.66l1.41 1.41','M2 12h2','M20 12h2','M4.93 19.07l1.41-1.41','M17.66 6.34l1.41-1.41'],
  cloudSun:['M12 2v2','M4.93 4.93l1.41 1.41','M20 12h2','M19.07 4.93l-1.41 1.41','M15.947 12.65a4 4 0 0 0-5.925-4.128','M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z'],
  cloud:['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
  fog:['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242','M16 17H7','M17 21H9'],
  rain:['M7 15.5a4.2 4.2 0 0 1-.6-8.3A5.5 5.5 0 0 1 17 5.8 3.6 3.6 0 0 1 16.8 15.5','M8 18.5l-1 2.2','M12 18.5l-1 2.2','M16 18.5l-1 2.2'],
  snow:['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242','M8 15h.01','M8 19h.01','M12 17h.01','M12 21h.01','M16 15h.01','M16 19h.01'],
  storm:['M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973','M13 12l-3 5h4l-3 5'],
  umbrella:['M22 12a10.06 10.06 0 0 0-20 0Z','M12 12v8a2 2 0 0 0 4 0','M12 2v1'],
  drop:['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
};
export function svgIcon(name, size=20, sw=1.7){
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"`
    + ` stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">`
    + (ICONS[name]||[]).map(d=>`<path d="${d}"/>`).join('') + `</svg>`;
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
};

/* ====================================================================
   렌더링
==================================================================== */

// 설정된 포인트 색을 CSS 변수로 반영 (--acSoft 는 색상혼합 미지원 브라우저 대비 JS 에서 계산)
export function applyAccent(){
  const r = document.documentElement.style;
  r.setProperty('--ac', S.accent);
  r.setProperty('--acSoft', S.accent + '21');
}

// 오늘 체크리스트 / 바텀시트의 한 줄 — 줄 탭 = 완료, 이름표 탭 = 담당 교체
function choreRow(c, ds){
  const done = !!DONE[ds+'|'+c.id];
  const ch = CHORES[c.id];
  const swapped = c.who !== c.base;
  const chip = c.who==='both'
    ? `<span class="chip"><span class="dot" style="background:var(--ac)"></span><span class="nm">같이</span></span>`
    : (()=>{ const p = S.people[c.who];
        return `<button class="chip tap" onclick="swapWho(event,'${ds}','${c.id}')">
          <span class="dot" style="background:${p.color}"></span>
          <span class="nm">${swapped?'↔ ':''}${esc(p.name)}</span></button>`; })();
  const freq = ch.daily ? '' : `<small>${ch.freq}</small>`;   // "매일" 은 노이즈라 생략
  return `<div class="chore ${done?'done':''}" onclick="toggleDone('${ds}','${c.id}')">
    <span class="cbox">${done?CHECK:''}</span>
    <span class="cicon">${svgIcon(ch.icon, 20)}</span>
    <span class="cname"><span class="ttl">${ch.ko}</span>${freq}</span>
    ${chip}
  </div>`;
}

export function renderClock(){
  const n = new Date();
  $('#clkTime').textContent = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  $('#clkDate').textContent = `${n.getMonth()+1}월 ${n.getDate()}일 ${WD_KO[n.getDay()]}요일`;
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
        <h2>오늘 할 일</h2>
        <div class="subline">${doneN===total ? '오늘 할 일 끝!' : `${doneN} / ${total} 완료`}</div>
      </div>
      <div class="ring">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5"/>
          <circle cx="30" cy="30" r="25" fill="none" stroke="var(--ac)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"
            transform="rotate(-90 30 30)"/>
        </svg>
        <div class="rTxt">${doneN}/${total}</div>
      </div>
    </div>`
    + list.map(c=>choreRow(c, ds)).join('')
    + `<div class="hint">줄을 누르면 완료 체크 · 이름표를 누르면 그날만 담당 교체 · 체크는 이 기기에만 저장돼요</div>`;
}

export function renderCalendar(){
  $('#calTitle').textContent = `${view.y}년 ${view.m+1}월`;
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
    const minis = items.map(c=>{
      const col = c.who==='both' ? S.accent : S.people[c.who].color;
      return `<span class="mini" style="color:${col};background:${col}2e">${CHORES[c.id].short}</span>`;
    }).join('');
    html += `<div class="cell ${ds===todayStr?'today':''}" onclick="openSheet('${ds}')">
      <div class="dn ${wd===0?'sun':wd===6?'sat':''}">${day}</div>
      <div class="minis">${minis}</div></div>`;
  }
  $('#calGrid').innerHTML = html;

  $('#calLegend').innerHTML =
    `<span class="li"><span class="dot" style="background:${S.people.A.color}"></span>${esc(S.people.A.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.people.B.color}"></span>${esc(S.people.B.name)}</span>`
    + `<span class="li"><span class="dot" style="background:${S.accent}"></span>같이</span>`
    + `<span class="note">매일 하는 일은 생략 · 날짜를 누르면 전체 목록</span>`;
}

/* ---------- 날씨 바 / 시간별 시트 ---------- */
export function renderWeather(){
  const el = $('#wxBar');
  if(!el) return;
  const win = wx24();
  if(!win){ el.innerHTML = `<span class="wxDesc">날씨 불러오는 중…</span>`; return; }
  const temps = win.map(x=>x.temp);
  const code = repWeather(win);
  const w = wxInfo(code);
  const ic = wxIconFor(code);
  const hum = win[0] && win[0].humidity!=null
    ? `<span class="wxHum">습도 ${win[0].humidity}%</span>` : `<span class="wxHum"></span>`;
  el.innerHTML =
    `<span class="wxIcon" style="color:${ic.color}">${svgIcon(ic.name, 26, 1.6)}</span>`
    + `<span class="wxTemp">${Math.max(...temps)}°<span class="wxMin">/ ${Math.min(...temps)}°</span></span>`
    + `<span class="wxDesc ${w.precip?'rain':''}">${w.ko}</span>`
    + hum
    + `<span class="wxMore">›</span>`;
}
function wxDateLabel(ds){
  const d = parseYMD(ds);
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${WD_KO[d.getDay()]})`;
}
export function renderWeatherSheet(){
  const title = '앞으로 24시간 · 서울';
  const win = wx24();
  if(!win){ $('#sheet').innerHTML = `<h3>${title}</h3><p class="hint">날씨 정보를 불러오지 못했어요.</p>`; return; }
  const nowStr = ymd(new Date()), nowH = new Date().getHours();
  let lastDate = null, rows = '';
  for(const x of win){
    if(x.date !== lastDate){ lastDate = x.date; rows += `<div class="hDate">${wxDateLabel(x.date)}</div>`; }
    const w = wxInfo(x.code);
    const ic = wxIconFor(x.code);
    const pop = (x.pop!=null && x.pop>0) ? `<span class="hPop">${svgIcon('umbrella',12,2)}${x.pop}%</span>` : '';
    const hum = (x.humidity!=null) ? `<span class="hHum">${svgIcon('drop',12,2)}${x.humidity}%</span>` : '';
    const now = (x.date===nowStr && x.h===nowH) ? 'now' : '';
    rows += `<div class="hRow ${now}">
      <span class="hH">${String(x.h).padStart(2,'0')}시</span>
      <span class="hIco" style="color:${ic.color}">${svgIcon(ic.name,18,1.8)}</span>
      <span class="hDesc">${w.ko}</span>${pop}${hum}<span class="hT">${x.temp}°</span></div>`;
  }
  $('#sheet').innerHTML = `<h3>${title}</h3><div class="hourly">${rows}</div>`;
}

/* ---------- 생활비 카드 / 상세 시트 ---------- */
function fmtWon(n){ return (n==null ? '—' : Number(n).toLocaleString('ko-KR')) + '원'; }

export function renderAccount(){
  const el = $('#moneyCard');
  if(!el) return;
  const head = `<div class="mcHead"><span class="ic">${svgIcon('coins',22)}</span>
    <span class="t">생활비</span><span class="more">›</span></div>`;
  let body;
  if(!hasAccountUrl()) body = `<div class="mcBal muted">설정에서 연결</div>`;
  else{
    const a = accountData();
    body = (a && a.balance!=null)
      ? `<div class="mcRow">
          <div><div class="mcLbl">남은 생활비</div><div class="mcBal">${fmtWon(a.balance)}</div></div>
          <div class="mcSpent"><div class="mcLbl">이번 달 지출</div><div class="v">${fmtWon(thisMonthTotal())}</div></div>
        </div>`
      : `<div class="mcBal muted">불러오는 중…</div>`;
  }
  el.innerHTML = head + body;
}

export function renderAccountSheet(){
  const title = '생활비 통장';
  if(!hasAccountUrl()){
    $('#sheet').innerHTML = `<h3>${title}</h3><p class="hint">설정 → 생활비에서 구글 시트 CSV 게시 URL 을 넣으면 잔액과 내역이 보여요.</p>`;
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
  }).join('') : `<p class="hint">내역이 아직 없어요.</p>`;

  $('#sheet').innerHTML = `<h3>${title}</h3>
    <div class="acctBal">${bal}<small>남은 잔액</small></div>
    <div class="acctSub">이번 달 지출 <b>${month}</b></div>
    <div class="hDate">최근 내역</div>${rows}`;
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
  applyAccent(); applySleep(); applyShift(); renderClock();
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
    WD_KO.map((w,i)=>`<option value="${i}" ${i===val?'selected':''}>${w}요일</option>`).join('') + `</select>`;
}
function nSelM(key, val){
  return `<select data-sel="${key}">` +
    NTH.map((n,i)=>`<option value="${i+1}" ${i+1===val?'selected':''}>${n}</option>`).join('') + `</select>`;
}
function hSel(key, val){
  let opts = '';
  for(let h=0; h<24; h++) opts += `<option value="${h}" ${h===val?'selected':''}>${h}시</option>`;
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
    <h2>${svgIcon('gear',19)} 설정</h2>
    <p class="subNote">변경하면 바로 적용돼요 · 이름표를 누르면 담당이 바뀌어요</p>

    <div class="secCard">
      <div class="sec">사람</div>
      <div class="frow"><input type="text" data-inp="people.A.name" value="${esc(S.people.A.name)}">
        <input type="color" data-inp="people.A.color" value="${S.people.A.color}"></div>
      <div class="frow"><input type="text" data-inp="people.B.name" value="${esc(S.people.B.name)}">
        <input type="color" data-inp="people.B.color" value="${S.people.B.color}"></div>
    </div>

    <div class="secCard">
      <div class="sec">매일 하는 일</div>
      <div class="frow"><label>${svgIcon('trash',16)}${CHORES.trashBathroom.ko}</label>
        ${pBtn(S.daily.trashBathroom, `data-act="flip" data-path="daily.trashBathroom"`)}</div>
      <div class="frow"><label>${svgIcon('recycle',16)}${CHORES.trashRecycle.ko}</label>
        ${pBtn(S.daily.trashRecycle, `data-act="flip" data-path="daily.trashRecycle"`)}</div>
      <div class="frow"><label>${svgIcon('broom',16)}${CHORES.vacuum.ko}</label>
        ${pBtn(S.daily.vacuum, `data-act="flip" data-path="daily.vacuum"`)}</div>
      <div class="frow"><label>${svgIcon('bed',16)}${CHORES.makeBed.ko}</label>
        ${segBtns('daily.makeBed', [{v:'both',label:'같이'},{v:'A',label:esc(S.people.A.name)},{v:'B',label:esc(S.people.B.name)}], S.daily.makeBed)}</div>
    </div>

    <div class="secCard">
      <div class="sec">빨래 (주 3회)</div>
      <div class="frow"><label>${svgIcon('basket',16)}세탁 요일</label>
        <span style="display:flex;gap:4px;flex-wrap:wrap;">${WD_KO.map((w,i)=>
          `<button class="dayb ${S.laundry.days.includes(i)?'on':''}" data-act="ld" data-v="${i}">${w}</button>`).join('')}</span></div>
      <div class="frow"><label>담당</label>
        ${pBtn(S.laundry.owner, `data-act="flip" data-path="laundry.owner"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">물걸레질 (주 1회)</div>
      <div class="frow"><label>${svgIcon('droplets',16)}요일</label>${dSelFull('mop.day', S.mop.day)}
        ${segBtns('mop.mode', [{v:'rotate',label:'번갈아'},{v:'fixed',label:'고정'}], S.mop.mode)}</div>
      <div class="frow"><label>${S.mop.mode==='fixed' ? '담당' : '다음 차례 · '+fmtShort(mopNext)}</label>
        ${S.mop.mode==='fixed'
          ? pBtn(S.mop.first, `data-act="flip" data-path="mop.first"`)
          : pBtn(mopWho, `data-act="flipd" data-kind="mop"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">화장실 청소 (2주 1회)</div>
      <div class="frow"><label>${svgIcon('toilet',16)}요일</label>${dSelFull('bathroomClean.day', bath.day)}</div>
      <div class="frow"><label>다음 차례</label>
        ${segBtns('bathroomClean.startWeek',
          [{v:mod(weekIndex(bathC1),2), label:fmtShort(bathC1)},
           {v:mod(weekIndex(bathC2),2), label:fmtShort(bathC2)}],
          bath.startWeek, 'data-num="1"')}</div>
      <div class="frow"><label>담당 · ${fmtShort(bathNext)}</label>
        ${pBtn(bathWho, `data-act="flipd" data-kind="bath"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">침구 세탁 (2주 1회 · 같이)</div>
      <div class="frow"><label>${svgIcon('bed',16)}요일</label>${dSelFull('bedding.day', S.bedding.day)}</div>
      <div class="frow"><label>다음 차례</label>
        ${segBtns('bedding.startWeek',
          [{v:mod(weekIndex(bedC1),2), label:fmtShort(bedC1)},
           {v:mod(weekIndex(bedC2),2), label:fmtShort(bedC2)}],
          S.bedding.startWeek, 'data-num="1"')}</div>
    </div>

    <div class="secCard">
      <div class="sec">냉장고 청소 (월 1회)</div>
      <div class="frow"><label>${svgIcon('fridge',16)}매월</label>
        ${nSelM('fridge.nth', S.fridge.nth)} ${dSelFull('fridge.day', S.fridge.day)}</div>
      <div class="frow"><label>다음 차례 · ${fmtShort(frNext)}</label>
        ${pBtn(frWho, `data-act="flipd" data-kind="fridge"`)}</div>
    </div>

    <div class="secCard">
      <div class="sec">생활비</div>
      <div class="frow" style="flex-direction:column;align-items:stretch;gap:5px;">
        <label style="min-width:0">${svgIcon('coins',16)}구글 시트 CSV 게시 URL</label>
        <input type="url" data-inp="account.url" value="${esc(S.account.url)}"
          placeholder="https://docs.google.com/.../pub?output=csv" style="width:100%">
      </div>
      <p class="help">시트 → 파일 → 공유 → 웹에 게시 → CSV 선택 → URL 붙여넣기. URL 은 이 기기에만 저장돼요.</p>
    </div>

    <div class="secCard">
      <div class="sec">화면</div>
      <div class="frow"><label>${svgIcon('expand',16)}전체화면</label>
        <button class="fullBtn" data-act="full">${isFull?'끄기':'켜기'}</button></div>
      <div class="frow"><label>포인트 색</label>
        <span class="swatches">${ACCENTS.map(c=>
          `<button class="sw ${S.accent===c?'on':''}" data-act="accent" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</span></div>
      <div class="frow"><label>심야 화면 끄기</label>
        ${segBtns('sleep.on', [{v:1,label:'켬'},{v:0,label:'끔'}], S.sleep.on?1:0, 'data-bool="1"')}
        ${hSel('sleep.start', S.sleep.start)} ~ ${hSel('sleep.end', S.sleep.end)}</div>
      <p class="help">심야엔 검은 화면에 시계만 은은하게 떠요. 화면을 탭하면 1분간 다시 보여요. (번인 방지)</p>
    </div>

    <div class="dlgBtns">
      <button class="primary" data-act="close">닫기</button>
    </div>
    <button class="resetLink" data-act="reset">설정 초기화</button>
  </div>`;
}

function commitSettings(){ saveSettings(); renderAll(); renderSettingsBody(); }
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
      if(confirm('설정을 기본값으로 되돌릴까요?')){
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
    else if(el.dataset && el.dataset.inp){
      let v = el.value;
      if(el.dataset.inp.endsWith('.name')) v = v.trim() || '?';
      setPath(S, el.dataset.inp, v);
      commitSettings();
    }
  });
}
