// 생활비 통장 — 보드 자체가 원본(source of truth).
// 입력·수정·삭제 모두 앱 안에서 처리하고 localStorage 에 저장한다. (구글 시트 연동 없음)
// v1 은 시트 CSV 캐시였고, v2 는 자체 장부라 키를 올렸다.
//   base : 시작 잔액
//   txs  : [{ id, date:'YYYY-MM-DD', amount(>0), type:'out'|'in', memo }]
//   잔액 = base − Σ(지출 out) + Σ(입금 in)
// 다른 모듈에 의존하지 않는 리프 모듈.

const KEY = 'chores-account-v2';

function load(){
  try{
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(a && typeof a === 'object'){
      return { base: Number(a.base) || 0, txs: Array.isArray(a.txs) ? a.txs : [] };
    }
  }catch(e){}
  return { base: 0, txs: [] };
}

export let ACCOUNT = load();
function persist(){ localStorage.setItem(KEY, JSON.stringify(ACCOUNT)); }

export function accountData(){ return ACCOUNT; }

// 현재 잔액 = 시작 잔액에서 지출을 빼고 입금을 더한 값
export function balance(){
  return ACCOUNT.txs.reduce(
    (s, t) => s + (t.type === 'in' ? (t.amount || 0) : -(t.amount || 0)),
    ACCOUNT.base || 0,
  );
}

// 이번 달 지출(out) 합계
export function thisMonthTotal(){
  const n = new Date();
  const pre = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  return ACCOUNT.txs
    .filter(t => t.type !== 'in' && String(t.date).startsWith(pre))
    .reduce((s, t) => s + (t.amount || 0), 0);
}

// 최근 n건 (뒤에 추가된 게 최신 → 뒤에서 n개, 최신순)
export function recentTxs(n = 8){ return ACCOUNT.txs.slice(-n).reverse(); }

function monthPrefix(){
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
// 이번 달 거래 전부 (최신순) — 상세 시트에서 이번 달 지출을 모두 보여주기 위함
export function monthTxs(){
  const pre = monthPrefix();
  return ACCOUNT.txs.filter(t => String(t.date).startsWith(pre)).reverse();
}
// 이번 달 이전 거래 전부 (최신순)
export function earlierTxs(){
  const pre = monthPrefix();
  return ACCOUNT.txs.filter(t => !String(t.date).startsWith(pre)).reverse();
}

function ymdToday(){
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}
function newId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// 거래 추가 — 금액은 항상 양수로 저장하고 type 으로 방향을 구분한다
export function addTx({ amount, type = 'out', memo = '', date } = {}){
  const amt = Math.abs(Number(amount)) || 0;
  if(amt <= 0) return null;
  const tx = {
    id: newId(),
    date: date || ymdToday(),
    amount: amt,
    type: type === 'in' ? 'in' : 'out',
    memo: String(memo || '').trim(),
  };
  ACCOUNT.txs.push(tx);
  persist();
  return tx;
}

export function deleteTx(id){
  const i = ACCOUNT.txs.findIndex(t => t.id === id);
  if(i >= 0){ ACCOUNT.txs.splice(i, 1); persist(); }
}

// 시작 잔액 설정 (설정 다이얼로그에서 호출)
export function setBase(n){ ACCOUNT.base = Number(n) || 0; persist(); }

// 클라우드(Supabase txs)에서 받은 거래로 로컬 장부를 교체 — 정규화 후 캐시.
export function setTxs(rows){
  ACCOUNT.txs = Array.isArray(rows) ? rows.map(t => ({
    id: String(t.id),
    date: String(t.date),
    amount: Math.abs(Number(t.amount)) || 0,
    type: t.type === 'in' ? 'in' : 'out',
    memo: String(t.memo || ''),
  })) : [];
  persist();
}
