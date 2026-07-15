// 정적 데이터. 영어 단일 UI. (상태는 storage.js, 로직은 core.js, 뷰는 ui.js)

export const DAY = 86400000;

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const NTH = ['1st', '2nd', '3rd', '4th'];

// 집안일 정의 (id → 라인아이콘 이름/이름/주기/매일 여부/달력 축약 라벨)
export const CHORES = {
  trashBathroom:{icon:'trash',    name:'Empty bathroom bin',   freq:'Daily', daily:true},
  trashRecycle: {icon:'recycle',  name:'Trash · recycling',    freq:'Daily', daily:true},
  vacuum:       {icon:'broom',    name:'Vacuum',               freq:'Daily', daily:true},
  makeBed:      {icon:'bed',      name:'Make the bed',         freq:'Daily', daily:true},
  laundry:      {icon:'basket',   name:'Laundry',              freq:'3×/week · wash to fold', short:'Laundry'},
  mop:          {icon:'droplets', name:'Mopping',              freq:'Weekly',                 short:'Mop'},
  bathroomClean:{icon:'toilet',   name:'Clean bathroom',       freq:'Biweekly · alternating', short:'Bath'},
  bedding:      {icon:'bed',      name:'Change · wash bedding',freq:'Biweekly · together',    short:'Bedding'},
  fridge:       {icon:'fridge',   name:'Clean fridge',         freq:'Monthly · alternating',  short:'Fridge'},
};
