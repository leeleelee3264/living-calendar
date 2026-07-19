// Supabase 백엔드 — PostgREST raw fetch 로 2인 홈 보드 동기화.
// anon key 는 공개용(RLS 로 보호, 민감정보 없음). service_role 은 절대 클라이언트에 넣지 않는다.
// 테이블: txs(생활비 거래) · checks(완료 체크 공유) · settings(id=1 싱글톤 jsonb = 전체 설정 미러).

const URL  = 'https://ivxbpxmwvmjdtqreyizd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2eGJweG13dm1qZHRxcmV5aXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODk2OTUsImV4cCI6MjA5NjA2NTY5NX0.yYlB77c-M_2_6jRwYQGdaxYpIQ-5sm_EJC5AQ1nO7wQ';
const REST = URL + '/rest/v1';
const HEAD = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' };

async function req(path, opts = {}){
  const r = await fetch(REST + path, { ...opts, headers: { ...HEAD, ...(opts.headers || {}) } });
  if(!r.ok) throw new Error('supabase ' + r.status + ' ' + await r.text());
  if(r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const enc = encodeURIComponent;

/* ---------- settings (id=1 싱글톤) ---------- */
export async function getSettings(){
  const rows = await req('/settings?id=eq.1&select=data');
  return rows && rows[0] ? rows[0].data : null;
}
export async function putSettings(data){
  await req('/settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, data }),
  });
}

/* ---------- txs (생활비 거래) ---------- */
export async function getTxs(){
  return (await req('/txs?select=id,date,amount,type,memo&order=created_at.asc')) || [];
}
export async function insertTx(tx){
  await req('/txs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(tx),
  });
}
export async function deleteTx(id){
  await req('/txs?id=eq.' + enc(id), { method: 'DELETE' });
}

/* ---------- checks (완료 체크 공유) ---------- */
export async function getChecks(){
  return (await req('/checks?select=date,chore_id&done=is.true')) || [];
}
export async function putCheck(date, choreId){
  await req('/checks?on_conflict=date,chore_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ date, chore_id: choreId, done: true }),
  });
}
export async function delCheck(date, choreId){
  await req('/checks?date=eq.' + enc(date) + '&chore_id=eq.' + enc(choreId), { method: 'DELETE' });
}
