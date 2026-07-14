// 상태 + 기본값 + localStorage 영속화. 앱의 최하위 계층 (import 없음).
// 설정(S) / 완료 체크(DONE) / 그날 담당 오버라이드(OVR).
// 스키마 변경 시 키 버전을 올려 구 설정이 새 기본값을 덮지 않게 한다.

export const DEFAULTS = {
  lang:'ko',
  theme:'auto',
  darkStart:21, darkEnd:7,
  sleep:{on:true, start:0, end:6},
  view:'week',
  anchor:'2026-07-01',
  account:{url:''},
  people:{A:{name:'Person A', color:'#6d8dff'}, B:{name:'Person B', color:'#ff85a5'}},
  daily:{trashBathroom:'B', trashRecycle:'A', vacuum:'A', makeBed:'both'},
  laundry:{days:[2,4,6], owner:'B'},
  mop:{day:0, mode:'rotate', first:'B'},
  bathroomClean:{day:6, startWeek:0, first:'A'},
  bedding:{day:6, startWeek:1},
  fridge:{nth:1, day:0, first:'B'},
};

function deepMerge(base, over){
  for(const k in over){
    if(over[k] && typeof over[k]==='object' && !Array.isArray(over[k])
       && base[k] && typeof base[k]==='object' && !Array.isArray(base[k])){
      deepMerge(base[k], over[k]);
    } else { base[k] = over[k]; }
  }
  return base;
}

export function loadSettings(){
  try{
    const raw = JSON.parse(localStorage.getItem('chores-settings-v2') || '{}');
    return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), raw);
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

export let DONE = {};
try{ DONE = JSON.parse(localStorage.getItem('chores-done-v1') || '{}'); }catch(e){}
export function persistDone(){ localStorage.setItem('chores-done-v1', JSON.stringify(DONE)); }

export let OVR = {};
try{ OVR = JSON.parse(localStorage.getItem('chores-ovr-v1') || '{}'); }catch(e){}
export function persistOvr(){ localStorage.setItem('chores-ovr-v1', JSON.stringify(OVR)); }
