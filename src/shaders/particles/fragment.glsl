uniform float u_opacity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;
uniform sampler2D u_texture3;
uniform sampler2D u_texture4;
uniform sampler2D u_texture5;

varying vec3 vPosition;
varying float vScatterAmount;
varying float vTextureIndex;
varying float vRotationAngle;
varying float vDistance;

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
  
  // 색상 스킴 적용 (위치 기반 그라데이션)
  float colorMix = (vPosition.y + 1.0) * 0.5; // -1 ~ 1을 0 ~ 1로 변환
  vec3 schemeColor = mix(uColor1, uColor2, colorMix);
  
  // 텍스처 색상과 색상 스킴 블렌딩
  vec3 finalColor = texColor.rgb * schemeColor;
  
  // Scatter 효과 (벚꽃 흩어짐 시 색상 변화)
  if (vScatterAmount > 0.01) {
    // 흩어질 때 더 밝고 따뜻한 색상
    finalColor = mix(finalColor, finalColor * vec3(1.5, 1.2, 0.8), vScatterAmount * 0.5);
  }
  
  gl_FragColor = vec4(finalColor, alpha * texColor.a);
}

