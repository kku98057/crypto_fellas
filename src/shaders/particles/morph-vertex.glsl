uniform float uTime;
uniform float uMorphProgress;
uniform float uEffectStrength;
uniform float uNoiseStrength;
uniform float uSwirlFactor;
uniform float uIdleFlowStrength;
uniform float uIdleFlowSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;

attribute float aSize;
attribute float aOpacity;
attribute float aEffectStrength;

varying vec3 vColor;
varying float vOpacity;
varying float vDistance;

// Simplex Noise 함수 (간단한 버전)
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vec3 pos = position;
  
  // 모프 중일 때 노이즈 및 스월 효과 적용
  if (uMorphProgress > 0.0 && uMorphProgress < 1.0) {
    float effect = sin(uMorphProgress * 3.14159);
    
    // 노이즈 오프셋
    if (uNoiseStrength > 0.01) {
      vec3 noiseOffset = vec3(
        snoise(pos * 0.1 + uTime * 0.04),
        snoise(pos * 0.1 + vec3(100.0) + uTime * 0.04),
        snoise(pos * 0.1 + vec3(200.0) + uTime * 0.04)
      );
      pos += noiseOffset * uNoiseStrength * effect;
    }
    
    // 스월 효과
    if (uSwirlFactor > 0.01) {
      vec3 center = vec3(0.0);
      vec3 toCenter = pos - center;
      float angle = length(toCenter) * uSwirlFactor * effect * 0.1;
      float c = cos(angle);
      float s = sin(angle);
      mat3 rotation = mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
      );
      pos = center + rotation * toCenter;
    }
  } else {
    // Idle 상태: 부드러운 흐름 효과
    float timeScaled = uTime * uIdleFlowSpeed;
    vec3 flow = vec3(
      snoise(pos * 0.1 + timeScaled),
      snoise(pos * 0.1 + vec3(10.0) + timeScaled),
      snoise(pos * 0.1 + vec3(20.0) + timeScaled)
    );
    pos += flow * uIdleFlowStrength;
  }
  
  // 색상 보간
  float colorMix = (pos.y + 1.0) * 0.5; // -1 ~ 1을 0 ~ 1로 변환
  vColor = mix(uColor1, uColor2, colorMix);
  
  // 거리 기반 투명도
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vDistance = length(mvPosition.xyz);
  vOpacity = aOpacity;
  
  // 포인트 크기
  float viewZ = -mvPosition.z;
  float scale = 300.0 / max(viewZ, 1.0);
  gl_PointSize = clamp(scale * aSize, 2.0, 50.0);
  
  gl_Position = projectionMatrix * mvPosition;
}

