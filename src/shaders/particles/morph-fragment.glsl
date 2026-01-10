uniform float uBloomThreshold;

varying vec3 vColor;
varying float vOpacity;
varying float vDistance;

void main() {
  // 원형 파티클 생성
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) {
    discard;
  }
  
  // 부드러운 가장자리
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= vOpacity;
  
  // 거리 기반 페이드
  float distanceFade = 1.0 - smoothstep(50.0, 200.0, vDistance);
  alpha *= distanceFade;
  
  // Bloom 효과를 위한 밝기 계산
  float brightness = dot(vColor, vec3(0.299, 0.587, 0.114));
  vec3 finalColor = vColor;
  
  // Bloom threshold 이상일 때 더 밝게
  if (brightness > uBloomThreshold) {
    finalColor *= 1.5;
  }
  
  gl_FragColor = vec4(finalColor, alpha);
}

