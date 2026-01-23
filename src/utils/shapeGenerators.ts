/**
 * 형태 생성 함수들의 타입 정의
 */
export type ShapeGenerator = (count: number, size: number) => Float32Array;

/**
 * 구 형태 생성
 */
export function generateSphere(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // 균등 분포를 위한 구면 좌표
    const theta = Math.acos(2 * Math.random() - 1); // 0 ~ π
    const phi = Math.random() * Math.PI * 2; // 0 ~ 2π
    const radius = size * (0.8 + Math.random() * 0.2);

    positions[i3] = radius * Math.sin(theta) * Math.cos(phi);
    positions[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
    positions[i3 + 2] = radius * Math.cos(theta);
  }
  return positions;
}

/**
 * 정육면체 형태 생성
 */
export function generateCube(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const halfSize = size * 0.5;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // 각 면에 균등하게 분포
    const face = Math.floor(Math.random() * 6);
    const u = (Math.random() - 0.5) * 2;
    const v = (Math.random() - 0.5) * 2;

    switch (face) {
      case 0: // 앞면
        positions[i3] = u * halfSize;
        positions[i3 + 1] = v * halfSize;
        positions[i3 + 2] = halfSize;
        break;
      case 1: // 뒷면
        positions[i3] = u * halfSize;
        positions[i3 + 1] = v * halfSize;
        positions[i3 + 2] = -halfSize;
        break;
      case 2: // 오른쪽
        positions[i3] = halfSize;
        positions[i3 + 1] = u * halfSize;
        positions[i3 + 2] = v * halfSize;
        break;
      case 3: // 왼쪽
        positions[i3] = -halfSize;
        positions[i3 + 1] = u * halfSize;
        positions[i3 + 2] = v * halfSize;
        break;
      case 4: // 위
        positions[i3] = u * halfSize;
        positions[i3 + 1] = halfSize;
        positions[i3 + 2] = v * halfSize;
        break;
      case 5: // 아래
        positions[i3] = u * halfSize;
        positions[i3 + 1] = -halfSize;
        positions[i3 + 2] = v * halfSize;
        break;
    }
  }
  return positions;
}

/**
 * 피라미드 형태 생성
 */
export function generatePyramid(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const baseSize = size * 0.8;
  const height = size * 1.2;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const rand = Math.random();

    if (rand < 0.2) {
      // 꼭짓점
      positions[i3] = 0;
      positions[i3 + 1] = height * 0.5;
      positions[i3 + 2] = 0;
    } else {
      // 밑면
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * baseSize * 0.5;
      const y = -height * 0.5 + Math.random() * height * 0.3;

      positions[i3] = radius * Math.cos(angle);
      positions[i3 + 1] = y;
      positions[i3 + 2] = radius * Math.sin(angle);
    }
  }
  return positions;
}

/**
 * 토러스 형태 생성
 */
export function generateTorus(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const majorRadius = size * 0.6;
  const minorRadius = size * 0.3;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;

    const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
    const y = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
    const z = minorRadius * Math.sin(v);

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }
  return positions;
}

/**
 * 은하 형태 생성
 */
export function generateGalaxy(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const angle = (i / count) * Math.PI * 4; // 나선형
    const radius = (i / count) * size * 0.8;
    const randomAngle = angle + (Math.random() - 0.5) * 0.5;

    const x = Math.cos(randomAngle) * radius;
    const y = (Math.random() - 0.5) * size * 0.3;
    const z = Math.sin(randomAngle) * radius;

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }
  return positions;
}

/**
 * 나선 형태 생성
 */
export function generateSpiral(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const t = i / count;
    const angle = t * Math.PI * 8;
    const radius = t * size * 0.6;
    const height = (t - 0.5) * size * 1.2;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = height;
    positions[i3 + 2] = Math.sin(angle) * radius;
  }
  return positions;
}

/**
 * 내부가 가득 찬 구 형태 생성 (화면을 덮을 수 있을 만큼 큰 구)
 * 파티클이 구의 내부에 균등하게 분포
 */
export function generateFilledSphere(
  count: number,
  size: number
): Float32Array {
  const positions = new Float32Array(count * 3);
  // 화면을 덮을 수 있을 만큼 큰 반경 (카메라 거리 고려)
  const radius = size * 3.0; // 기존보다 훨씬 크게

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // 구의 내부에 균등하게 분포 (거리 기반 가중치 적용)
    const r = radius * Math.cbrt(Math.random()); // 내부에 더 많이 분포
    const theta = Math.acos(2 * Math.random() - 1); // 0 ~ π
    const phi = Math.random() * Math.PI * 2; // 0 ~ 2π

    positions[i3] = r * Math.sin(theta) * Math.cos(phi);
    positions[i3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    positions[i3 + 2] = r * Math.cos(theta);
  }
  return positions;
}

/**
 * 평면 형태 생성
 */
export function generatePlane(count: number, size: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const halfSize = size * 1.5; // 충분히 큰 평면

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // XZ 평면에 균등하게 분포
    positions[i3] = (Math.random() - 0.5) * 2 * halfSize; // X
    positions[i3 + 1] = 0; // Y는 0 (평면)
    positions[i3 + 2] = (Math.random() - 0.5) * 2 * halfSize; // Z
  }
  return positions;
}

/**
 * 형태 정의 배열
 */
export const SHAPES = [
  { name: "Sphere", generator: generateSphere },
  { name: "Cube", generator: generateCube },
  { name: "Pyramid", generator: generatePyramid },
  { name: "Torus", generator: generateTorus },
  { name: "Galaxy", generator: generateGalaxy },
  { name: "Spiral", generator: generateSpiral },
] as const;
