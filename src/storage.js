// 상태 + 기본값 + localStorage 영속화. 앱의 최하위 계층 (data.js 상수만 참조).
// 설정(S) / 완료 체크(DONE) / 그날 담당 오버라이드(OVR).
// 스키마 변경 시 키 버전을 올려 구 설정이 새 기본값을 덮지 않게 한다.
import { LEGACY_CHORES } from './data.js';

// 집안일 1개 = {id, name, icon, short?, freq, owner, + 주기별 필드}
//   freq 'daily'    → 추가 필드 없음
//        'weekly'   → days:[0~6]           (여러 요일 가능)
//        'biweekly' → day:0~6, startWeek:0|1
//        'monthly'  → nth:1~4, day:0~6     (매월 n번째 무슨 요일)
//   owner 'A'|'B'   → 고정 담당
//         'both'    → 같이
//         'rotate'  → 번갈아 (first = 첫 차례 담당)
export const DEFAULTS = {
  accent:'#7ec8a3',
  theme:'auto',                       // 'auto'(시간대 기반: 낮 라이트 / 저녁·밤 다크) | 'light' | 'dark'
  sleep:{on:true, start:23, end:6},   // 심야 검정 오버레이(번인방지): 23시~6시
  anchor:'2026-07-01',
  people:{A:{name:'Person A', color:'#6d8dff'}, B:{name:'Person B', color:'#ff85a5'}},
  chores:[
    {id:'trashBathroom', name:'Empty bathroom bin',    icon:'trash',    short:'Bin',     freq:'daily',    owner:'B'},
    {id:'makeBed',       name:'Make the bed',          icon:'bed',      short:'Bed',     freq:'daily',    owner:'both'},
    {id:'trashRecycle',  name:'Trash · recycling',     icon:'recycle',  short:'Trash',   freq:'weekly',   days:[1,3,6], owner:'A'},
    {id:'vacuum',        name:'Vacuum',                icon:'broom',    short:'Vac',     freq:'weekly',   days:[1,3,6], owner:'A'},
    {id:'laundry',       name:'Laundry',               icon:'basket',   short:'Laundry', freq:'weekly',   days:[1,3,6], owner:'B'},
    {id:'mop',           name:'Mopping',               icon:'droplets', short:'Mop',     freq:'weekly',   days:[0],     owner:'rotate', first:'B'},
    {id:'bathroomClean', name:'Clean bathroom',        icon:'toilet',   short:'Bath',    freq:'biweekly', day:6, startWeek:0, owner:'A'},
    {id:'bedding',       name:'Change · wash bedding', icon:'bed',      short:'Bedding', freq:'biweekly', day:6, startWeek:1, owner:'B'},
    {id:'fridge',        name:'Clean fridge',          icon:'fridge',   short:'Fridge',  freq:'monthly',  nth:1, day:0,      owner:'rotate', first:'B'},
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

// 구 스키마 이관 + 방어. 설정을 한 번이라도 저장하면 새 모양이 올라가 이 분기는 더 안 탄다.
function migrate(s, raw){
  raw = raw || {};
  // 판단 기준은 "저장된 값이 구 모양이냐" 다. s.chores 로 보면 DEFAULTS 가 항상 채워져 있어서
  // 구 설정을 덮어써 버린다 (스케줄이 통째로 기본값으로 바뀜)
  const isLegacy = !Array.isArray(raw.chores) && LEGACY_KEYS.some(k => raw[k]);
  if(isLegacy) s.chores = legacyChores(raw);
  for(const k of LEGACY_KEYS) delete s[k];      // 더는 안 읽히는 잔재
  // 주기별 필수 필드가 비어 있으면 채운다 (직접 편집·부분 동기화 대비)
  for(const c of s.chores) fillFreq(c);
  return s;
}

// 주기를 바꾸면 그 주기가 요구하는 필드를 채워 준다. (설정 UI 에서도 재사용)
export function fillFreq(c){
  if(c.freq==='weekly' && !(Array.isArray(c.days) && c.days.length)) c.days = [1];
  if(c.freq==='biweekly'){ if(c.day==null) c.day = 6; if(c.startWeek==null) c.startWeek = 0; }
  if(c.freq==='monthly'){ if(c.nth==null) c.nth = 1; if(c.day==null) c.day = 0; }
  if(c.owner==='rotate' && !c.first) c.first = 'A';
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
