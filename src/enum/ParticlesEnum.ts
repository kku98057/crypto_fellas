/**
 * 이름 기반 밀도 가중치 설정
 * 이름에 따라 입자 밀도를 조정할 수 있습니다.
 * 1.0 = 기본 밀도, 0.5 = 절반 밀도, 2.0 = 2배 밀도
 */
export const NAME_DENSITY_WEIGHTS: Record<string, number> = {
  // glass가 포함된 이름은 낮은 밀도
  glass: 0.3,
  // Circle이 포함된 이름은 높은 밀도
  Circle: 1.5,
  Circle002: 5,
  Circle003: 1.5,
  Circle004: 1.5,
  // Cylinder는 기본 밀도
  Cylinder: 1.0,
  // Cube는 높은 밀도
  Cube: 2.0,
  Cube002: 2.0,
  // 기본값
  default: 1.0,
};

/**
 * 모프 설정 상수
 */
export const MORPH_CONFIG = {
  duration: 4000, // 모프 애니메이션 지속 시간 (ms)
  swirlFactor: 4.0,
  noiseFrequency: 0.1,
  noiseTimeScale: 0.04,
  noiseMaxStrength: 2.8,
  swarmDistanceFactor: 1.5,
};

// 텍스처 경로 설정
export const TEXTURE_PATHS = [
  "/image/investors/1.png",
  "/image/investors/2.png",
  "/image/investors/3.png",
  "/image/investors/4.png",
  "/image/investors/5.png",
];
