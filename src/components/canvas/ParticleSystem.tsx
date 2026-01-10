import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { createNoise3D, createNoise4D } from "simplex-noise";
import {
  generateSphere,
  generateCube,
  generatePyramid,
  generateTorus,
} from "../../utils/shapeGenerators";
// import CreateParticlePositions from "../../utils/createParticle";
import vertexShader from "../../shaders/particles/vertex.glsl?raw";
import fragmentShader from "../../shaders/particles/fragment.glsl?raw";
// import { morphTarget } from "../../utils/animationSequence";

/**
 * GLTF 모델에서 파티클 위치를 추출하는 클래스
 */
class CreateParticlePositions {
  gltf: { scene: THREE.Object3D };
  count: number;

  constructor(gltf: { scene: THREE.Object3D }, count: number) {
    this.gltf = gltf;
    this.count = count;
  }

  createParticles(): Float32Array {
    const positions: THREE.Vector3[] = [];
    const tempVec = new THREE.Vector3();

    // 모델의 모든 메시에서 vertex 위치 수집
    this.gltf.scene.traverse((child) => {
      console.log("////////////////////////////////////////");
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry;
        if (geometry) {
          console.log("name", child.name);
          // 위치 속성 가져오기
          const positionAttribute = geometry.attributes.position;
          if (positionAttribute) {
            const matrix = new THREE.Matrix4();
            matrix.multiplyMatrices(
              this.gltf.scene.matrixWorld,
              child.matrixWorld
            );

            // 각 vertex의 월드 좌표 계산
            for (let i = 0; i < positionAttribute.count; i++) {
              tempVec.fromBufferAttribute(positionAttribute, i);
              tempVec.applyMatrix4(matrix);
              positions.push(tempVec.clone());
            }
          }
        }
      }
    });

    // 충분한 파티클이 없으면 보간하여 생성
    if (positions.length === 0) {
      console.warn("모델에서 vertex를 찾을 수 없습니다. 기본 형태 사용");
      return new Float32Array(this.count * 3);
    }

    // 요청된 개수만큼 파티클 선택 (균등 분포)
    const result = new Float32Array(this.count * 3);
    const step = Math.max(1, Math.floor(positions.length / this.count));

    for (let i = 0; i < this.count; i++) {
      const index = Math.min(
        Math.floor(i * step) + Math.floor(Math.random() * step),
        positions.length - 1
      );
      const pos = positions[index];
      result[i * 3] = pos.x;
      result[i * 3 + 1] = pos.y;
      result[i * 3 + 2] = pos.z;
    }

    console.log(
      `모델에서 ${positions.length}개 vertex 중 ${this.count}개 파티클 생성`
    );
    return result;
  }
}

/**
 * 모프 설정 상수
 */
const MORPH_CONFIG = {
  duration: 4000, // 모프 애니메이션 지속 시간 (ms)
  swirlFactor: 4.0,
  noiseFrequency: 0.1,
  noiseTimeScale: 0.04,
  noiseMaxStrength: 2.8,
  swarmDistanceFactor: 1.5,
};

/**
 * 색상 스킴 정의
 */
const COLOR_SCHEMES = {
  fire: {
    color1: new THREE.Color(0xff4500), // 주황색
    color2: new THREE.Color(0xffcc00), // 노란색
  },
  neon: {
    color1: new THREE.Color(0xff00ff), // 마젠타
    color2: new THREE.Color(0x00ffff), // 시안
  },
  nature: {
    color1: new THREE.Color(0x00ff00), // 초록색
    color2: new THREE.Color(0x66ffcc), // 청록색
  },
  rainbow: {
    color1: new THREE.Color(0xff0000), // 빨강
    color2: new THREE.Color(0x0000ff), // 파랑
  },
} as const;

type ColorScheme = keyof typeof COLOR_SCHEMES;

interface ParticleSystemProps {
  onShapeChange?: (shapeName: string) => void;
  onColorSchemeChange?: (scheme: ColorScheme) => void;
}

/**
 * 파티클 시스템 컴포넌트
 * 3D 모델에서 파티클을 생성하고 morphing 효과를 적용합니다.
 */
export default function ParticleSystem({
  onShapeChange,
  onColorSchemeChange,
}: ParticleSystemProps = {}) {
  const meshRef = useRef<THREE.Points>(null);
  const wrapperRef = useRef<THREE.Group>(null);
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // 모프 상태
  const [morphProgress, setMorphProgress] = useState(0);
  const [isMorphing, setIsMorphing] = useState(false);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const nextModelIndexRef = useRef<number>(0);

  // 색상 스킴 상태
  const [colorScheme, setColorScheme] = useState<ColorScheme>("fire");

  // 위치 배열들
  const modelPositionsRef = useRef<Float32Array[]>([]);
  const sourcePositionsRef = useRef<Float32Array | null>(null);
  const swarmPositionsRef = useRef<Float32Array | null>(null);
  const currentPositionsRef = useRef<Float32Array | null>(null);

  // 노이즈 함수들
  const noise3DRef = useRef<ReturnType<typeof createNoise3D> | null>(null);
  const noise4DRef = useRef<ReturnType<typeof createNoise4D> | null>(null);

  // 애니메이션 타임라인
  const morphTimelineRef = useRef<number | null>(null);

  // 기본 텍스처 생성 (로딩 실패 시 대비)
  const defaultTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // 그라데이션 원형 텍스처 생성
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.8)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // 텍스처 로드 시도 (파일이 없을 수 있으므로 에러 핸들링)
  const [textures, setTextures] = useState<THREE.Texture[]>([]);

  useEffect(() => {
    const loadTextures = async () => {
      const texturePaths = [
        "/image/investors/1.png",
        "/image/investors/2.png",
        "/image/investors/3.png",
        "/image/investors/4.png",
        "/image/investors/5.png",
      ];

      const loader = new THREE.TextureLoader();
      const loadedTextures: THREE.Texture[] = [];

      for (const path of texturePaths) {
        try {
          const texture = await new Promise<THREE.Texture>((resolve) => {
            loader.load(
              path,
              (tex) => {
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.flipY = false;
                resolve(tex);
              },
              undefined,
              () => {
                // 로딩 실패 시 기본 텍스처 사용
                resolve(defaultTexture);
              }
            );
          });
          loadedTextures.push(texture);
        } catch (error) {
          console.warn(`텍스처 로딩 실패: ${path}`, error);
          loadedTextures.push(defaultTexture);
        }
      }

      setTextures(
        loadedTextures.length > 0
          ? loadedTextures
          : Array(5).fill(defaultTexture)
      );
    };

    loadTextures();
  }, [defaultTexture]);

  // 텍스처 로딩 확인
  useEffect(() => {
    if (textures.length > 0) {
      console.log("=== Investor 텍스처 로드 완료 ===");
      textures.forEach((texture, index) => {
        const isDefault = texture === defaultTexture;
        const image = texture.image as HTMLImageElement | undefined;
        console.log(
          `Investor ${index + 1} (/image/investors/${index + 1}.png):`,
          isDefault ? "❌ 기본 텍스처 사용" : "✅ 로드 성공",
          isDefault
            ? ""
            : `(${image?.width || "N/A"}x${image?.height || "N/A"})`
        );
      });
      console.log("================================");
    }
  }, [textures, defaultTexture]);

  // Shader Material 생성
  const shaderMaterial = useMemo(() => {
    // 텍스처가 로드되지 않았으면 기본 텍스처 사용
    const finalTextures =
      textures.length > 0 ? textures : Array(5).fill(defaultTexture);

    // 현재 색상 스킴
    const colors = COLOR_SCHEMES[colorScheme];

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        u_scale: { value: 0.6 },
        u_opacity: { value: 1 },
        u_morphTargetInfluences: { value: [0, 0, 0, 0] },
        uMorphProgress: { value: 0 },
        uEffectStrength: { value: 0 },
        uNoiseStrength: { value: 0 },
        uSwirlFactor: { value: MORPH_CONFIG.swirlFactor },
        uColor1: { value: colors.color1 },
        uColor2: { value: colors.color2 },
        u_texture1: { value: finalTextures[0] || defaultTexture },
        u_texture2: { value: finalTextures[1] || defaultTexture },
        u_texture3: { value: finalTextures[2] || defaultTexture },
        u_texture4: { value: finalTextures[3] || defaultTexture },
        u_texture5: { value: finalTextures[4] || defaultTexture },
      },
      side: THREE.DoubleSide,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [textures, defaultTexture, colorScheme]);

  // shaderMaterial ref 업데이트 (useEffect에서 처리)
  useEffect(() => {
    shaderMaterialRef.current = shaderMaterial;
  }, [shaderMaterial]);

  // 모델 중앙 정렬 및 동일 크기로 스케일링 함수
  const centerModels = (gltfScene: THREE.Object3D, targetSize: number = 10) => {
    const box = new THREE.Box3().setFromObject(gltfScene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 중앙 정렬
    gltfScene.position.sub(center);

    // 바운딩 박스 크기 계산
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);

    // 목표 크기로 스케일 조정
    if (maxDimension > 0) {
      const scale = targetSize / maxDimension;
      gltfScene.scale.multiplyScalar(scale);
    }
  };

  // 파티클 위치 배열을 중앙 정렬하고 동일한 크기로 정규화하는 함수
  const normalizeParticlePositions = (
    positions: Float32Array,
    targetSize: number = 10
  ): Float32Array => {
    if (positions.length === 0) return positions;

    const count = positions.length / 3;
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    // 바운딩 박스 계산
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    // 중심점 계산
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // 최대 차원 계산
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDimension = Math.max(sizeX, sizeY, sizeZ);

    // 정규화된 위치 배열 생성
    const normalized = new Float32Array(positions.length);
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      // 중앙 정렬 및 스케일링
      normalized[i * 3] = (x - centerX) * scale;
      normalized[i * 3 + 1] = (y - centerY) * scale;
      normalized[i * 3 + 2] = (z - centerZ) * scale;
    }

    return normalized;
  };

  // 모델 로딩 및 파티클 생성
  useEffect(() => {
    const loadModels = async () => {
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
      loader.setDRACOLoader(draco);

      try {
        // 모델 로딩 시도 (실패 시 기본 형태 사용)
        const modelPaths = [
          "/object/model_4.glb", // rocket 모델
          "/object/model_2.glb", // saturn 모델
          "/object/model_3.glb", // telephone 모델
        ];

        const loadModelSafely = async (path: string) => {
          try {
            return await loader.loadAsync(path);
          } catch {
            // 모델 파일이 없을 때는 조용히 실패 처리 (기본 형태 사용)
            // 개발 환경에서만 디버그 메시지 표시
            if (import.meta.env.DEV) {
              console.debug(`모델 파일 없음 (기본 형태 사용): ${path}`);
            }
            return null;
          }
        };

        const [man, rocket, saturn, telephone] = await Promise.all(
          modelPaths.map(loadModelSafely)
        );

        // 모델 로딩 결과 출력
        console.log("=== 모델 로딩 결과 ===");
        console.log(
          "Model 1 (Rocket):",
          rocket ? "✅ 로드 성공" : "❌ 기본 형태 사용 (Sphere)"
        );
        if (rocket) {
          console.log("  - Scene children:", rocket.scene.children.length);
          console.log("  - Scene:", rocket.scene);
        }
        console.log(
          "Model 2 (Saturn):",
          saturn ? "✅ 로드 성공" : "❌ 기본 형태 사용 (Pyramid)"
        );
        if (saturn) {
          console.log("  - Scene children:", saturn.scene.children.length);
          console.log("  - Scene:", saturn.scene);
        }
        console.log(
          "Model 3 (Telephone):",
          telephone ? "✅ 로드 성공" : "❌ 기본 형태 사용 (Torus)"
        );
        if (telephone) {
          console.log("  - Scene children:", telephone.scene.children.length);
          console.log("  - Scene:", telephone.scene);
        }
        console.log("===================");

        // 모델이 있으면 중앙 정렬 및 동일 크기로 스케일링
        const targetSize = 10; // 모든 모델을 이 크기로 통일
        [man, rocket, saturn, telephone].forEach((result, index) => {
          if (result) {
            centerModels(result.scene, targetSize);
            console.log(
              `Model ${
                index + 1
              } 중앙 정렬 및 크기 조정 완료 (목표 크기: ${targetSize})`
            );
          }
        });

        // 파티클 생성 (모델이 없으면 기본 형태 사용)
        const particleCount = 3000;
        const shapeSize = 10; // 기본 형태도 동일한 크기로

        let rocketPositions = rocket
          ? new CreateParticlePositions(rocket, particleCount).createParticles()
          : generateSphere(particleCount, shapeSize);

        let manPositions = man
          ? new CreateParticlePositions(man, particleCount).createParticles()
          : generateCube(particleCount, shapeSize);

        let saturnPositions = saturn
          ? new CreateParticlePositions(saturn, particleCount).createParticles()
          : generatePyramid(particleCount, shapeSize);

        let telephonePositions = telephone
          ? new CreateParticlePositions(
              telephone,
              particleCount
            ).createParticles()
          : generateTorus(particleCount, shapeSize);

        // 모든 파티클 위치를 동일한 크기로 정규화
        rocketPositions = normalizeParticlePositions(
          rocketPositions,
          targetSize
        );
        manPositions = normalizeParticlePositions(manPositions, targetSize);
        saturnPositions = normalizeParticlePositions(
          saturnPositions,
          targetSize
        );
        telephonePositions = normalizeParticlePositions(
          telephonePositions,
          targetSize
        );

        console.log(
          "모든 모델 파티클 위치 정규화 완료 (목표 크기:",
          targetSize,
          ")"
        );

        // 텍스처 인덱스 배열 생성 (위치 기반 규칙적 패턴)
        const textureIndices = new Float32Array(particleCount);

        // 힌트 방식: 파티클별 랜덤 값 생성 (개별 전환 속도용)
        const rnd1Array = new Float32Array(particleCount);
        const rnd2Array = new Float32Array(particleCount);

        // 위치 기반 해시 함수로 규칙적으로 할당
        const hash = (x: number, y: number, z: number) => {
          const n = x * 73856093 + y * 19349663 + z * 83492791;
          return Math.abs(Math.floor(n)) % 5;
        };

        // 랜덤 값 생성 함수 (위치 기반, 일관성 유지)
        const seededRandom = (seed: number) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };

        // 각 파티클의 위치를 기반으로 규칙적으로 텍스처 인덱스 및 랜덤 값 할당
        for (let i = 0; i < particleCount; i++) {
          const x = rocketPositions[i * 3];
          const y = rocketPositions[i * 3 + 1];
          const z = rocketPositions[i * 3 + 2];

          // 위치를 기반으로 한 해시 값으로 텍스처 인덱스 결정 (규칙적이지만 다양함)
          textureIndices[i] = hash(x, y, z);

          // 힌트 방식: 각 파티클마다 고유한 랜덤 값 생성 (위치 기반)
          const seed1 = x * 12.9898 + y * 78.233 + z * 45.164;
          const seed2 = x * 19.1919 + y * 91.9191 + z * 28.2828;
          rnd1Array[i] = seededRandom(seed1);
          rnd2Array[i] = seededRandom(seed2);
        }

        // BufferGeometry 생성
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(rocketPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget1",
          new THREE.Float32BufferAttribute(manPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget2",
          new THREE.Float32BufferAttribute(saturnPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget3",
          new THREE.Float32BufferAttribute(telephonePositions, 3)
        );
        bufferGeometry.setAttribute(
          "aTextureIndex",
          new THREE.Float32BufferAttribute(textureIndices, 1)
        );
        // 힌트 방식: 파티클별 랜덤 값 attribute 추가
        bufferGeometry.setAttribute(
          "aRandom1",
          new THREE.Float32BufferAttribute(rnd1Array, 1)
        );
        bufferGeometry.setAttribute(
          "aRandom2",
          new THREE.Float32BufferAttribute(rnd2Array, 1)
        );

        // 텍스처 인덱스 분포 확인
        const textureDistribution = [0, 0, 0, 0, 0];
        for (let i = 0; i < particleCount; i++) {
          textureDistribution[Math.floor(textureIndices[i])]++;
        }

        console.log("=== 파티클 생성 완료 ===");
        console.log("파티클 개수:", particleCount);
        console.log("텍스처 인덱스 범위:", {
          min: Math.min(...Array.from(textureIndices)),
          max: Math.max(...Array.from(textureIndices)),
        });
        console.log("Investor 텍스처 분포:", {
          "investor/1.png": textureDistribution[0],
          "investor/2.png": textureDistribution[1],
          "investor/3.png": textureDistribution[2],
          "investor/4.png": textureDistribution[3],
          "investor/5.png": textureDistribution[4],
        });
        console.log("Geometry 속성:", Object.keys(bufferGeometry.attributes));
        console.log("===================");

        // 모델 위치 저장
        modelPositionsRef.current = [
          rocketPositions,
          manPositions,
          saturnPositions,
          telephonePositions,
        ];
        sourcePositionsRef.current = new Float32Array(rocketPositions);
        currentPositionsRef.current = new Float32Array(rocketPositions);

        // Swarm 위치 초기화
        swarmPositionsRef.current = new Float32Array(particleCount * 3);

        // 노이즈 함수 초기화
        noise3DRef.current = createNoise3D();
        noise4DRef.current = createNoise4D();

        // 모델 위치 저장
        modelPositionsRef.current = [
          rocketPositions,
          manPositions,
          saturnPositions,
          telephonePositions,
        ];
        sourcePositionsRef.current = new Float32Array(rocketPositions);
        currentPositionsRef.current = new Float32Array(rocketPositions);

        // Swarm 위치 초기화
        swarmPositionsRef.current = new Float32Array(particleCount * 3);

        // 노이즈 함수 초기화
        noise3DRef.current = createNoise3D();
        noise4DRef.current = createNoise4D();

        // Points 생성
        if (meshRef.current) {
          meshRef.current.geometry = bufferGeometry;
        }
      } catch (error) {
        console.error("모델 로딩 실패:", error);
      }
    };

    loadModels();
  }, []);

  // 스크롤에 따른 morph target 업데이트
  useEffect(() => {
    const handleScroll = () => {
      if (!shaderMaterialRef.current) return;

      // 스크롤 진행도 계산 (0 ~ 1)
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = Math.min(
        Math.max(window.scrollY / Math.max(scrollHeight, 1), 0),
        1
      );

      // 스크롤 진행도에 따라 morph target 변경 (간단하게)
      const influences = [0, 0, 0, 0];

      if (scrollProgress < 0.2) {
        // 로켓 (기본) - 0~20%
        influences[0] = 0;
        influences[1] = 0;
        influences[2] = 0;
        influences[3] = 0;
      } else if (scrollProgress < 0.4) {
        // 벚꽃 흩어짐 - 20~40%
        const t = (scrollProgress - 0.2) / 0.2;
        influences[0] = t;
        influences[1] = 0;
        influences[2] = 0;
        influences[3] = 0;
      } else if (scrollProgress < 0.6) {
        // 사람 - 40~60%
        const t = (scrollProgress - 0.4) / 0.2;
        influences[0] = 1.0 - t;
        influences[1] = t;
        influences[2] = 0;
        influences[3] = 0;
      } else if (scrollProgress < 0.8) {
        // 행성 - 60~80%
        const t = (scrollProgress - 0.6) / 0.2;
        influences[0] = 0;
        influences[1] = 1.0 - t;
        influences[2] = t;
        influences[3] = 0;
      } else {
        // 수화기 - 80~100%
        const t = (scrollProgress - 0.8) / 0.2;
        influences[0] = 0;
        influences[1] = 0;
        influences[2] = 1.0 - t;
        influences[3] = t;
      }

      shaderMaterialRef.current.uniforms.u_morphTargetInfluences.value =
        influences;
    };

    // 초기값 설정
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 모프 트리거 함수
  const triggerMorph = useCallback(() => {
    if (
      isMorphing ||
      !currentPositionsRef.current ||
      !sourcePositionsRef.current ||
      !swarmPositionsRef.current ||
      modelPositionsRef.current.length === 0
    )
      return;

    setIsMorphing(true);
    const nextModelIndex =
      (currentModelIndex + 1) % modelPositionsRef.current.length;
    nextModelIndexRef.current = nextModelIndex;
    const nextTargetPositions = modelPositionsRef.current[nextModelIndex];

    // Swarm 위치 계산
    if (noise3DRef.current) {
      const sourceVec = new THREE.Vector3();
      const targetVec = new THREE.Vector3();
      const swarmVec = new THREE.Vector3();
      const tempVec = new THREE.Vector3();
      const centerOffsetAmount = 10 * MORPH_CONFIG.swarmDistanceFactor;

      for (let i = 0; i < sourcePositionsRef.current.length / 3; i++) {
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
      const progress = Math.min(elapsed / MORPH_CONFIG.duration, 1);

      // Cubic bezier easing
      const t = progress;
      const t2 = t * t;
      const t3 = t2 * t;
      const easeProgress = 3 * t2 - 2 * t3 + (t3 - 2 * t2 + t) * 0.4;

      setMorphProgress(easeProgress);

      if (progress < 1) {
        morphTimelineRef.current = requestAnimationFrame(animate);
      } else {
        // 완료
        setCurrentModelIndex(nextModelIndex);
        if (
          currentPositionsRef.current &&
          nextTargetPositions &&
          sourcePositionsRef.current
        ) {
          currentPositionsRef.current.set(nextTargetPositions);
          sourcePositionsRef.current.set(nextTargetPositions);
        }
        setMorphProgress(0);
        setIsMorphing(false);
        const modelNames = ["Rocket", "Man", "Saturn", "Telephone"];
        onShapeChange?.(modelNames[nextModelIndex]);
        morphTimelineRef.current = null;
      }
    };

    morphTimelineRef.current = requestAnimationFrame(animate);
  }, [isMorphing, currentModelIndex, onShapeChange]);

  // 모프 애니메이션 업데이트
  const updateMorphAnimation = useCallback(
    (positions: Float32Array, elapsedTime: number) => {
      if (
        !sourcePositionsRef.current ||
        !swarmPositionsRef.current ||
        !currentPositionsRef.current ||
        modelPositionsRef.current.length === 0 ||
        !noise3DRef.current ||
        !noise4DRef.current
      )
        return;

      const t = morphProgress;
      // 모프 중일 때는 다음 모델 인덱스 사용
      const targetIndex = isMorphing
        ? nextModelIndexRef.current
        : currentModelIndex;
      const targets = modelPositionsRef.current[targetIndex];
      const effectStrength = Math.sin(t * Math.PI);
      const currentSwirl = effectStrength * MORPH_CONFIG.swirlFactor * 0.05;
      const currentNoise = effectStrength * MORPH_CONFIG.noiseMaxStrength;

      const sourceVec = new THREE.Vector3();
      const swarmVec = new THREE.Vector3();
      const targetVec = new THREE.Vector3();
      const bezPos = new THREE.Vector3();
      const tempVec = new THREE.Vector3();
      const swirlAxis = new THREE.Vector3();
      const noiseOffset = new THREE.Vector3();

      const particleCount = positions.length / 3;

      for (let i = 0; i < particleCount; i++) {
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
          const noiseTime = elapsedTime * MORPH_CONFIG.noiseTimeScale;
          noiseOffset.set(
            noise4DRef.current(
              bezPos.x * MORPH_CONFIG.noiseFrequency,
              bezPos.y * MORPH_CONFIG.noiseFrequency,
              bezPos.z * MORPH_CONFIG.noiseFrequency,
              noiseTime
            ),
            noise4DRef.current(
              bezPos.x * MORPH_CONFIG.noiseFrequency + 100,
              bezPos.y * MORPH_CONFIG.noiseFrequency + 100,
              bezPos.z * MORPH_CONFIG.noiseFrequency + 100,
              noiseTime
            ),
            noise4DRef.current(
              bezPos.x * MORPH_CONFIG.noiseFrequency + 200,
              bezPos.y * MORPH_CONFIG.noiseFrequency + 200,
              bezPos.z * MORPH_CONFIG.noiseFrequency + 200,
              noiseTime
            )
          );
          bezPos.addScaledVector(noiseOffset, currentNoise);
        }

        positions[i3] = bezPos.x;
        positions[i3 + 1] = bezPos.y;
        positions[i3 + 2] = bezPos.z;
      }
    },
    [morphProgress, currentModelIndex, isMorphing]
  );

  // 색상 스킴 변경 함수
  const handleColorSchemeChange = useCallback(
    (scheme: ColorScheme) => {
      setColorScheme(scheme);
      if (shaderMaterialRef.current) {
        const colors = COLOR_SCHEMES[scheme];
        shaderMaterialRef.current.uniforms.uColor1.value = colors.color1;
        shaderMaterialRef.current.uniforms.uColor2.value = colors.color2;
      }
      onColorSchemeChange?.(scheme);
    },
    [onColorSchemeChange]
  );

  // 외부에서 사용할 수 있도록 노출
  useEffect(() => {
    const win = window as Window & {
      particleSystem?: {
        triggerMorph: () => void;
        setColorScheme: (scheme: ColorScheme) => void;
      };
    };
    win.particleSystem = {
      triggerMorph,
      setColorScheme: handleColorSchemeChange,
    };

    // 디버그: 시스템이 준비되었는지 확인
    console.log(
      "ParticleSystem ready, triggerMorph and setColorScheme available"
    );

    return () => {
      delete win.particleSystem;
    };
  }, [triggerMorph, handleColorSchemeChange]);

  // 클릭 이벤트
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
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

  // 애니메이션 업데이트
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uTime.value = time;
      shaderMaterialRef.current.uniforms.uMorphProgress.value = morphProgress;
      shaderMaterialRef.current.uniforms.uEffectStrength.value = isMorphing
        ? Math.sin(morphProgress * Math.PI)
        : 0;
      shaderMaterialRef.current.uniforms.uNoiseStrength.value = isMorphing
        ? MORPH_CONFIG.noiseMaxStrength * Math.sin(morphProgress * Math.PI)
        : 0;
    }

    // 모프 중일 때 위치 업데이트
    if (isMorphing && meshRef.current?.geometry) {
      const positions = meshRef.current.geometry.attributes.position
        .array as Float32Array;
      updateMorphAnimation(positions, time);
      meshRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={wrapperRef}>
      <points ref={meshRef} material={shaderMaterial}>
        <bufferGeometry />
      </points>
    </group>
  );
}
