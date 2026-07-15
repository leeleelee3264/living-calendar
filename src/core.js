// 도메인 로직: 날짜 계산·포맷 + 스케줄 엔진.
// 로테이션은 S.anchor 가 포함된 주를 기준으로 센다.
import { DAY, WD, WD_FULL, MON_SHORT } from './data.js';
import { S, OVR } from './storage.js';

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
export function nextBiweekly(cfg){
  const d1 = nextWeekdayDate(cfg.day);
  return mod(weekIndex(d1),2)===cfg.startWeek ? d1 : addDays(d1, 7);
}
export function nextMonthly(cfg){
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  let d = nthWeekday(t0.getFullYear(), t0.getMonth(), cfg.nth, cfg.day);
  if(d < t0) d = nthWeekday(t0.getFullYear(), t0.getMonth()+1, cfg.nth, cfg.day);
  return d;
}

/* ---------- 스케줄 엔진: 특정 날짜의 집안일 목록 + 담당 ---------- */
export function choresFor(d){
  const list = [];
  const wd = d.getDay();
  const wi = weekIndex(d);

  list.push({id:'trashBathroom', who:S.daily.trashBathroom});
  list.push({id:'trashRecycle',  who:S.daily.trashRecycle});
  list.push({id:'vacuum',        who:S.daily.vacuum});
  list.push({id:'makeBed',       who:S.daily.makeBed});

  if(S.laundry.days.includes(wd)) list.push({id:'laundry', who:S.laundry.owner});

  if(wd === S.mop.day){
    const who = S.mop.mode==='fixed' ? S.mop.first : pick(S.mop.first, wi);
    list.push({id:'mop', who});
  }
  const bc = S.bathroomClean;
  if(wd === bc.day && mod(wi,2) === bc.startWeek){
    list.push({id:'bathroomClean', who:pick(bc.first, Math.floor((wi - bc.startWeek)/2))});
  }
  const bd = S.bedding;
  if(wd === bd.day && mod(wi,2) === bd.startWeek) list.push({id:'bedding', who:'both'});

  const ds = ymd(d);
  const fr = S.fridge;
  if(ds === ymd(nthWeekday(d.getFullYear(), d.getMonth(), fr.nth, fr.day)))
    list.push({id:'fridge', who:pick(fr.first, monthIndex(d))});

  // 그날만 담당 스왑(탭) 오버라이드 적용 · base 는 원래 담당 보존
  for(const c of list){
    c.base = c.who;
    const o = OVR[ds+'|'+c.id];
    if(o && c.who !== 'both') c.who = o;
  }
  return list;
}
