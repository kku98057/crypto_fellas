uniform float u_opacity;
uniform vec3 uColor1; // 하위 호환성용
uniform vec3 uColor2; // 하위 호환성용
uniform vec3 uColors[10]; // 색상 배열 (최대 10개)
uniform float uColorCount; // 실제 색상 개수
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;
uniform sampler2D u_texture3;
uniform sampler2D u_texture4;
uniform sampler2D u_texture5;

// 여러 색상 사이를 보간하는 함수
vec3 getColorFromArray(float t, float colorCount) {
  // t를 0~1 범위로 정규화
  t = clamp(t, 0.0, 1.0);
  
  // 색상이 1개면 단색 반환
  if (colorCount < 1.5) {
    return uColors[0];
  }
  
  // 색상 개수가 2개 이상일 때 보간
  float segmentCount = colorCount - 1.0;
  float segmentIndex = t * segmentCount;
  float segmentT = fract(segmentIndex);
  int index = int(floor(segmentIndex));
  
  // 마지막 세그먼트 처리
  if (index >= int(colorCount) - 1) {
    return uColors[int(colorCount) - 1];
  }
  
  // 두 색상 사이 보간
  return mix(uColors[index], uColors[index + 1], segmentT);
}

varying vec3 vPosition;
varying float vScatterAmount;
varying float vTextureIndex;
varying float vRotationAngle;
varying float vDistance;
varying float vEdgeBrightness; // 외곽 밝기

// 텍스처 샘플링 함수 (회전 적용)
vec4 sampleTexture(sampler2D tex, vec2 uv, float angle) {
  // UV 좌표를 중심으로 회전
  vec2 center = vec2(0.5, 0.5);
  vec2 rotatedUV = vec2(
    cos(angle) * (uv.x - center.x) - sin(angle) * (uv.y - center.y) + center.x,
    sin(angle) * (uv.x - center.x) + cos(angle) * (uv.y - center.y) + center.y
  );
  return texture2D(tex, rotatedUV);
}

void main() {
  // 원형 파티클 생성
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // 원형 마스크
  if (dist > 0.5) {
    discard;
  }
  
  // 텍스처 선택 (vTextureIndex에 따라)
  vec4 texColor = vec4(1.0);
  float texIndex = floor(vTextureIndex + 0.5); // 반올림
  
  if (texIndex < 0.5) {
    texColor = sampleTexture(u_texture1, gl_PointCoord, vRotationAngle);
  } else if (texIndex < 1.5) {
    texColor = sampleTexture(u_texture2, gl_PointCoord, vRotationAngle);
  } else if (texIndex < 2.5) {
    texColor = sampleTexture(u_texture3, gl_PointCoord, vRotationAngle);
  } else if (texIndex < 3.5) {
    texColor = sampleTexture(u_texture4, gl_PointCoord, vRotationAngle);
  } else {
    texColor = sampleTexture(u_texture5, gl_PointCoord, vRotationAngle);
  }
  
  // 부드러운 가장자리
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= u_opacity;
  
  // 거리 기반 페이드
  float distanceFade = 1.0 - smoothstep(50.0, 200.0, vDistance);
  alpha *= distanceFade;
  
  // 외곽 밝기 효과 (외곽 부분이 더 밝게)
  // 외곽(0.5에 가까울수록)일수록 더 밝게
  float edgeGlow = smoothstep(0.3, 0.5, dist) * vEdgeBrightness;
  float edgeBrightness = 1.0 + edgeGlow * (vEdgeBrightness - 1.0);
  
  // 색상 스킴 적용 (위치 기반 그라데이션)
  float colorMix = (vPosition.y + 1.0) * 0.5; // -1 ~ 1을 0 ~ 1로 변환
  // 여러 색상 배열에서 색상 가져오기
  vec3 schemeColor = getColorFromArray(colorMix, uColorCount);
  
  // 텍스처 색상과 색상 스킴 블렌딩
  vec3 finalColor = texColor.rgb * schemeColor;
  
  // 외곽 밝기 적용 (외곽 부분을 더 밝게)
  finalColor *= edgeBrightness;
  
  // Scatter 효과 (벚꽃 흩어짐 시 색상 변화)
  if (vScatterAmount > 0.01) {
    // 흩어질 때 더 밝고 따뜻한 색상
    finalColor = mix(finalColor, finalColor * vec3(1.5, 1.2, 0.8), vScatterAmount * 0.5);
  }
  
  gl_FragColor = vec4(finalColor, alpha * texColor.a);
}

