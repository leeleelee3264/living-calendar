// 앱 진입점 · 컨트롤러: 상호작용 정의, 이벤트 배선, 상시 노출용 타이머.
import { DONE, OVR, persistDone, persistOvr } from './storage.js';
import { ymd, parseYMD, choresFor } from './core.js';
import { fetchWeather } from './weather.js';
import { addTx, deleteTx } from './livingAccount.js';
import {
  $, view, initSettings, resetAcctForm,
  renderAll, renderCalendar, renderClock,
  applySleep, applyShift, renderWeather, renderAccount, renderSheet, wakeSleep,
} from './ui.js';

/* ---------- 상호작용 ---------- */
function toggleDone(ds, id){
  const k = ds+'|'+id;
  if(DONE[k]) delete DONE[k]; else DONE[k] = 1;
  persistDone();
  renderAll();
}
function swapWho(ev, ds, id){
  ev.preventDefault(); ev.stopPropagation();
  const item = choresFor(parseYMD(ds)).find(c=>c.id===id);
  if(!item || item.who==='both') return;
  const other = item.who==='A' ? 'B' : 'A';
  const k = ds+'|'+id;
  if(other === item.base) delete OVR[k]; else OVR[k] = other;
  persistOvr();
  renderAll();
}
function openSheet(ds){
  view.sheetMode = 'day'; view.sheetDateStr = ds;
  renderSheet();
  $('#sheetWrap').classList.add('open');
}
function openWeatherSheet(){
  view.sheetMode = 'weather'; view.sheetDateStr = null;
  renderSheet();
  $('#sheetWrap').classList.add('open');
}
function openAccountSheet(){
  view.sheetMode = 'account'; view.sheetDateStr = null;
  resetAcctForm();     // 항상 접힌 상태로 연다
  renderSheet();
  $('#sheetWrap').classList.add('open');
}
// 생활비 입력 폼: 텍스트 입력은 재렌더 없이 상태만 갱신 (커서 튐 방지)
function acctFormInput(field, val){ view.acctForm[field] = val; }
function submitAcct(){
  const f = view.acctForm;
  const amt = Number(String(f.amount).replace(/[^0-9.]/g,''));
  if(!amt || amt <= 0) return;               // 빈/0 금액은 무시
  addTx({ amount:amt, type:f.type, memo:f.memo });
  f.amount = ''; f.memo = '';                // 폼은 열어둔 채 값만 비워 연속 입력
  renderAccount(); renderSheet();
}
// 렌더된 HTML 의 인라인 핸들러(onclick/onchange)에서 참조 → window 노출
window.toggleDone = toggleDone;
window.swapWho = swapWho;
window.openSheet = openSheet;
window.openWeatherSheet = openWeatherSheet;
window.openAccountSheet = openAccountSheet;
window.acctFormInput = acctFormInput;

/* ---------- 정적 요소 이벤트 배선 ---------- */
$('#sheetWrap').addEventListener('click', e=>{
  if(e.target.id === 'sheetWrap'){                 // 백드롭 클릭 → 닫기
    $('#sheetWrap').classList.remove('open');
    view.sheetDateStr = null; view.sheetMode = null;
    resetAcctForm();
    return;
  }
  const b = e.target.closest('[data-act]');        // 생활비 시트 내부 버튼
  if(!b) return;
  const act = b.dataset.act;
  if(act==='acctOpen'){ view.acctForm.open = true; renderSheet(); }
  else if(act==='acctClose'){ resetAcctForm(); renderSheet(); }
  else if(act==='acctType'){ view.acctForm.type = b.dataset.v; renderSheet(); }
  else if(act==='acctSubmit'){ submitAcct(); }
  else if(act==='acctDel'){ deleteTx(b.dataset.id); renderAccount(); renderSheet(); }
});
$('#btnPrev').onclick = ()=>{ view.m--; if(view.m<0){view.m=11;view.y--;} renderCalendar(); };
$('#btnNext').onclick = ()=>{ view.m++; if(view.m>11){view.m=0;view.y++;} renderCalendar(); };
$('#btnCalToday').onclick = ()=>{ const n=new Date(); view.y=n.getFullYear(); view.m=n.getMonth(); renderCalendar(); };

initSettings();

/* ---------- 데이터 갱신 (fetch → 렌더) ---------- */
async function refreshWeather(){
  await fetchWeather();
  renderWeather();
  if(view.sheetMode==='weather') renderSheet();
}

/* ---------- 상시 노출: 시계 틱 + 자정 롤오버 + 번인 방지 ---------- */
function tick(){
  renderClock(); applySleep(); applyShift();
  const nowD = ymd(new Date());
  if(nowD !== view.curDate){
    view.curDate = nowD;
    const n = new Date(); view.y = n.getFullYear(); view.m = n.getMonth();
    renderAll(); refreshWeather();      // 생활비는 로컬 장부라 renderAll 로 갱신됨(이번 달 합계 리셋 포함)
  }
}
setInterval(tick, 5000);
refreshWeather();                       // 날씨만 로드 즉시 1회
setInterval(refreshWeather, 1800000);   // 날씨 30분마다

// 심야 모드 깨우기: 어떤 터치든 마지막 터치 시점부터 1분 유지
document.addEventListener('pointerdown', wakeSleep);

// 화면 켜짐 유지 (https 에서 동작, file:// 에선 무시됨)
async function keepAwake(){
  try{ if('wakeLock' in navigator) await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) keepAwake(); });
keepAwake();

renderAll();
