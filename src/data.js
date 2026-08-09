// 정적 데이터. 영어 단일 UI. (상태는 storage.js, 로직은 core.js, 뷰는 ui.js)

export const DAY = 86400000;

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const NTH = ['1st', '2nd', '3rd', '4th'];

// 집안일의 이름·아이콘·주기·담당은 이제 전부 설정(S.chores)에 들어 있다.
// 아래는 구 스키마(집안일이 코드에 박혀 있던 시절)를 설정으로 옮길 때 쓰는 이름·아이콘 씨앗.
export const LEGACY_CHORES = {
  trashBathroom:{icon:'trash',    name:'Empty bathroom bin',    short:'Bin'},
  makeBed:      {icon:'bed',      name:'Make the bed',          short:'Bed'},
  trashRecycle: {icon:'recycle',  name:'Trash · recycling',     short:'Trash'},
  vacuum:       {icon:'broom',    name:'Vacuum',                short:'Vac'},
  laundry:      {icon:'basket',   name:'Laundry',               short:'Laundry'},
  mop:          {icon:'droplets', name:'Mopping',               short:'Mop'},
  bathroomClean:{icon:'toilet',   name:'Clean bathroom',        short:'Bath'},
  bedding:      {icon:'bed',      name:'Change · wash bedding', short:'Bedding'},
  fridge:       {icon:'fridge',   name:'Clean fridge',          short:'Fridge'},
};

// 주기 선택지 — 스케줄 엔진이 아는 값 + 설정 세그먼트 라벨
export const FREQS = [
  {v:'daily',    label:'Daily'},
  {v:'weekly',   label:'Weekly'},
  {v:'biweekly', label:'2 weeks'},
  {v:'monthly',  label:'Monthly'},
];

// 집안일 아이콘 후보 (설정에서 고른다)
// ⚠️ Material Symbols 에 실제로 있는 이름만 — 없는 이름은 글자 그대로 렌더된다 ('sink' 사고)
export const CHORE_ICONS = [
  'trash','recycle','broom','bed','basket','droplets','toilet','fridge',
  'dishes','cart','plant','pets','iron','window','tools','soap',
];
