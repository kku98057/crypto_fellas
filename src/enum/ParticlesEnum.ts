export const PARTICLE_COUNT = 12000;
export const PARTICLE_SHAPE_SIZE = 12; // 모델 전체 크기
export const PARTICLE_SIZE_SCALE = 0.4; // 파티클 개별 크기 (기본값: 0.4)
/**
 * 이름 기반 밀도 가중치 설정
 * 이름에 따라 입자 밀도를 조정할 수 있습니다.
 * 1.0 = 기본 밀도, 0.5 = 절반 밀도, 2.0 = 2배 밀도
 */
export const NAME_DENSITY_WEIGHTS: Record<string, number> = {
  default: 1.0,
};

/**
 * 이름 기반 외곽 밝기 설정
 * 모든 메시에 기본 외곽 밝기가 적용되고, 이름이 있는 요소들은 더 밝게 설정됩니다.
 * 1.0 = 기본 밝기, 2.0 = 2배 밝기, 3.0 = 3배 밝기
 */
export const NAME_EDGE_BRIGHTNESS: {
  default: number; // 기본 외곽 밝기 (이름이 없거나 매칭되지 않을 때) - 모든 메시에 공통 적용
  names: Record<string, number>; // 이름별 외곽 밝기 설정 (이름이 있는 요소들은 더 밝게)
} = {
  // 기본 외곽 밝기 (모든 메시에 공통 적용)
  default: 1, // 모든 메시 동일하게
  // 이름별 외곽 밝기 (모두 동일하게 설정)
  names: {
    // 모든 메시를 동일한 밝기로 설정
  },
};

/**
 * 모프 설정 상수
 */
export const MORPH_CONFIG = {
  duration: 4000, // 모프 애니메이션 지속 시간 (ms)
  swirlFactor: 1.0,
  noiseFrequency: 0.01,
  noiseTimeScale: 0.04,
  noiseMaxStrength: 0.0, // 2.8 → 0.0 (노이즈 효과 제거)
  swarmDistanceFactor: 1.5,
};

/**
 * 텍스처 경로 설정
 *
 * 사용 방법:
 * 1. 원하는 만큼 이미지 경로를 추가/제거하세요 (최대 5개까지 지원)
 * 2. 각 파티클은 위치 기반 해시로 자동으로 텍스처가 할당됩니다
 * 3. 배열 개수를 변경하면 자동으로 적용됩니다
 *
 * 예시:
 * - 1개만 사용: ["/image/investors/1.png"]
 * - 3개 사용: ["/image/investors/1.png", "/image/investors/2.png", "/image/investors/3.png"]
 * - 5개 사용 (현재): 아래 배열 그대로
 */
export const TEXTURE_PATHS = [
  //   "/image/investors/1.png",
  //   "/image/investors/2.png",
  //   "/image/investors/3.png",
  //   "/image/investors/4.png",
  //   "/image/investors/5.png",
  `${import.meta.env.BASE_URL}image/triangle_sample.png`,
];

/**
 * 파티클 설정
 */
export const PARTICLE_CONFIG = {
  useTexture: true, // 텍스처 사용 여부 (기본값: true)
};

export const PARTICLE_MODEL_PATH = [
  `${import.meta.env.BASE_URL}object/game_pad.glb`, // gamepad 모델
  `${import.meta.env.BASE_URL}object/model_2.glb`, // card 모델
  `${import.meta.env.BASE_URL}object/model_3.glb`, // saturn 모델
];
