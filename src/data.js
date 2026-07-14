// 정적 데이터 + i18n 문자열. (상태는 storage.js, 로직은 core.js, 뷰는 ui.js)
import { S } from './storage.js';

export const DAY = 86400000;

export const WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
export const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_EN_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const NTH = { ko: ['첫째', '둘째', '셋째', '넷째'], en: ['1st', '2nd', '3rd', '4th'] };

// 집안일 정의 (id → 이모지/한영 이름/주기/매일 여부)
export const CHORES = {
  trashBathroom:{emoji:'🗑️', ko:'화장실 쓰레기통 비우기', en:'Empty bathroom bin',   freq:{ko:'매일',en:'Daily'}, daily:true},
  trashRecycle: {emoji:'♻️', ko:'쓰레기 · 재활용 버리기', en:'Trash & recycling',    freq:{ko:'매일',en:'Daily'}, daily:true},
  vacuum:       {emoji:'🧹', ko:'청소기 돌리기',          en:'Vacuuming',             freq:{ko:'매일',en:'Daily'}, daily:true},
  makeBed:      {emoji:'🛌', ko:'침대 정리하기',          en:'Make the bed',          freq:{ko:'매일',en:'Daily'}, daily:true},
  laundry:      {emoji:'🧺', ko:'빨래',                   en:'Laundry',               freq:{ko:'주 3회 · 돌리기~개기까지',en:'3×/wk · wash to fold'}},
  mop:          {emoji:'🧽', ko:'물걸레질',               en:'Mopping',               freq:{ko:'주 1회',en:'Weekly'}},
  bathroomClean:{emoji:'🚽', ko:'화장실 청소',            en:'Bathroom deep clean',   freq:{ko:'2주에 1번 · 번갈아',en:'Every 2 wks · alternate'}},
  bedding:      {emoji:'🛏️', ko:'침구 갈기 · 세탁',       en:'Change & wash bedding', freq:{ko:'2주에 1번 · 같이',en:'Every 2 wks · together'}},
  fridge:       {emoji:'🧊', ko:'냉장고 청소',            en:'Fridge clean-out',      freq:{ko:'월 1회 · 번갈아',en:'Monthly · alternate'}},
};

export const STR = {
  title:{ko:'리빙 캘린더', en:'Living Calendar'},
  today:{ko:'오늘 할 일', en:"Today's Chores"},
  together:{ko:'같이', en:'Together'},
  allDone:{ko:'🎉 오늘 끝!', en:'🎉 All done!'},
  week:{ko:'이번 주', en:'This Week'},
  month:{ko:'달력', en:'Calendar'},
  upcoming:{ko:'다가오는 일', en:'Coming Up'},
  dToday:{ko:'오늘', en:'Today'},
  dTomorrow:{ko:'내일', en:'Tmrw'},
  todayBtn:{ko:'오늘', en:'Today'},
  swapHint:{ko:'💡 이름표를 누르면 그날만 담당을 맞바꿀 수 있어요 · 체크 표시는 이 기기에만 저장돼요',
            en:'💡 Tap a name tag to swap owners for that day · Check marks are saved on this device only'},
  swapped:{ko:'↔', en:'↔'},
  legendDaily:{ko:'매일 하는 일(🗑️ ♻️ 🧹 🛌)은 달력에서 생략했어요. 날짜를 누르면 그날 전체 목록이 보여요.',
               en:'Daily chores (🗑️ ♻️ 🧹 🛌) are hidden on the calendar. Tap a date to see the full list.'},
  settings:{ko:'설정', en:'Settings'},
  display:{ko:'화면', en:'Display'},
  themeS:{ko:'테마', en:'Theme'},
  thAuto:{ko:'자동', en:'Auto'},
  thLight:{ko:'라이트', en:'Light'},
  thDark:{ko:'다크', en:'Dark'},
  thAutoHelp:{ko:'자동: 아래 시간 동안 어두운 테마로 바뀌어요.', en:'Auto: dark theme during the hours below.'},
  darkHours:{ko:'어두운 시간', en:'Dark hours'},
  sleepS:{ko:'심야 화면 끄기', en:'Night screen-off'},
  sleepHelp:{ko:'심야엔 검은 화면에 시계만 은은하게 떠요. 화면을 탭하면 1분간 다시 보여요. (아이패드 번인 방지)',
             en:'At night the screen goes black with a faint clock. Tap to wake it for a minute. (Prevents burn-in)'},
  onL:{ko:'켬', en:'On'},
  offL:{ko:'끔', en:'Off'},
  people:{ko:'사람', en:'People'},
  dailyFixed:{ko:'매일 하는 일', en:'Daily chores'},
  owner:{ko:'담당', en:'Owner'},
  nextTurn:{ko:'다음 차례', en:'Next turn'},
  foldWhen:{ko:'접기 시점', en:'Fold timing'},
  sameDay:{ko:'같은 날', en:'Same day'},
  nextDay:{ko:'다음 날', en:'Next day'},
  monthPrefix:{ko:'매월', en:'Every month'},
  instantNote:{ko:'변경하면 바로 적용돼요', en:'Changes apply instantly'},
  tapNote:{ko:'이름표를 누르면 담당이 바뀌어요', en:'tap a name tag to switch owners'},
  laundryS:{ko:'빨래 (주 3회)', en:'Laundry (3×/week)'},
  washDays:{ko:'세탁 요일', en:'Wash days'},
  washOwner:{ko:'돌리기+널기 담당', en:'Wash & hang'},
  foldOwner:{ko:'접기 담당', en:'Folding'},
  foldNext:{ko:'접기는 다음 날', en:'Fold next day'},
  mopS:{ko:'물걸레질 (주 1회)', en:'Mopping (weekly)'},
  bathS:{ko:'화장실 청소 (2주 1회)', en:'Bathroom (biweekly)'},
  bedS:{ko:'침구 세탁 (2주 1회 · 같이)', en:'Bedding (biweekly · together)'},
  fridgeS:{ko:'냉장고 청소 (월 1회)', en:'Fridge (monthly)'},
  day:{ko:'요일', en:'Day'},
  nth:{ko:'몇째 주', en:'Week of month'},
  mode:{ko:'방식', en:'Mode'},
  rotate:{ko:'번갈아', en:'Alternate'},
  fixed:{ko:'고정', en:'Fixed'},
  firstOwner:{ko:'첫 담당', en:'First up'},
  startWeek:{ko:'시작 주', en:'Starts'},
  thisWeek:{ko:'기준 주', en:'Anchor week'},
  nextWeek:{ko:'다음 주', en:'Week after'},
  anchorS:{ko:'로테이션 기준일', en:'Rotation anchor'},
  anchorHelp:{ko:'이 날짜가 포함된 주를 기준으로 격주 주기와 담당 순서를 계산해요.',
              en:'Biweekly cycles & turn order are counted from the week containing this date.'},
  save:{ko:'저장', en:'Save'},
  close:{ko:'닫기', en:'Close'},
  reset:{ko:'설정 초기화', en:'Reset settings'},
  resetQ:{ko:'설정을 기본값으로 되돌릴까요?', en:'Reset all settings to default?'},
};

// 현재 언어(S.lang) 기준 문자열 조회
export function t(key){ return STR[key][S.lang]; }
