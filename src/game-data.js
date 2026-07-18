export const PAINTS = [
  { id: "metal", name: "메탈 그레이", body: "#8a97a8", accent: "#c8d4e0", glow: "#dce8f2" },
  { id: "mango", name: "망고 번개", body: "#ffb703", accent: "#fb5607", glow: "#fff3b0" },
  { id: "soda", name: "소다 파도", body: "#00b4d8", accent: "#4361ee", glow: "#caf0f8" },
  { id: "berry", name: "베리 팝", body: "#ff4d8d", accent: "#8338ec", glow: "#ffd6e5" },
  { id: "lime", name: "라임 터보", body: "#70e000", accent: "#00a896", glow: "#e9ff70" },
  { id: "grape", name: "포도 우주", body: "#7b2cbf", accent: "#3a0ca3", glow: "#e0aaff" }
];

export const WHEELS = [
  { id: "street", name: "씽씽 휠", color: "#263238", speed: 2, accel: 2, handling: 2 },
  { id: "bubble", name: "버블 휠", color: "#00d4ff", speed: 1, accel: 2, handling: 3 },
  { id: "flame", name: "불꽃 휠", color: "#ff5d00", speed: 3, accel: 2, handling: 1 },
  { id: "star", name: "별빛 휠", color: "#ffd60a", speed: 2, accel: 3, handling: 1 }
];

export const TOPPERS = [
  { id: "stock", name: "순정 바디", icon: "—" },
  { id: "parcel", name: "투어링 루프박스", icon: "▣" },
  { id: "cat", name: "트윈 에어로핀", icon: "▲" },
  { id: "rocket", name: "루프 에어덕트", icon: "◆" },
  { id: "crown", name: "익스프레스 사인", icon: "M" }
];

export const DECALS = [
  { id: "bolt", name: "번개", icon: "⚡" },
  { id: "star", name: "별", icon: "★" },
  { id: "heart", name: "하트", icon: "♥" },
  { id: "mumu", name: "무무", icon: "M" }
];

export const MISSIONS = [
  {
    id: "morning",
    title: "센트럴 모닝 익스프레스",
    subtitle: "시티 허브에서 출발해 웨스트 모터스와 하버 터미널까지 화물을 전달해요!",
    time: 300,
    reward: 650,
    color: "#ffb703",
    stops: ["school", "library", "park"]
  },
  {
    id: "festival",
    title: "아우터 벨트 긴급 수송",
    subtitle: "외곽 순환로를 타고 웨스트 마켓과 코스트 타워까지 긴급 화물을 수송해요!",
    time: 280,
    reward: 900,
    color: "#ff4d8d",
    stops: ["school", "museum", "observatory"]
  },
  {
    id: "space",
    title: "스카이라인 에너지 작전",
    subtitle: "이스트 스카이 지구에서 에너지 코어를 하버 프론트와 코스트 타워까지 운반해요!",
    time: 250,
    reward: 1250,
    color: "#7b2cbf",
    stops: ["library", "museum", "observatory"]
  }
];

export const DESTINATIONS = {
  school: { id: "school", name: "웨스트 모터스 차고", short: "모터스", x: -150, z: -236, landmarkX: -115, landmarkZ: -235, color: "#ffb703", icon: "🏁", package: "레이스 파츠 상자" },
  library: { id: "library", name: "이스트 스카이 아카이브", short: "스카이", x: 270, z: -150, landmarkX: 220, landmarkZ: -200, color: "#4361ee", icon: "📦", package: "도심 데이터 모듈" },
  park: { id: "park", name: "하버 프론트 터미널", short: "하버", x: 78, z: 252, landmarkX: 160, landmarkZ: 250, color: "#38b000", icon: "⚓", package: "익스프레스 화물" },
  museum: { id: "museum", name: "웨스트 마켓 정비소", short: "마켓", x: -278, z: 64, landmarkX: -260, landmarkZ: 142, color: "#ff4d8d", icon: "🛠️", package: "튜닝 키트" },
  observatory: { id: "observatory", name: "코스트라인 타워", short: "코스트", x: 282, z: 236, landmarkX: 304, landmarkZ: 266, color: "#7b2cbf", icon: "🏙️", package: "프리미엄 에너지 코어" }
};

export const VEHICLES = [
  { id: "snowbug", name: "현대 아반떼 N", subtitle: "민첩한 전륜구동 스포츠 세단 · 200km/h", price: 0, speed: 0, topSpeed: 200, handling: 2, accel: 2, color: "#9be15d", icon: "N" },
  { id: "trailfox", name: "BMW M3", subtitle: "균형 잡힌 후륜구동 퍼포먼스 세단 · 225km/h", price: 1600, speed: 2, topSpeed: 225, handling: 3, accel: 3, color: "#ff9f1c", icon: "M" },
  { id: "snowcat", name: "벤츠 SLK 55 AMG", subtitle: "가볍고 빠른 V8 로드스터 · 250km/h", price: 4200, speed: 3, topSpeed: 250, handling: 4, accel: 3, color: "#00b4d8", icon: "55" },
  { id: "ridgegt", name: "어울림 스피라 EX", subtitle: "국산 미드십 슈퍼 스포츠 · 275km/h", price: 7800, speed: 5, topSpeed: 275, handling: 4, accel: 5, color: "#7b2cbf", icon: "EX" },
  { id: "aurora", name: "포르쉐 911 터보 S", subtitle: "도심 고속도로를 지배하는 최종 머신 · 300km/h", price: 13500, speed: 7, topSpeed: 300, handling: 6, accel: 7, color: "#ff4d8d", icon: "911" }
];

export const MAX_WORKSHOP_LEVEL = 5;

export function workshopPrice(level, type) {
  const base = type === "speed" ? 420 : 360;
  return base + level * (type === "speed" ? 380 : 320);
}

export const DEFAULT_STYLE = {
  paint: PAINTS[0],
  wheel: WHEELS[0],
  topper: TOPPERS[0],
  decal: DECALS[0],
  vehicle: VEHICLES[0]
};
