uniform float uTime;
uniform float u_morphTargetInfluences[4];
uniform float u_scale;
uniform float uScatterAmount; // 산포 효과 (0.0 = 모델 형태, 1.0 = 완전히 흩어짐)

varying vec3 vPosition;
varying float vScatterAmount;
varying float vTextureIndex;
varying float vRotationAngle;
varying float vDistance;
varying float vEdgeBrightness;

// morphTarget attributes (5개 모델 사용)
attribute vec3 morphTarget1; // card
attribute vec3 morphTarget2; // saturn
attribute vec3 morphTarget3; // filledSphere
attribute vec3 morphTarget4; // plane
attribute float aTextureIndex;
attribute float aRandom1;
attribute float aRandom2;
attribute float aEdgeBrightness;

float random(vec3 pos) {
  return fract(sin(dot(pos, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

void main() {
  vTextureIndex = aTextureIndex;
  vEdgeBrightness = aEdgeBrightness;
  vScatterAmount = 0.0;
  
  // 5개 모델: gamepad (position), card (morphTarget1), saturn (morphTarget2), filledSphere (morphTarget3), plane (morphTarget4)
  // u_morphTargetInfluences[0] = card influence
  // u_morphTargetInfluences[1] = saturn influence
  // u_morphTargetInfluences[2] = filledSphere influence
  // u_morphTargetInfluences[3] = plane influence
  
  // 현재 위치 계산 (모든 influences 기반)
  vec3 currentPosition = position; // gamepad (기본)
  
  // Card influence 적용
  if(u_morphTargetInfluences[0] > 0.001) {
    currentPosition = mix(currentPosition, morphTarget1, u_morphTargetInfluences[0]);
  }
  
  // Saturn influence 적용
  if(u_morphTargetInfluences[1] > 0.001) {
    // Saturn은 Card에서 전환되므로, Card 위치를 기준으로
    vec3 cardPosition = mix(position, morphTarget1, clamp(u_morphTargetInfluences[0], 0.0, 1.0));
    currentPosition = mix(cardPosition, morphTarget2, u_morphTargetInfluences[1]);
  }
  
  // FilledSphere influence 적용
  if(u_morphTargetInfluences[2] > 0.001) {
    currentPosition = mix(currentPosition, morphTarget3, u_morphTargetInfluences[2]);
  }
  
  // Plane influence 적용
  if(u_morphTargetInfluences[3] > 0.001) {
    currentPosition = mix(currentPosition, morphTarget4, u_morphTargetInfluences[3]);
  }
  
  // 산포 효과 적용
  vec3 scatteredPosition = currentPosition;
  if (uScatterAmount > 0.001) {
    // 파티클을 넓은 구 형태로 분산
    float sphereRadius = 15.0; // 분산 반경
    vec3 randomDirection = normalize(vec3(
      (aRandom1 - 0.5) * 2.0,
      (aRandom2 - 0.5) * 2.0,
      (random(position) - 0.5) * 2.0
    ));
    vec3 scatterOffset = randomDirection * sphereRadius * uScatterAmount;
    scatteredPosition = currentPosition + scatterOffset;
  }
  
  // 랜덤 오프셋으로 자연스러운 전환
  float randomOffset = (aRandom2 - 0.5) * 0.05;
  vec3 newPosition = scatteredPosition;
  
  // X, Y, Z 축에 약간의 랜덤 오프셋 추가 (너무 정확한 동기화 방지)
  newPosition.x += randomOffset * (1.0 - uScatterAmount);
  newPosition.y += (aRandom1 - 0.5) * 0.05 * (1.0 - uScatterAmount);
  newPosition.z += (random(position) - 0.5) * 0.05 * (1.0 - uScatterAmount);

  // 파티클 회전
  float randomValue = random(position);
  float rotationSpeed = randomValue * 0.5 + 0.2;
  float baseAngle = random(position * 2.0) * 6.28318;
  vRotationAngle = baseAngle + uTime * rotationSpeed;
  
  vPosition = newPosition;
  
  vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
  float distance = length(mvPosition.xyz);
  vDistance = distance;
  
  float viewZ = -mvPosition.z;
  float scale = 300.0 / max(viewZ, 1.0);
  gl_PointSize = clamp(scale, 4.0, 65.0) * u_scale;
  
  gl_Position = projectionMatrix * mvPosition;
}

