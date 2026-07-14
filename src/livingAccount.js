// 생활비 통장 데이터 서비스 · 구글 시트 "웹에 게시(CSV)" URL 을 keyless fetch.
// URL 은 코드가 아니라 설정(S.account.url, localStorage)에 저장 → public repo 에 안 남김.
// 시트 레이아웃:
//   1행: 잔액, 1250000
//   3행: 날짜, 금액, 메모, 누가        ← 헤더
//   4행~: 2026-07-13, 12000, 택시, Ashleigh   (날짜는 YYYY-MM-DD)
import { S } from './storage.js';

export let ACCOUNT = null;
try{ ACCOUNT = JSON.parse(localStorage.getItem('chores-account-v1') || 'null'); }catch(e){}

export function accountData(){ return ACCOUNT; }
export function hasAccountUrl(){ return !!(S.account && S.account.url && S.account.url.trim()); }

// 이번 달 지출 합계
export function thisMonthTotal(){
  if(!ACCOUNT || !ACCOUNT.txs) return 0;
  const n = new Date();
  const pre = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  return ACCOUNT.txs.filter(t=>String(t.date).startsWith(pre)).reduce((s,t)=>s+(t.amount||0), 0);
}
// 최근 n건 (시트 아래쪽이 최신 → 뒤에서 n개)
export function recentTxs(n=5){
  if(!ACCOUNT || !ACCOUNT.txs) return [];
  return ACCOUNT.txs.slice(-n).reverse();
}

/* ---------- CSV 파싱 (따옴표·콤마 포함 필드 처리) ---------- */
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQ = false;
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(inQ){
      if(c === '"'){ if(text[i+1] === '"'){ field += '"'; i++; } else inQ = false; }
      else field += c;
    }else{
      if(c === '"') inQ = true;
      else if(c === ',') { row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}
function num(s){
  if(s == null) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}
// 시트 rows → {balance, txs}. "잔액" 셀 + "날짜" 헤더 이후 거래 행.
function parseSheet(rows){
  let balance = null, inTx = false;
  const txs = [];
  for(const r of rows){
    const a = (r[0] || '').trim();
    if(!inTx){
      if(a === '잔액') balance = num(r[1]);
      else if(a === '날짜') inTx = true;
    }else{
      if(!a) continue;
      const amount = num(r[1]);
      if(amount != null) txs.push({ date:a, amount, memo:(r[2]||'').trim(), who:(r[3]||'').trim() });
    }
  }
  return { balance, txs };
}

export async function fetchAccount(){
  if(!hasAccountUrl()) return ACCOUNT;
  try{
    const r = await fetch(S.account.url.trim());
    if(!r.ok) throw new Error('http '+r.status);
    const { balance, txs } = parseSheet(parseCSV(await r.text()));
    ACCOUNT = { balance, txs, fetchedAt: new Date().toISOString() };
    localStorage.setItem('chores-account-v1', JSON.stringify(ACCOUNT));
  }catch(e){ /* keep last cached ACCOUNT */ }
  return ACCOUNT;
}
