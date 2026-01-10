uniform float uTime;
uniform float u_morphTargetInfluences[4];
uniform float u_scale;

varying vec3 vPosition;
varying float vScatterAmount; // 🔥 퍼진 정도를 fragment로 전달
varying float vTextureIndex; // 텍스처 인덱스를 fragment로 전달
varying float vRotationAngle; // 회전 각도를 fragment로 전달
varying float vDistance; // 카메라까지의 거리를 fragment로 전달 (깊이감용)
varying float vEdgeBrightness; // 외곽 밝기를 fragment로 전달

// morphTarget attributes
attribute vec3 morphTarget1; // man
attribute vec3 morphTarget2; // saturn
attribute vec3 morphTarget3; // phone
attribute float aTextureIndex; // 텍스처 인덱스 (0~4)
// 힌트 방식: 파티클별 랜덤 값 (개별 전환 속도용)
attribute float aRandom1; // 파티클별 랜덤 값 1
attribute float aRandom2; // 파티클별 랜덤 값 2
attribute float aEdgeBrightness; // 외곽 밝기

float random(vec3 pos) {
  return fract(sin(dot(pos, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

void main() {
  vTextureIndex = aTextureIndex; // 텍스처 인덱스 전달
  vEdgeBrightness = aEdgeBrightness; // 외곽 밝기 전달
  
  // === 힌트 방식: 두 모양 사이를 lerp로 전환 ===
  // shapeA: 기본 모양 (rocket - position)
  vec3 shapeA = position;
  
  // shapeB: 목표 모양 결정 (가장 영향력이 큰 morph target)
  vec3 shapeB = position; // 기본값
  
  // 가장 영향력이 큰 morph target 찾기
  float maxInfluence = 0.0;
  int activeTarget = -1;
  
  // 모르프 0: 벚꽃 흩어짐 (특별 처리)
  if(u_morphTargetInfluences[0] > maxInfluence) {
    maxInfluence = u_morphTargetInfluences[0];
    activeTarget = 0;
  }
  if(u_morphTargetInfluences[1] > maxInfluence) {
    maxInfluence = u_morphTargetInfluences[1];
    activeTarget = 1;
  }
  if(u_morphTargetInfluences[2] > maxInfluence) {
    maxInfluence = u_morphTargetInfluences[2];
    activeTarget = 2;
  }
  if(u_morphTargetInfluences[3] > maxInfluence) {
    maxInfluence = u_morphTargetInfluences[3];
    activeTarget = 3;
  }
  
  // 목표 모양 설정
  if(activeTarget == 0) {
    // 벚꽃 흩어짐: GLSL에서 생성
    vec3 scatter = vec3(
      (aRandom1 - 0.5) * 300.0,
      (aRandom2 - 0.5) * 300.0,
      (random(position * 3.0) - 0.5) * 300.0
    );
    shapeB = position + scatter;
    
    // 퍼진 거리 계산 (색상용)
    float scatterDistance = length(scatter * maxInfluence);
    vScatterAmount = scatterDistance / 100.0;
  } else if(activeTarget == 1) {
    shapeB = morphTarget1; // man
    vScatterAmount = 0.0;
  } else if(activeTarget == 2) {
    shapeB = morphTarget2; // saturn
    vScatterAmount = 0.0;
  } else if(activeTarget == 3) {
    shapeB = morphTarget3; // telephone
    vScatterAmount = 0.0;
  } else {
    vScatterAmount = 0.0;
  }
  
  // 힌트 방식: p[i] = lerp(A[i], B[i], k)
  // 스크롤 기반 morph target: influence를 직접 사용
  // 각 파티클마다 약간의 랜덤 오프셋 추가 (더 자연스러운 전환)
  float randomOffset = (aRandom2 - 0.5) * 0.1; // -0.05 ~ 0.05 범위
  float k = clamp(maxInfluence + randomOffset, 0.0, 1.0);
  
  // 두 모양 사이를 직접 lerp
  vec3 newPosition = mix(shapeA, shapeB, k);
  
  // 추가: 여러 morph target이 동시에 활성화된 경우 부드럽게 블렌딩
  if(u_morphTargetInfluences[1] > 0.0 && activeTarget != 1) {
    float secondaryK = u_morphTargetInfluences[1] * 0.3;
    newPosition = mix(newPosition, morphTarget1, secondaryK);
  }
  if(u_morphTargetInfluences[2] > 0.0 && activeTarget != 2) {
    float secondaryK = u_morphTargetInfluences[2] * 0.3;
    newPosition = mix(newPosition, morphTarget2, secondaryK);
  }
  if(u_morphTargetInfluences[3] > 0.0 && activeTarget != 3) {
    float secondaryK = u_morphTargetInfluences[3] * 0.3;
    newPosition = mix(newPosition, morphTarget3, secondaryK);
  }

  // 각 파티클의 고유한 회전 속도 (위치 기반 랜덤 값)
  float randomValue = random(position);
  float rotationSpeed = randomValue * 0.5 + 0.2; // 0.2 ~ 0.7 사이 (회전 속도 감소)
  
  // 각 파티클의 회전 각도 (위치 기반으로 다른 시작 각도)
  float baseAngle = random(position * 2.0) * 6.28318; // 0~2π
  vRotationAngle = baseAngle + uTime * rotationSpeed; // fragment로 전달
  
  // 모델 로컬 좌표 기준 위치를 fragment로 전달 (morphing 후 위치 사용)
  vPosition = newPosition;
  
  // 최종 변환 (위치는 그대로 유지)
  vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
  
  // 카메라까지의 거리 계산 (깊이감용)
  float distance = length(mvPosition.xyz);
  vDistance = distance; // fragment로 거리 전달
  
  // 포인트 크기 (거리 기반 + 스케일) - 멀수록 작게
  float viewZ = -mvPosition.z;
  float scale = 300.0 / max(viewZ, 1.0); // 거리가 멀수록 작아지도록
  gl_PointSize = clamp(scale, 4.0, 65.0) * u_scale; // 파티클 크기 조정
  
  gl_Position = projectionMatrix * mvPosition;
}

