// 도메인 로직: 날짜 계산·포맷 + 스케줄 엔진.
import { DAY, WD_FULL, MON_SHORT, EVENTS, START } from './data.js';
import { S, OVR, DONE } from './storage.js';

/* ---------- 날짜 ---------- */
export function ymd(d){
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}
export function parseYMD(s){ const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }




// start~end 시간 구간 포함 여부 (자정을 넘어가는 구간도 처리)
export function inHourRange(h, start, end){
  return start<=end ? (h>=start && h<end) : (h>=start || h<end);
}

export function fmtDate(d){
  return `${WD_FULL[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
/* ---------- 스케줄 엔진 ----------
   집안일은 전부 설정(S.chores)에 들어 있고, 주기 타입 4개만 여기서 해석한다.
   집안일마다 특수 분기를 두지 않으므로 설정에서 추가한 집안일도 똑같이 굴러간다. */

// 설정에서 집안일 정의 찾기 (이름·아이콘·주기)
export function choreDef(id){ return (S.chores || []).find(c => c.id === id); }

// 같이 살기 시작한 날 이전인가 (그 앞은 달력에 아무것도 안 띄운다)
export function beforeStart(d){ return d < parseYMD(START); }

// 이 집안일이 그날 해당되는가.
// 격주·매월은 "시작 날짜" 하나로 정해진다 — 그 날짜의 요일(격주) / 그 날짜의 일(매월)이 규칙.
export function occursOn(c, d){
  if(c.freq === 'daily')  return true;
  if(c.freq === 'weekly') return (c.days || []).includes(d.getDay());
  if(!c.start) return false;
  const s = parseYMD(c.start);
  if(d < s) return false;
  if(c.freq === 'biweekly') return Math.round((d - s) / DAY) % 14 === 0;
  if(c.freq === 'monthly'){
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    return d.getDate() === Math.min(s.getDate(), last);   // 31일 시작 → 짧은 달은 말일
  }
  return false;
}


// 사람이 읽는 주기 문구 (체크리스트 부제 · 설정 힌트)
export function freqLabel(c){
  if(c.freq === 'weekly'){
    const n = (c.days || []).length;
    return n === 7 ? 'Every day' : n === 1 ? 'Weekly' : `${n}×/week`;
  }
  if(c.freq === 'biweekly'){
    const s = c.start ? parseYMD(c.start) : null;
    return s ? `Every 2 weeks on ${WD_FULL[s.getDay()]}` : 'Every 2 weeks';
  }
  if(c.freq === 'monthly'){
    const s = c.start ? parseYMD(c.start) : null;
    return s ? `Monthly on the ${ordinal(s.getDate())}` : 'Monthly';
  }
  return 'Daily';
}
export function ordinal(n){
  const t = n % 100;
  if(t >= 11 && t <= 13) return n + 'th';
  return n + ({1:'st', 2:'nd', 3:'rd'}[n % 10] || 'th');
}

/* ---------- 매달 같은 날 돌아오는 돈 일정 (집안일 아님) ---------- */
export function eventsFor(d){
  if(beforeStart(d)) return [];
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  return EVENTS.filter(e => d.getDate() === Math.min(e.day, last));
}

// 달력 셀에 들어갈 짧은 라벨 — 따로 정해두지 않았으면 이름 첫 단어에서 만든다
export function shortOf(c){
  return c.short || (c.name || '').split(/[\s·]+/)[0].slice(0, 7) || '?';
}

/* 특정 날짜의 집안일 목록 + 담당 */
export function choresFor(d){
  if(beforeStart(d)) return [];
  const ds = ymd(d);
  const list = [];
  for(const c of (S.chores || [])){
    if(!occursOn(c, d)) continue;
    // 그날만 담당 스왑(탭) 오버라이드 적용 · base 는 원래 담당 보존
    const o = OVR[ds+'|'+c.id];
    list.push({id:c.id, base:c.owner, who: o || c.owner});
  }
  return list;
}

/* ---------- "다 했다" 판정 + 연속 완료(스트릭) ----------
   체크(DONE)는 Supabase `checks` 가 소스라 두 사람이 뭘 했든 같은 결과가 나온다. */

// 그날 해야 할 집안일을 하나도 안 남기고 다 체크했는가
export function allDone(d){
  const ds = ymd(d);
  const list = choresFor(d);
  return list.length > 0 && list.every(c => DONE[ds+'|'+c.id]);
}

// d 부터 하루씩 거슬러 올라가며 "다 한 날"이 며칠 연속인지. 빠진 날을 만나면 멈춘다.
export function streakBack(d, cap=400){
  let x = d, n = 0;
  while(n < cap && allDone(x)){ n++; x = addDays(x, -1); }
  return n;
}

// 오늘 기준 연속 일수. 오늘이 아직 진행 중이면 어제까지로 세서,
// 하루 중에 스트릭이 0으로 떨어져 보이지 않게 한다.
export function currentStreak(){
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return allDone(today) ? streakBack(today) : streakBack(addDays(today, -1));
}
