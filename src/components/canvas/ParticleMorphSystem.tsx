import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise3D, createNoise4D } from "simplex-noise";
import { SHAPES } from "../../utils/shapeGenerators";
import vertexShader from "../../shaders/particles/morph-vertex.glsl?raw";
import fragmentShader from "../../shaders/particles/morph-fragment.glsl?raw";
import { COLOR_SCHEMES } from "./ParticleSystem"; // import type 제거

type ColorScheme = keyof typeof COLOR_SCHEMES;

/**
 * 설정 상수
 */
const CONFIG = {
  particleCount: 15000,
  shapeSize: 14,
  swarmDistanceFactor: 1.5,
  swirlFactor: 4.0,
  noiseFrequency: 0.1,
  noiseTimeScale: 0.04,
  noiseMaxStrength: 2.8,
  morphDuration: 4000,
  particleSizeRange: [0.08, 0.25] as [number, number],
  bloomStrength: 1.3,
  bloomRadius: 0.5,
  bloomThreshold: 0.05,
  idleFlowStrength: 0.25,
  idleFlowSpeed: 0.08,
  idleRotationSpeed: 0.02,
  morphSizeFactor: 0.5,
  morphBrightnessFactor: 0.6,
};

interface ParticleMorphSystemProps {
  onShapeChange?: (shapeName: string) => void;
  onColorSchemeChange?: (scheme: ColorScheme) => void;
}

/**
 * 파티클 모프 시스템 컴포넌트
 * 참고: https://github.com/rukeshbabugantla143/3D-Particle-Morph-Animation-Three.js
 */
export default function ParticleMorphSystem({
  onShapeChange,
  onColorSchemeChange,
}: ParticleMorphSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // 상태
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("fire");
  const [morphProgress, setMorphProgress] = useState(0);
  const [isMorphing, setIsMorphing] = useState(false);

  // 위치 배열들
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const sourcePositionsRef = useRef<Float32Array | null>(null);
  const targetPositionsRef = useRef<Float32Array[]>([]);
  const swarmPositionsRef = useRef<Float32Array | null>(null);

  // 노이즈 함수들
  const noise3DRef = useRef<ReturnType<typeof createNoise3D> | null>(null);
  const noise4DRef = useRef<ReturnType<typeof createNoise4D> | null>(null);

  // 애니메이션 타임라인
  const morphTimelineRef = useRef<number | null>(null);

  // 모든 형태의 위치 생성
  useEffect(() => {
    noise3DRef.current = createNoise3D();
    noise4DRef.current = createNoise4D();

    // 모든 형태의 위치 미리 생성
    const allPositions = SHAPES.map((shape) =>
      shape.generator(CONFIG.particleCount, CONFIG.shapeSize)
    );
    targetPositionsRef.current = allPositions;

    // 초기 위치 설정
    const initialPositions = allPositions[0];
    currentPositionsRef.current = new Float32Array(initialPositions);
    sourcePositionsRef.current = new Float32Array(initialPositions);

    // Swarm 위치 생성
    const swarmPositions = new Float32Array(CONFIG.particleCount * 3);
    swarmPositionsRef.current = swarmPositions;
  }, []);

  // Shader Material 생성
  const shaderMaterial = useMemo(() => {
    const colorSchemeData = COLOR_SCHEMES[colorScheme];
    const colorArray = colorSchemeData.colors;

    // 색상이 1개만 있으면 두 번 사용, 2개 이상이면 첫 번째와 두 번째 사용
    const color1 = colorArray[0];
    const color2 = colorArray.length > 1 ? colorArray[1] : colorArray[0];

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0 },
        uEffectStrength: { value: 0 },
        uNoiseStrength: { value: CONFIG.noiseMaxStrength },
        uSwirlFactor: { value: CONFIG.swirlFactor },
        uIdleFlowStrength: { value: CONFIG.idleFlowStrength },
        uIdleFlowSpeed: { value: CONFIG.idleFlowSpeed },
        uColor1: { value: color1 },
        uColor2: { value: color2 },
        uBloomThreshold: { value: CONFIG.bloomThreshold },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [colorScheme]);

  // Geometry 및 Points 생성
  useEffect(() => {
    if (!currentPositionsRef.current || !shaderMaterial) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(currentPositionsRef.current, 3)
    );

    // 파티클 크기 및 투명도
    const sizes = new Float32Array(CONFIG.particleCount);
    const opacities = new Float32Array(CONFIG.particleCount);
    const effectStrengths = new Float32Array(CONFIG.particleCount);

    for (let i = 0; i < CONFIG.particleCount; i++) {
      sizes[i] =
        CONFIG.particleSizeRange[0] +
        Math.random() *
          (CONFIG.particleSizeRange[1] - CONFIG.particleSizeRange[0]);
      opacities[i] = 0.6 + Math.random() * 0.4;
      effectStrengths[i] = 0;
    }

    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "aOpacity",
      new THREE.Float32BufferAttribute(opacities, 1)
    );
    geometry.setAttribute(
      "aEffectStrength",
      new THREE.Float32BufferAttribute(effectStrengths, 1)
    );

    if (pointsRef.current) {
      pointsRef.current.geometry = geometry;
      pointsRef.current.material = shaderMaterial;
    }

    materialRef.current = shaderMaterial;
  }, [shaderMaterial]);

  // Post-processing은 @react-three/postprocessing을 사용하거나
  // 별도 컴포넌트로 분리하는 것이 좋지만, 여기서는 기본 렌더링 사용

  // 모프 트리거 함수
  const triggerMorph = useCallback(() => {
    if (
      isMorphing ||
      !currentPositionsRef.current ||
      !sourcePositionsRef.current
    )
      return;

    setIsMorphing(true);
    const nextShapeIndex = (currentShapeIndex + 1) % SHAPES.length;
    const nextTargetPositions = targetPositionsRef.current[nextShapeIndex];

    // Swarm 위치 계산
    if (swarmPositionsRef.current && noise3DRef.current) {
      const sourceVec = new THREE.Vector3();
      const targetVec = new THREE.Vector3();
      const swarmVec = new THREE.Vector3();
      const tempVec = new THREE.Vector3();
      const centerOffsetAmount = CONFIG.shapeSize * CONFIG.swarmDistanceFactor;

      for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        sourceVec.fromArray(sourcePositionsRef.current, i3);
        targetVec.fromArray(nextTargetPositions, i3);
        swarmVec.lerpVectors(sourceVec, targetVec, 0.5);

        const offsetDir = tempVec
          .set(
            noise3DRef.current(i * 0.05, 10, 10),
            noise3DRef.current(20, i * 0.05, 20),
            noise3DRef.current(30, 30, i * 0.05)
          )
          .normalize();

        const distFactor =
          sourceVec.distanceTo(targetVec) * 0.1 + centerOffsetAmount;
        swarmVec.addScaledVector(
          offsetDir,
          distFactor * (0.5 + Math.random() * 0.8)
        );

        swarmPositionsRef.current[i3] = swarmVec.x;
        swarmPositionsRef.current[i3 + 1] = swarmVec.y;
        swarmPositionsRef.current[i3 + 2] = swarmVec.z;
      }
    }

    // 애니메이션
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / CONFIG.morphDuration, 1);

      // Cubic bezier easing
      const t = progress;
      const t2 = t * t;
      const t3 = t2 * t;
      const easeProgress = 3 * t2 - 2 * t3 + (t3 - 2 * t2 + t) * 0.4; // 근사치

      setMorphProgress(easeProgress);

      if (progress < 1) {
        morphTimelineRef.current = requestAnimationFrame(animate);
      } else {
        // 완료
        setCurrentShapeIndex(nextShapeIndex);
        if (
          currentPositionsRef.current &&
          sourcePositionsRef.current &&
          nextTargetPositions
        ) {
          currentPositionsRef.current.set(nextTargetPositions);
          sourcePositionsRef.current.set(nextTargetPositions);
        }
        setMorphProgress(0);
        setIsMorphing(false);
        onShapeChange?.(SHAPES[nextShapeIndex].name);
        morphTimelineRef.current = null;
      }
    };

    morphTimelineRef.current = requestAnimationFrame(animate);
  }, [isMorphing, currentShapeIndex, onShapeChange]);

  // 모프 애니메이션 업데이트
  const updateMorphAnimation = (
    positions: Float32Array,
    effectStrengths: Float32Array,
    elapsedTime: number
  ) => {
    if (
      !sourcePositionsRef.current ||
      !swarmPositionsRef.current ||
      !targetPositionsRef.current[currentShapeIndex] ||
      !noise3DRef.current ||
      !noise4DRef.current
    )
      return;

    const t = morphProgress;
    const targets = targetPositionsRef.current[currentShapeIndex];
    const effectStrength = Math.sin(t * Math.PI);
    const currentSwirl = effectStrength * CONFIG.swirlFactor * 0.05;
    const currentNoise = effectStrength * CONFIG.noiseMaxStrength;

    const sourceVec = new THREE.Vector3();
    const swarmVec = new THREE.Vector3();
    const targetVec = new THREE.Vector3();
    const bezPos = new THREE.Vector3();
    const tempVec = new THREE.Vector3();
    const swirlAxis = new THREE.Vector3();
    const noiseOffset = new THREE.Vector3();

    for (let i = 0; i < CONFIG.particleCount; i++) {
      const i3 = i * 3;
      sourceVec.fromArray(sourcePositionsRef.current, i3);
      swarmVec.fromArray(swarmPositionsRef.current, i3);
      targetVec.fromArray(targets, i3);

      // Bezier 곡선 보간
      const t_inv = 1.0 - t;
      const t_inv_sq = t_inv * t_inv;
      const t_sq = t * t;
      bezPos.copy(sourceVec).multiplyScalar(t_inv_sq);
      bezPos.addScaledVector(swarmVec, 2.0 * t_inv * t);
      bezPos.addScaledVector(targetVec, t_sq);

      // Swirl 효과
      if (currentSwirl > 0.01) {
        tempVec.subVectors(bezPos, sourceVec);
        swirlAxis
          .set(
            noise3DRef.current(i * 0.02, elapsedTime * 0.1, 0),
            noise3DRef.current(0, i * 0.02, elapsedTime * 0.1 + 5),
            noise3DRef.current(elapsedTime * 0.1 + 10, 0, i * 0.02)
          )
          .normalize();
        tempVec.applyAxisAngle(
          swirlAxis,
          currentSwirl * (0.5 + Math.random() * 0.5)
        );
        bezPos.copy(sourceVec).add(tempVec);
      }

      // 노이즈 오프셋
      if (currentNoise > 0.01) {
        const noiseTime = elapsedTime * CONFIG.noiseTimeScale;
        noiseOffset.set(
          noise4DRef.current(
            bezPos.x * CONFIG.noiseFrequency,
            bezPos.y * CONFIG.noiseFrequency,
            bezPos.z * CONFIG.noiseFrequency,
            noiseTime
          ),
          noise4DRef.current(
            bezPos.x * CONFIG.noiseFrequency + 100,
            bezPos.y * CONFIG.noiseFrequency + 100,
            bezPos.z * CONFIG.noiseFrequency + 100,
            noiseTime
          ),
          noise4DRef.current(
            bezPos.x * CONFIG.noiseFrequency + 200,
            bezPos.y * CONFIG.noiseFrequency + 200,
            bezPos.z * CONFIG.noiseFrequency + 200,
            noiseTime
          )
        );
        bezPos.addScaledVector(noiseOffset, currentNoise);
      }

      positions[i3] = bezPos.x;
      positions[i3 + 1] = bezPos.y;
      positions[i3 + 2] = bezPos.z;

      effectStrengths[i] = effectStrength;
    }
  };

  // Idle 애니메이션 업데이트
  const updateIdleAnimation = (
    positions: Float32Array,
    effectStrengths: Float32Array,
    elapsedTime: number
  ) => {
    if (!sourcePositionsRef.current || !noise4DRef.current) return;

    const breathScale = 1.0 + Math.sin(elapsedTime * 0.5) * 0.015;
    const timeScaled = elapsedTime * CONFIG.idleFlowSpeed;
    const freq = 0.1;

    const sourceVec = new THREE.Vector3();
    const tempVec = new THREE.Vector3();
    const flowVec = new THREE.Vector3();
    const currentVec = new THREE.Vector3();

    for (let i = 0; i < CONFIG.particleCount; i++) {
      const i3 = i * 3;
      sourceVec.fromArray(sourcePositionsRef.current, i3);
      tempVec.copy(sourceVec).multiplyScalar(breathScale);

      flowVec.set(
        noise4DRef.current(
          tempVec.x * freq,
          tempVec.y * freq,
          tempVec.z * freq,
          timeScaled
        ),
        noise4DRef.current(
          tempVec.x * freq + 10,
          tempVec.y * freq + 10,
          tempVec.z * freq + 10,
          timeScaled
        ),
        noise4DRef.current(
          tempVec.x * freq + 20,
          tempVec.y * freq + 20,
          tempVec.z * freq + 20,
          timeScaled
        )
      );

      tempVec.addScaledVector(flowVec, CONFIG.idleFlowStrength);
      currentVec.fromArray(positions, i3);
      currentVec.lerp(tempVec, 0.05);

      positions[i3] = currentVec.x;
      positions[i3 + 1] = currentVec.y;
      positions[i3 + 2] = currentVec.z;

      effectStrengths[i] = 0.0;
    }
  };

  // 애니메이션 루프
  useFrame((state) => {
    if (!pointsRef.current?.geometry || !materialRef.current) return;

    const elapsedTime = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const effectStrengths = pointsRef.current.geometry.attributes
      .aEffectStrength.array as Float32Array;

    // Material uniforms 업데이트
    materialRef.current.uniforms.uTime.value = elapsedTime;
    materialRef.current.uniforms.uMorphProgress.value = morphProgress;

    // 위치 업데이트
    if (isMorphing) {
      updateMorphAnimation(positions, effectStrengths, elapsedTime);
    } else {
      updateIdleAnimation(positions, effectStrengths, elapsedTime);
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.aEffectStrength.needsUpdate = true;
  });

  // 색상 스킴 변경
  useEffect(() => {
    if (!materialRef.current) return;
    const colorSchemeData = COLOR_SCHEMES[colorScheme];
    const colorArray = colorSchemeData.colors;

    // 색상이 1개만 있으면 두 번 사용, 2개 이상이면 첫 번째와 두 번째 사용
    const color1 = colorArray[0];
    const color2 = colorArray.length > 1 ? colorArray[1] : colorArray[0];

    materialRef.current.uniforms.uColor1.value = color1;
    materialRef.current.uniforms.uColor2.value = color2;
    onColorSchemeChange?.(colorScheme);
  }, [colorScheme, onColorSchemeChange]);

  // 외부에서 모프 트리거할 수 있도록
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 컨트롤 영역 클릭은 무시
      const target = e.target as HTMLElement;
      if (target.closest("#particle-controls")) return;
      triggerMorph();
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [triggerMorph]);

  // 정리
  useEffect(() => {
    return () => {
      if (morphTimelineRef.current) {
        cancelAnimationFrame(morphTimelineRef.current);
      }
    };
  }, []);

  // 외부에서 사용할 수 있는 함수들 (ref를 통해 노출)
  const systemRef = useRef<{
    triggerMorph: () => void;
    setColorScheme: (scheme: ColorScheme) => void;
    getCurrentShape: () => string;
  } | null>(null);

  useEffect(() => {
    systemRef.current = {
      triggerMorph,
      setColorScheme: (scheme: ColorScheme) => setColorScheme(scheme),
      getCurrentShape: () => SHAPES[currentShapeIndex].name,
    };
  }, [currentShapeIndex, colorScheme, triggerMorph]);

  // 전역 노출 (선택적)
  useEffect(() => {
    if (systemRef.current) {
      (
        window as Window & { particleMorphSystem?: typeof systemRef.current }
      ).particleMorphSystem = systemRef.current;
    }
  }, [currentShapeIndex, colorScheme]);

  if (!shaderMaterial) return null;

  return (
    <>
      <points ref={pointsRef} material={shaderMaterial}>
        <bufferGeometry />
      </points>
    </>
  );
}
