// 정적 데이터. 한국어 단일 UI. (상태는 storage.js, 로직은 core.js, 뷰는 ui.js)

export const DAY = 86400000;

export const WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
export const NTH = ['첫째', '둘째', '셋째', '넷째'];

// 집안일 정의 (id → 라인아이콘 이름/이름/주기/매일 여부/달력 축약 라벨)
export const CHORES = {
  trashBathroom:{icon:'trash',    ko:'화장실 쓰레기통 비우기', freq:'매일', daily:true},
  trashRecycle: {icon:'recycle',  ko:'쓰레기 · 재활용 버리기', freq:'매일', daily:true},
  vacuum:       {icon:'broom',    ko:'청소기 돌리기',          freq:'매일', daily:true},
  makeBed:      {icon:'bed',      ko:'침대 정리하기',          freq:'매일', daily:true},
  laundry:      {icon:'basket',   ko:'빨래',                   freq:'주 3회 · 돌리기~개기까지', short:'빨래'},
  mop:          {icon:'droplets', ko:'물걸레질',               freq:'주 1회',                   short:'물걸레'},
  bathroomClean:{icon:'toilet',   ko:'화장실 청소',            freq:'2주에 1번 · 번갈아',       short:'화장실'},
  bedding:      {icon:'bed',      ko:'침구 갈기 · 세탁',       freq:'2주에 1번 · 같이',         short:'침구'},
  fridge:       {icon:'fridge',   ko:'냉장고 청소',            freq:'월 1회 · 번갈아',          short:'냉장고'},
};
