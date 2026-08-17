// 앱 진입점 · 컨트롤러: 상호작용 정의, 이벤트 배선, 상시 노출용 타이머.
import { DONE, OVR, persistDone, persistOvr, applyRemoteSettings, applyRemoteChecks } from './storage.js';
import { ymd, parseYMD, choresFor, allDone, streakBack } from './core.js';
import { START } from './data.js';
import { fetchWeather } from './weather.js';
import { addTx, deleteTx, setTxs, setBase } from './livingAccount.js';
import * as sb from './supabase.js';
import {
  $, view, initSettings, resetAcctForm, cheer,
  renderAll, renderCalendar, renderClock,
  applySleep, applyShift, applyTheme, renderWeather, renderAccount, renderSheet, wakeSleep,
} from './ui.js';

/* ---------- 상호작용 ---------- */
function toggleDone(ds, id){
  const k = ds+'|'+id;
  const nowOn = !DONE[k];
  if(nowOn) DONE[k] = 1; else delete DONE[k];
  persistDone();
  renderAll();
  // 마지막 하나를 체크해 그날이 100% 가 된 순간에만 축하 (해제·동기화 재렌더로는 안 뜸)
  const d = parseYMD(ds);
  if(nowOn && allDone(d)) cheer(streakBack(d));
  // 낙관적 클라우드 반영 (실패해도 로컬은 유지)
  (nowOn ? sb.putCheck(ds, id) : sb.delCheck(ds, id)).catch(()=>{});
}
function swapWho(ev, ds, id){
  ev.preventDefault(); ev.stopPropagation();
  const item = choresFor(parseYMD(ds)).find(c=>c.id===id);
  if(!item) return;
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
// 금액만 예외 — 치는 동안 3자리마다 콤마를 넣어 준다 (표시 금액과 같은 모양으로)
function acctFormInput(field, val, el){
  if(field === 'amount'){
    const digits = String(val).replace(/[^0-9]/g, '');
    val = digits ? Number(digits).toLocaleString('en-US') : '';
    if(el && el.value !== val){
      el.value = val;
      const end = val.length;
      try{ el.setSelectionRange(end, end); }catch(e){}   // 숫자는 왼→오로 치므로 끝으로 보내면 충분
    }
  }
  view.acctForm[field] = val;
}
function submitAcct(){
  const f = view.acctForm;
  const amt = Number(String(f.amount).replace(/[^0-9.]/g,''));
  if(!amt || amt <= 0) return;               // 빈/0 금액은 무시
  const tx = addTx({ amount:amt, type:f.type, memo:f.memo, date:f.date });
  f.amount = ''; f.memo = '';                // 폼은 열어둔 채 값만(날짜는 유지) 비워 연속 입력
  renderAccount(); renderSheet();
  if(tx) sb.insertTx(tx).catch(()=>{});      // 낙관적 클라우드 반영
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
  else if(act==='acctDel'){ deleteTx(b.dataset.id); renderAccount(); renderSheet(); sb.deleteTx(b.dataset.id).catch(()=>{}); }
});
$('#btnPrev').onclick = ()=>{
  const st = parseYMD(START);
  if(view.y === st.getFullYear() && view.m === st.getMonth()) return;   // 같이 살기 전으론 안 감
  view.m--; if(view.m<0){view.m=11;view.y--;}
  renderCalendar();
};
$('#btnNext').onclick = ()=>{ view.m++; if(view.m>11){view.m=0;view.y++;} renderCalendar(); };
$('#btnCalToday').onclick = ()=>{ const n=new Date(); view.y=n.getFullYear(); view.m=n.getMonth(); renderCalendar(); };

initSettings();

/* ---------- 데이터 갱신 (fetch → 렌더) ---------- */
async function refreshWeather(){
  await fetchWeather();
  renderWeather();
  if(view.sheetMode==='weather') renderSheet();
}

/* ---------- Supabase 동기화 (소스 오브 트루스) ----------
   로컬 캐시로 즉시 렌더한 뒤 클라우드에서 당겨와 수렴시킨다.
   입력/설정 중(시트·다이얼로그 열림)엔 재렌더가 사용자 입력을 지우지 않도록 건너뛴다. */
function syncBusy(){
  return $('#dlg').open || $('#sheetWrap').classList.contains('open');
}
async function syncFromCloud(){
  if(syncBusy()) return;
  // 각 테이블을 독립적으로 반영 — 하나가 실패해도(예: txs 마이그레이션 전) 나머지는 동기화된다
  const [st, txs, checks] = await Promise.allSettled([sb.getSettings(), sb.getTxs(), sb.getChecks()]);
  let changed = false;
  if(st.status === 'fulfilled' && st.value){
    applyRemoteSettings(st.value);
    if(st.value.account && st.value.account.base != null) setBase(st.value.account.base);
    changed = true;
  }
  if(txs.status === 'fulfilled'){ setTxs(txs.value); changed = true; }
  if(checks.status === 'fulfilled'){ applyRemoteChecks(checks.value); changed = true; }
  if(changed) renderAll();
  for(const r of [st, txs, checks])
    if(r.status === 'rejected') console.warn('cloud sync (partial) —', r.reason);
}

/* ---------- 상시 노출: 시계 틱 + 자정 롤오버 + 번인 방지 ---------- */
function tick(){
  renderClock(); applyTheme(); applySleep(); applyShift();   // applyTheme: 18/6시 경계에서 자동 전환
  const nowD = ymd(new Date());
  if(nowD !== view.curDate){
    view.curDate = nowD;
    const n = new Date(); view.y = n.getFullYear(); view.m = n.getMonth();
    renderAll(); refreshWeather();      // 이번 달 합계·달력 리셋
    syncFromCloud();                    // 자정 롤오버 시 클라우드도 재동기화
  }
}
setInterval(tick, 5000);
refreshWeather();                       // 날씨만 로드 즉시 1회
setInterval(refreshWeather, 1800000);   // 날씨 30분마다
syncFromCloud();                        // 클라우드 동기화 즉시 1회
setInterval(syncFromCloud, 60000);      // 60초마다 폰↔태블릿 수렴

/* ---------- 새 배포 자동 반영 ----------
   벽 태블릿은 앱을 24시간 띄워둬서 스스로 다시 받아오는 일이 없다 → 배포해도
   손으로 새로고침하기 전까진 며칠이고 옛 버전이 돈다.
   GitHub Pages 의 ETag 는 `"<배포시각>-<파일크기>"` 라 배포마다 값이 바뀐다.
   index.html 것만 주기적으로 확인해 달라졌으면 새 배포로 보고 리로드한다.
   ※ Pages 는 모든 파일에 max-age=600 을 걸어서 그냥 reload 하면 10분간 옛 JS 가
     캐시에서 나올 수 있다 → cache:'reload' 로 캐시를 먼저 갱신해 두고 리로드. */
const ASSETS = ['index.html', 'styles.css', 'src/main.js', 'src/ui.js', 'src/core.js',
                'src/data.js', 'src/storage.js', 'src/weather.js',
                'src/livingAccount.js', 'src/supabase.js'];
let buildTag = null;

async function liveTag(){
  try{
    const r = await fetch('index.html', { method:'HEAD', cache:'no-store' });
    return r.headers.get('etag') || r.headers.get('last-modified');
  }catch(e){ return null; }            // 오프라인이면 조용히 넘어간다
}
async function checkUpdate(){
  const tag = await liveTag();
  if(!tag) return;
  if(buildTag === null){ buildTag = tag; return; }   // 첫 확인 = 기준값
  if(tag === buildTag) return;
  if(syncBusy()) return;               // 입력/설정 중이면 다음 차례에 (입력 날리지 않기)
  await Promise.allSettled(ASSETS.map(u => fetch(u, { cache:'reload' })));
  location.reload();
}
checkUpdate();
setInterval(checkUpdate, 120000);      // 2분마다

// 심야 모드 깨우기: 어떤 터치든 마지막 터치 시점부터 1분 유지
document.addEventListener('pointerdown', wakeSleep);

// 화면 켜짐 유지 (https 에서 동작, file:// 에선 무시됨)
async function keepAwake(){
  try{ if('wakeLock' in navigator) await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){ keepAwake(); syncFromCloud(); checkUpdate(); }
});
keepAwake();

renderAll();
