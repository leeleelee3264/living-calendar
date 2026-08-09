// 상태 + 기본값 + localStorage 영속화. 앱의 최하위 계층 (data.js 상수만 참조).
// 설정(S) / 완료 체크(DONE) / 그날 담당 오버라이드(OVR).
// 스키마 변경 시 키 버전을 올려 구 설정이 새 기본값을 덮지 않게 한다.
import { LEGACY_CHORES, START, ACCENTS } from './data.js';

// 집안일 1개 = {id, name, icon, short, freq, owner, + 주기별 필드}
//   freq 'daily'    → 추가 필드 없음
//        'weekly'   → days:[0~6]     (여러 요일 가능)
//        'biweekly' → start:'YYYY-MM-DD' — 그 날짜의 요일로 2주마다
//        'monthly'  → start:'YYYY-MM-DD' — 그 날짜의 '일'로 매달 (말일 넘으면 그 달 마지막 날)
//   owner 'A'|'B'   — 담당은 둘 중 하나뿐이다 (같이/번갈아 없음)
export const DEFAULTS = {
  accent:'#c9a2e0',
  theme:'auto',                       // 'auto'(시간대 기반: 낮 라이트 / 저녁·밤 다크) | 'light' | 'dark'
  sleep:{on:true, start:23, end:6},   // 심야 검정 오버레이(번인방지): 23시~6시
  anchor:'2026-07-01',
  people:{A:{name:'Person A', color:'#5b8def'}, B:{name:'Person B', color:'#5eb87b'}},
  chores:[
    {id:'trashBathroom', name:'Empty bathroom bin',    icon:'trash',    short:'Bin',     freq:'daily',    owner:'B'},
    {id:'makeBed',       name:'Make the bed',          icon:'bed',      short:'Bed',     freq:'daily',    owner:'B'},
    {id:'trashRecycle',  name:'Trash · recycling',     icon:'recycle',  short:'Trash',   freq:'weekly',   days:[1,3,6], owner:'A'},
    {id:'vacuum',        name:'Vacuum',                icon:'broom',    short:'Vac',     freq:'weekly',   days:[1,3,6], owner:'A'},
    {id:'laundry',       name:'Laundry',               icon:'basket',   short:'Laundry', freq:'weekly',   days:[1,3,6], owner:'B'},
    {id:'mop',           name:'Mopping',               icon:'droplets', short:'Mop',     freq:'weekly',   days:[0],     owner:'A'},
    {id:'bathroomClean', name:'Clean bathroom',        icon:'toilet',   short:'Bath',    freq:'biweekly', start:'2026-07-04', owner:'A'},
    {id:'bedding',       name:'Change · wash bedding', icon:'bed',      short:'Bedding', freq:'biweekly', start:'2026-07-12', owner:'B'},
    {id:'fridge',        name:'Clean fridge',          icon:'fridge',   short:'Fridge',  freq:'monthly',  start:'2026-07-05', owner:'B'},
  ],
};

// 집안일이 코드에 박혀 있던 시절의 설정 모양. 이관(migrate)에서만 쓴다.
const LEGACY_DEFAULTS = {
  daily:{trashBathroom:'B', makeBed:'both'},
  trashRecycle:{days:[2,4,6], owner:'A'},
  vacuum:{days:[2,4,6], owner:'A'},
  laundry:{days:[2,4,6], owner:'B'},
  mop:{day:0, mode:'rotate', first:'B'},
  bathroomClean:{day:6, startWeek:0, owner:'A', first:'A'},
  bedding:{day:6, startWeek:1, owner:'B'},
  fridge:{nth:1, day:0, first:'B'},
};
const LEGACY_KEYS = Object.keys(LEGACY_DEFAULTS);

function deepMerge(base, over){
  for(const k in over){
    if(over[k] && typeof over[k]==='object' && !Array.isArray(over[k])
       && base[k] && typeof base[k]==='object' && !Array.isArray(base[k])){
      deepMerge(base[k], over[k]);
    } else { base[k] = over[k]; }
  }
  return base;
}

// 집안일이 코드에 박혀 있던 시절(키마다 모양이 다 달랐다) → 설정 안의 chores 배열 하나로 이관.
// 예전 값(요일·담당·번갈아 여부)을 그대로 물려받으므로 사용자 눈에 보이는 스케줄은 안 바뀐다.
// id 를 유지하기 때문에 완료 체크(date|chore_id)와 스트릭 기록도 전부 보존된다.
function legacyChores(raw){
  const L = deepMerge(JSON.parse(JSON.stringify(LEGACY_DEFAULTS)), raw || {});
  // 쓰레기·청소기가 daily 였던 더 옛날 스키마 → 빨래와 같은 요일, 담당은 daily 값 승계
  if(!raw.trashRecycle) L.trashRecycle = {days:[...L.laundry.days], owner: L.daily.trashRecycle || 'A'};
  if(!raw.vacuum)       L.vacuum       = {days:[...L.laundry.days], owner: L.daily.vacuum       || 'A'};

  const def = id => ({id, ...LEGACY_CHORES[id]});
  return [
    {...def('trashBathroom'), freq:'daily',  owner:L.daily.trashBathroom},
    {...def('makeBed'),       freq:'daily',  owner:L.daily.makeBed},
    {...def('trashRecycle'),  freq:'weekly', days:[...L.trashRecycle.days], owner:L.trashRecycle.owner},
    {...def('vacuum'),        freq:'weekly', days:[...L.vacuum.days],       owner:L.vacuum.owner},
    {...def('laundry'),       freq:'weekly', days:[...L.laundry.days],      owner:L.laundry.owner},
    // 물걸레질만 '번갈아' 모드를 쓰고 있었다
    {...def('mop'), freq:'weekly', days:[L.mop.day],
      ...(L.mop.mode==='fixed' ? {owner:L.mop.first} : {owner:'rotate', first:L.mop.first})},
    {...def('bathroomClean'), freq:'biweekly', day:L.bathroomClean.day, startWeek:L.bathroomClean.startWeek,
      owner:L.bathroomClean.owner || 'A'},
    {...def('bedding'), freq:'biweekly', day:L.bedding.day, startWeek:L.bedding.startWeek,
      owner:L.bedding.owner || 'B'},
    {...def('fridge'), freq:'monthly', nth:L.fridge.nth, day:L.fridge.day, owner:'rotate', first:L.fridge.first},
  ];
}

/* ---------- 이관용 날짜 헬퍼 ----------
   core.js 를 쓰고 싶지만 core 가 이 파일을 import 하므로(순환) 여기서 최소한만 다시 만든다. */
const DAYMS = 86400000;
const ymdL   = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseL = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
const addL   = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const modL   = (n,m) => ((n%m)+m)%m;
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const mondayL = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - (x.getDay()+6)%7); return x; };
const weekIdxL  = (d,a) => Math.round((mondayL(d) - mondayL(parseL(a))) / (7*DAYMS));
const monthIdxL = (d,a) => { const x = parseL(a); return (d.getFullYear()-x.getFullYear())*12 + (d.getMonth()-x.getMonth()); };
const nthWdL = (y,m,nth,wd) => { const f = new Date(y,m,1); return new Date(y,m,1 + modL(wd-f.getDay(),7) + (nth-1)*7); };

// 구 규칙(요일+주 패리티 / 몇째주 무슨요일)에서 from 이후 첫 차례 날짜
function firstOld(c, anchor, from){
  const t = from || today0();
  if(c.freq === 'biweekly'){
    let d = addL(t, modL(c.day - t.getDay(), 7));
    if(modL(weekIdxL(d, anchor), 2) !== c.startWeek) d = addL(d, 7);
    return d;
  }
  if(c.freq === 'monthly'){
    let d = nthWdL(t.getFullYear(), t.getMonth(), c.nth, c.day);
    if(d < t) d = nthWdL(t.getFullYear(), t.getMonth()+1, c.nth, c.day);
    return d;
  }
  for(let i=0; i<400; i++){ const d = addL(t,i); if((c.days||[]).includes(d.getDay())) return d; }
  return t;
}

// 담당이 '번갈아' 였던 집안일 → 다음 차례가 원래 누구였는지로 고정한다 (당장의 순번이 안 바뀜)
function rotateOwnerNow(c, anchor){
  const d = firstOld(c, anchor);   // 오늘 이후 다음 차례
  const idx = c.freq==='monthly'  ? monthIdxL(d, anchor)
            : c.freq==='biweekly' ? Math.floor((weekIdxL(d, anchor) - c.startWeek)/2)
            : c.freq==='weekly'   ? weekIdxL(d, anchor)
            : Math.round((d - parseL(anchor)) / DAYMS);
  const order = (c.first==='A') ? ['A','B'] : ['B','A'];
  return order[modL(idx, 2)];
}

// 집안일 하나를 현재 모양으로 정규화:
//   격주/매월의 (요일+패리티 / 몇째주) → 시작 날짜 하나로   ·   담당 both/번갈아 → A|B 로
function normalizeChore(c, anchor){
  if(c.owner === 'rotate') c.owner = rotateOwnerNow(c, anchor);
  if(c.owner === 'both' || (c.owner !== 'A' && c.owner !== 'B')) c.owner = 'B';   // 같이 하던 건 Ashleigh 로
  delete c.first;

  if(c.freq === 'biweekly' || c.freq === 'monthly'){
    // 시작일은 "오늘 이후 다음 차례"가 아니라 **같이 살기 시작한 날 이후 첫 차례**로 잡는다.
    // 다음 차례로 잡으면 이미 지나간 날들(과거 달력·완료 기록)에서 이 집안일이 사라진다.
    if(!c.start) c.start = ymdL(firstOld(c, anchor, parseL(START)));
  }
  delete c.day; delete c.startWeek; delete c.nth;
  return fillFreq(c);
}

// 구 스키마 이관 + 방어. 설정을 한 번이라도 저장하면 새 모양이 올라가 이 분기는 더 안 탄다.
function migrate(s, raw){
  raw = raw || {};
  // 판단 기준은 "저장된 값이 구 모양이냐" 다. s.chores 로 보면 DEFAULTS 가 항상 채워져 있어서
  // 구 설정을 덮어써 버린다 (스케줄이 통째로 기본값으로 바뀜)
  const isLegacy = !Array.isArray(raw.chores) && LEGACY_KEYS.some(k => raw[k]);
  if(isLegacy) s.chores = legacyChores(raw);
  for(const k of LEGACY_KEYS) delete s[k];      // 더는 안 읽히는 잔재
  for(const c of s.chores) normalizeChore(c, s.anchor || START);

  // 승민 = 파랑 (이름·색 편집 UI 가 없으므로 예전 분홍은 여기서 한 번 갈아준다)
  if(s.people && s.people.A && s.people.A.color === '#ff85a5') s.people.A.color = '#5b8def';
  // 포인트 색이 사람 색과 겹치던 것(파랑·노랑)은 후보에서 빠졌다 → 기본값으로 되돌린다
  if(!ACCENTS.includes(s.accent)) s.accent = DEFAULTS.accent;
  return s;
}

// 주기가 요구하는 필드를 채워 준다. (설정 UI 에서 주기를 바꿀 때도 재사용)
export function fillFreq(c){
  if(c.freq==='weekly' && !(Array.isArray(c.days) && c.days.length)) c.days = [new Date().getDay()];
  if((c.freq==='biweekly' || c.freq==='monthly') && !c.start) c.start = ymdL(today0());
  if(c.freq!=='weekly') delete c.days;
  if(c.freq==='daily') delete c.start;
  return c;
}

export function loadSettings(){
  try{
    const raw = JSON.parse(localStorage.getItem('chores-settings-v2') || '{}');
    return migrate(deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), raw), raw);
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); }
}

// 라이브 바인딩: 다른 모듈은 항상 S.xxx 로 접근하고 S 자체를 캐시하지 않는다.
export let S = loadSettings();
export function saveSettings(){ localStorage.setItem('chores-settings-v2', JSON.stringify(S)); }
export function resetSettings(){
  localStorage.removeItem('chores-settings-v2');
  S = loadSettings();
  return S;
}

// 클라우드(Supabase) 설정을 소스 오브 트루스로 반영: DEFAULTS 위에 원격 값을 얹고 로컬 캐시 갱신.
// 이름(people)·스케줄·테마·포인트색이 여기서 들어온다. (base 는 livingAccount 가 별도 처리)
export function applyRemoteSettings(data){
  if(!data || typeof data !== 'object') return;
  S = migrate(deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), data), data);
  saveSettings();
}

export let DONE = {};
try{ DONE = JSON.parse(localStorage.getItem('chores-done-v1') || '{}'); }catch(e){}
export function persistDone(){ localStorage.setItem('chores-done-v1', JSON.stringify(DONE)); }
// 클라우드 체크를 반영: 'date|chore_id' 맵으로 재구성하고 로컬 캐시 갱신.
export function applyRemoteChecks(rows){
  DONE = {};
  for(const r of (rows || [])) DONE[r.date + '|' + r.chore_id] = 1;
  persistDone();
}

export let OVR = {};
try{ OVR = JSON.parse(localStorage.getItem('chores-ovr-v1') || '{}'); }catch(e){}
export function persistOvr(){ localStorage.setItem('chores-ovr-v1', JSON.stringify(OVR)); }
