uniform float u_opacity;
uniform vec3 uColor1; // 하위 호환성용
uniform vec3 uColor2; // 하위 호환성용
uniform vec3 uColors[10]; // 색상 배열 (최대 10개)
uniform float uColorCount; // 실제 색상 개수
uniform float uColorWeights[10]; // 색상별 비율 (weights가 없으면 균등 분배)
uniform float uColorAngle; // 색상 분배 각도 (라디안)
uniform float uModelMinY; // 모델의 최소 Y 값 (로컬 좌표 기준)
uniform float uModelMaxY; // 모델의 최대 Y 값 (로컬 좌표 기준)
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;
uniform sampler2D u_texture3;
uniform sampler2D u_texture4;
uniform sampler2D u_texture5;

// 여러 색상 사이를 보간하는 함수 (weights 기반)
vec3 getColorFromArray(float t, float colorCount) {
  // t를 0~1 범위로 정규화
  t = clamp(t, 0.0, 1.0);
  
  // 색상이 1개면 단색 반환
  if (colorCount < 1.5) {
    return uColors[0];
  }
  
  // weights의 합 계산 (정규화)
  float totalWeight = 0.0;
  for (int i = 0; i < 10; i++) {
    if (float(i) < colorCount) {
      totalWeight += uColorWeights[i];
    }
  }
  
  // weights가 모두 0이거나 없으면 균등 분배
  bool useWeights = totalWeight > 0.001;
  
  if (!useWeights) {
    // 균등 분배 (기존 방식)
    float segmentCount = colorCount - 1.0;
    float segmentIndex = t * segmentCount;
    float segmentT = fract(segmentIndex);
    int index = int(floor(segmentIndex));
    
    if (index >= int(colorCount) - 1) {
      return uColors[int(colorCount) - 1];
    }
    
    return mix(uColors[index], uColors[index + 1], segmentT);
  }
  
  // weights 기반 분배
  // 누적 weights 계산
  float cumulativeWeight = 0.0;
  float targetWeight = t * totalWeight;
  
  for (int i = 0; i < 10; i++) {
    if (float(i) >= colorCount) break;
    
    float currentWeight = uColorWeights[i];
    float nextCumulative = cumulativeWeight + currentWeight;
    
    // 목표 weight가 현재 세그먼트 안에 있는지 확인
    if (targetWeight <= nextCumulative) {
      // 현재 세그먼트 내에서 보간
      float segmentStart = cumulativeWeight;
      float segmentEnd = nextCumulative;
      float segmentT = (targetWeight - segmentStart) / (segmentEnd - segmentStart);
      
      // 다음 색상이 있으면 보간, 없으면 현재 색상 반환
      if (i < int(colorCount) - 1) {
        return mix(uColors[i], uColors[i + 1], segmentT);
      } else {
        return uColors[i];
      }
    }
    
    cumulativeWeight = nextCumulative;
  }
  
  // 마지막 색상 반환 (안전장치)
  return uColors[int(colorCount) - 1];
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
  
  // 색상 스킴 적용 (모델 로컬 좌표 기준 그라데이션)
  // 각도에 따라 색상 분배 방향 결정
  // 각도로 회전된 좌표계에서 Y 성분 계산
  float cosAngle = cos(uColorAngle);
  float sinAngle = sin(uColorAngle);
  // 2D 회전 행렬 적용 (X-Y 평면 기준)
  vec2 rotatedPos = vec2(
    vPosition.x * cosAngle - vPosition.y * sinAngle,
    vPosition.x * sinAngle + vPosition.y * cosAngle
  );
  
  // 회전된 Y 좌표로 정규화 (모델의 바운딩 박스 범위 고려)
  float yRange = uModelMaxY - uModelMinY;
  float normalizedY = yRange > 0.001 
    ? (rotatedPos.y - uModelMinY) / yRange  // 회전된 Y 범위를 0~1로 정규화
    : 0.5; // 범위가 너무 작으면 중간값 사용
  normalizedY = clamp(normalizedY, 0.0, 1.0); // 안전장치
  
  // 여러 색상 배열에서 색상 가져오기
  vec3 schemeColor = getColorFromArray(normalizedY, uColorCount);
  
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

