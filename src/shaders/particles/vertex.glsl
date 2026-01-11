uniform float uTime;
uniform float u_morphTargetInfluences[4];
uniform float u_scale;

varying vec3 vPosition;
varying float vScatterAmount;
varying float vTextureIndex;
varying float vRotationAngle;
varying float vDistance;
varying float vEdgeBrightness;

// morphTarget attributes (3개 모델만 사용)
attribute vec3 morphTarget1; // card
attribute vec3 morphTarget2; // saturn
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
  
  // 3개 모델: gamepad (position), card (morphTarget1), saturn (morphTarget2)
  // u_morphTargetInfluences[0] = card influence
  // u_morphTargetInfluences[1] = saturn influence
  
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
  
  // 랜덤 오프셋으로 자연스러운 전환
  float randomOffset = (aRandom2 - 0.5) * 0.05;
  vec3 newPosition = currentPosition;
  
  // X, Y, Z 축에 약간의 랜덤 오프셋 추가 (너무 정확한 동기화 방지)
  newPosition.x += randomOffset;
  newPosition.y += (aRandom1 - 0.5) * 0.05;
  newPosition.z += (random(position) - 0.5) * 0.05;

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

