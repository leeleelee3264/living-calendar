// 날씨 데이터 서비스 · Open-Meteo (무료 · API 키 불필요 · CORS 열려 있음)
// 서울 고정. 성공 시 캐시 갱신, 실패 시 마지막 캐시 유지. 렌더링은 호출측(ui)에서.
// ※ 앞으로 생활비 시트/Supabase 동기화 등 데이터 서비스가 이 옆에 추가됨.
import { ymd } from './core.js';

const WX_LAT = 37.5665, WX_LON = 126.9780;

export let WX = null;
try{ WX = JSON.parse(localStorage.getItem('chores-weather-v2') || 'null'); }catch(e){}

// 지금 시각(정시) 스탬프 "YYYY-MM-DDTHH:00"
export function nowStamp(){
  const n = new Date();
  return ymd(n) + 'T' + String(n.getHours()).padStart(2,'0') + ':00';
}

// 지금 시각부터 앞으로 24시간 구간
export function wx24(){
  if(!WX || !WX.hours || !WX.hours.length) return null;
  const s = nowStamp();
  let i = WX.hours.findIndex(x => x.t >= s);
  if(i < 0) i = 0;
  return WX.hours.slice(i, i+24);
}

// WMO weather code → {emoji, ko, en, precip}
export function wxInfo(c){
  const P = true, N = false;
  const M = {
    0:['☀️','맑음','Clear',N], 1:['🌤️','대체로 맑음','Mostly clear',N],
    2:['⛅','구름 조금','Partly cloudy',N], 3:['☁️','흐림','Overcast',N],
    45:['🌫️','안개','Fog',N], 48:['🌫️','서리 안개','Rime fog',N],
    51:['🌦️','약한 이슬비','Light drizzle',P], 53:['🌦️','이슬비','Drizzle',P], 55:['🌦️','짙은 이슬비','Dense drizzle',P],
    56:['🌧️','어는 이슬비','Freezing drizzle',P], 57:['🌧️','어는 이슬비','Freezing drizzle',P],
    61:['🌧️','약한 비','Light rain',P], 63:['🌧️','비','Rain',P], 65:['🌧️','강한 비','Heavy rain',P],
    66:['🌧️','어는 비','Freezing rain',P], 67:['🌧️','어는 비','Freezing rain',P],
    71:['🌨️','약한 눈','Light snow',P], 73:['🌨️','눈','Snow',P], 75:['🌨️','강한 눈','Heavy snow',P],
    77:['🌨️','싸락눈','Snow grains',P],
    80:['🌦️','약한 소나기','Light showers',P], 81:['🌧️','소나기','Showers',P], 82:['⛈️','강한 소나기','Heavy showers',P],
    85:['🌨️','소낙눈','Snow showers',P], 86:['🌨️','강한 소낙눈','Heavy snow showers',P],
    95:['⛈️','뇌우','Thunderstorm',P], 96:['⛈️','우박 뇌우','Thunder w/ hail',P], 99:['⛈️','강한 우박 뇌우','Severe thunder',P],
  };
  const e = M[c] || ['❓','—','—',N];
  return {emoji:e[0], ko:e[1], en:e[2], precip:e[3]};
}

// 대표 날씨 = "궂은 날씨 우선": 구간 중 비/눈이 한 번이라도 있으면 가장 심한 것, 없으면 지금 날씨
export function repWeather(win){
  const sev = c =>
    c>=95 ? 5 : ((c>=71&&c<=77)||c===85||c===86) ? 4 :
    ((c>=61&&c<=67)||(c>=80&&c<=82)) ? 3 : (c>=51&&c<=57) ? 2 : 0;
  let worst = null;
  for(const x of win){ if(sev(x.code)>0 && (!worst || sev(x.code)>sev(worst.code))) worst = x; }
  if(worst) return worst.code;
  return win[0] ? win[0].code : 0;
}

export async function fetchWeather(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WX_LAT}&longitude=${WX_LON}`
      + `&timezone=Asia%2FSeoul&forecast_days=2`
      + `&hourly=weather_code,temperature_2m,precipitation_probability`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('http '+r.status);
    const j = await r.json();
    const hours = j.hourly.time.map((tm,i)=>({
      t: tm,                    // "2026-07-05T14:00"
      date: tm.slice(0,10),     // "2026-07-05"
      h: Number(tm.slice(11,13)),
      code: j.hourly.weather_code[i],
      temp: Math.round(j.hourly.temperature_2m[i]),
      pop: j.hourly.precipitation_probability ? j.hourly.precipitation_probability[i] : null,
    }));
    WX = { fetchedAt: nowStamp(), hours };
    localStorage.setItem('chores-weather-v2', JSON.stringify(WX));
  }catch(e){ /* keep last cached WX */ }
  return WX;
}
