// 도메인 로직: 날짜 계산·포맷 + 스케줄 엔진.
// 로테이션은 S.anchor 가 포함된 주를 기준으로 센다.
import { DAY, WD, WD_FULL, MON_SHORT } from './data.js';
import { S, OVR, DONE } from './storage.js';

/* ---------- 날짜 ---------- */
export function ymd(d){
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}
export function parseYMD(s){ const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }

export function mondayOf(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - (x.getDay()+6)%7);
  return x;
}
export function mod(n, m){ return ((n%m)+m)%m; }

export function weekIndex(d){ return Math.round((mondayOf(d) - mondayOf(parseYMD(S.anchor))) / (7*DAY)); }
export function monthIndex(d){
  const a = parseYMD(S.anchor);
  return (d.getFullYear()-a.getFullYear())*12 + (d.getMonth()-a.getMonth());
}
export function nthWeekday(y, m, nth, wd){
  const first = new Date(y, m, 1);
  return new Date(y, m, 1 + mod(wd - first.getDay(), 7) + (nth-1)*7);
}

// firstId 부터 시작해 번갈아: idx 번째 차례의 담당(A/B)
export function pick(firstId, idx){
  const order = firstId==='A' ? ['A','B'] : ['B','A'];
  return order[mod(idx, 2)];
}
export function otherOf(w){ return w==='A' ? 'B' : 'A'; }

// start~end 시간 구간 포함 여부 (자정을 넘어가는 구간도 처리)
export function inHourRange(h, start, end){
  return start<=end ? (h>=start && h<end) : (h>=start || h<end);
}

export function fmtDate(d){
  return `${WD_FULL[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtShort(d){
  return `${MON_SHORT[d.getMonth()]} ${d.getDate()} (${WD[d.getDay()]})`;
}

export function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
export function nextWeekdayDate(wd){
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return addDays(d, mod(wd - d.getDay(), 7));
}
/* ---------- 스케줄 엔진 ----------
   집안일은 전부 설정(S.chores)에 들어 있고, 주기 타입 4개만 여기서 해석한다.
   집안일마다 특수 분기를 두지 않으므로 설정에서 추가한 집안일도 똑같이 굴러간다. */

// 설정에서 집안일 정의 찾기 (이름·아이콘·주기)
export function choreDef(id){ return (S.chores || []).find(c => c.id === id); }

// 이 집안일이 그날 해당되는가
export function occursOn(c, d){
  const wd = d.getDay();
  if(c.freq === 'daily')    return true;
  if(c.freq === 'weekly')   return (c.days || []).includes(wd);
  if(c.freq === 'biweekly') return wd === c.day && mod(weekIndex(d), 2) === c.startWeek;
  if(c.freq === 'monthly')  return ymd(d) === ymd(nthWeekday(d.getFullYear(), d.getMonth(), c.nth, c.day));
  return false;
}

// 번갈아 하는 집안일이 "몇 번째 차례"인가 (주기마다 세는 단위가 다르다)
export function occIndex(c, d){
  if(c.freq === 'monthly')  return monthIndex(d);
  if(c.freq === 'biweekly') return Math.floor((weekIndex(d) - c.startWeek) / 2);
  if(c.freq === 'weekly')   return weekIndex(d);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - parseYMD(S.anchor)) / DAY);
}

export function ownerOn(c, d){
  return c.owner === 'rotate' ? pick(c.first || 'A', occIndex(c, d)) : c.owner;
}

// 오늘(또는 from) 이후 이 집안일의 다음 날짜 — 설정 화면의 "다음 차례" 표시용
export function nextOccurrence(c, from){
  const n = from || new Date();
  let d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  for(let i=0; i<400; i++){ if(occursOn(c, d)) return d; d = addDays(d, 1); }
  return null;
}

// 사람이 읽는 주기 문구 (체크리스트 부제)
export function freqLabel(c){
  if(c.freq === 'weekly'){
    const n = (c.days || []).length;
    return n === 7 ? 'Every day' : n === 1 ? 'Weekly' : `${n}×/week`;
  }
  if(c.freq === 'biweekly') return 'Biweekly';
  if(c.freq === 'monthly')  return 'Monthly';
  return 'Daily';
}

// 달력 셀에 들어갈 짧은 라벨 — 따로 정해두지 않았으면 이름 첫 단어에서 만든다
export function shortOf(c){
  return c.short || (c.name || '').split(/[\s·]+/)[0].slice(0, 7) || '?';
}

/* 특정 날짜의 집안일 목록 + 담당 */
export function choresFor(d){
  const ds = ymd(d);
  const list = [];
  for(const c of (S.chores || [])){
    if(!occursOn(c, d)) continue;
    const who = ownerOn(c, d);
    // 그날만 담당 스왑(탭) 오버라이드 적용 · base 는 원래 담당 보존
    const o = OVR[ds+'|'+c.id];
    list.push({id:c.id, base:who, who: (o && who !== 'both') ? o : who});
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
