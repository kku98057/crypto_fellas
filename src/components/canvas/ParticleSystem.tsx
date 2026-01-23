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
  generateFilledSphere,
  generatePlane,
} from "../../utils/shapeGenerators";
import vertexShader from "../../shaders/particles/vertex.glsl?raw";
import fragmentShader from "../../shaders/particles/fragment.glsl?raw";
import {
  MORPH_CONFIG,
  NAME_DENSITY_WEIGHTS,
  NAME_EDGE_BRIGHTNESS,
  PARTICLE_COUNT,
  PARTICLE_MODEL_PATH,
  PARTICLE_SHAPE_SIZE,
  PARTICLE_SIZE_SCALE,
  TEXTURE_PATHS,
} from "../../enum/ParticlesEnum";

/**
 * 이름에 따라 밀도 가중치를 가져오는 함수
 */
function getDensityWeight(name: string): number {
  if (!name) return NAME_DENSITY_WEIGHTS.default;

  // 정확한 이름 매칭만 사용 (부분 매칭 제거)
  if (NAME_DENSITY_WEIGHTS[name]) {
    return NAME_DENSITY_WEIGHTS[name];
  }

  return NAME_DENSITY_WEIGHTS.default;
}

/**
 * 모델별 외곽 밝기 설정
 * 각 모델마다 이름 기반 외곽 밝기를 설정할 수 있습니다.
 * 기본값은 1.0입니다.
 * 이름을 넣지 않으면 모든 child에 기본값이 적용됩니다.
 */
interface ModelEdgeBrightnessConfig {
  default?: number; // 기본 외곽 밝기 (이름이 없거나 매칭되지 않을 때)
  names?: Record<string, number>; // 이름별 외곽 밝기 설정
}

/**
 * 이름에 따라 외곽 밝기를 가져오는 함수
 * ParticlesEnum.ts의 NAME_EDGE_BRIGHTNESS를 기본으로 사용
 * config가 제공되면 그것을 우선 사용 (모델별 커스텀 설정용)
 */
function getEdgeBrightness(
  name: string,
  config?: ModelEdgeBrightnessConfig
): number {
  // config가 제공되면 그것을 사용 (모델별 커스텀 설정)
  if (config) {
    const defaultBrightness = config.default ?? NAME_EDGE_BRIGHTNESS.default;

    // 이름이 없으면 기본값 반환
    if (!name || !config.names) {
      return defaultBrightness;
    }

    // 정확한 이름 매칭만 사용 (부분 매칭 제거)
    if (config.names[name] !== undefined) {
      return config.names[name];
    }

    return defaultBrightness;
  }

  // config가 없으면 ParticlesEnum.ts의 공통 설정 사용
  // 이름이 없거나 매칭되지 않으면 기본값 반환
  if (!name || !NAME_EDGE_BRIGHTNESS.names) {
    return NAME_EDGE_BRIGHTNESS.default;
  }

  // 정확한 이름 매칭만 사용 (부분 매칭 제거)
  if (NAME_EDGE_BRIGHTNESS.names[name] !== undefined) {
    return NAME_EDGE_BRIGHTNESS.names[name];
  }

  // 매칭되지 않으면 기본값 반환 (모든 메시에 공통 적용)
  return NAME_EDGE_BRIGHTNESS.default;
}

/**
 * GLTF 모델에서 파티클 위치와 외곽 밝기를 추출하는 클래스
 */
class CreateParticlePositions {
  gltf: { scene: THREE.Object3D };
  count: number;
  edgeBrightnessConfig?: ModelEdgeBrightnessConfig;

  constructor(
    gltf: { scene: THREE.Object3D },
    count: number,
    edgeBrightnessConfig?: ModelEdgeBrightnessConfig
  ) {
    this.gltf = gltf;
    this.count = count;
    this.edgeBrightnessConfig = edgeBrightnessConfig;
  }

  createParticles(): {
    positions: Float32Array;
    edgeBrightness: Float32Array;
  } {
    interface VertexData {
      position: THREE.Vector3;
      edgeBrightness: number;
    }

    const vertices: VertexData[] = [];
    const tempVec = new THREE.Vector3();

    // 모델의 모든 메시에서 vertex 위치 수집 (이름 기반 밀도 및 외곽 밝기 적용)
    this.gltf.scene.traverse((child) => {
      /**
       * Cylinder_TT_checker_1024x1024_UV_GRID_0
       * Circle002_glass_0
       * Circle003_TT_checker_1024x1024_UV_GRID_0
       * Circle004_TT_checker_1024x1024_UV_GRID_0
       * Cube002_TT_checker_1024x1024_UV_GRID_0
       */
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry;
        if (geometry) {
          // 위치 속성 가져오기
          const positionAttribute = geometry.attributes.position;
          if (positionAttribute) {
            // 이름에 따른 밀도 가중치 및 외곽 밝기 가져오기
            const meshName = child.name || "";
            const densityWeight = getDensityWeight(meshName);
            const edgeBrightness = getEdgeBrightness(
              meshName,
              this.edgeBrightnessConfig
            );

            const matrix = new THREE.Matrix4();
            matrix.multiplyMatrices(
              this.gltf.scene.matrixWorld,
              child.matrixWorld
            );

            // 각 vertex의 월드 좌표 계산
            for (let i = 0; i < positionAttribute.count; i++) {
              tempVec.fromBufferAttribute(positionAttribute, i);
              tempVec.applyMatrix4(matrix);

              // 밀도 가중치에 따라 버텍스를 여러 번 추가
              // 가중치가 1.0이면 1번, 2.0이면 평균 2번, 0.5이면 50% 확률로 추가
              if (densityWeight >= 1.0) {
                // 가중치가 1.0 이상이면 정수 부분만큼 확실히 추가하고, 소수 부분은 확률적으로 추가
                const integerPart = Math.floor(densityWeight);
                const fractionalPart = densityWeight - integerPart;

                // 정수 부분만큼 확실히 추가
                for (let j = 0; j < integerPart; j++) {
                  vertices.push({
                    position: tempVec.clone(),
                    edgeBrightness,
                  });
                }

                // 소수 부분은 확률적으로 추가
                if (Math.random() < fractionalPart) {
                  vertices.push({
                    position: tempVec.clone(),
                    edgeBrightness,
                  });
                }
              } else {
                // 가중치가 1.0 미만이면 확률적으로 추가
                if (Math.random() < densityWeight) {
                  vertices.push({
                    position: tempVec.clone(),
                    edgeBrightness,
                  });
                }
              }
            }

            // 디버그 정보 출력 (항상 출력)
            console.log(
              `📦 Mesh "${meshName || "(이름 없음)"}": ${
                positionAttribute.count
              } vertices, 밀도: ${densityWeight.toFixed(
                2
              )}, 밝기: ${edgeBrightness.toFixed(2)}`
            );
          }
        }
      }
    });

    // 충분한 파티클이 없으면 보간하여 생성
    if (vertices.length === 0) {
      console.warn("모델에서 vertex를 찾을 수 없습니다. 기본 형태 사용");
      const defaultBrightness = this.edgeBrightnessConfig?.default ?? 1.0;
      return {
        positions: new Float32Array(this.count * 3),
        edgeBrightness: new Float32Array(this.count).fill(defaultBrightness),
      };
    }

    // 요청된 개수만큼 파티클 선택 (균등 분포)
    const positions = new Float32Array(this.count * 3);
    const edgeBrightness = new Float32Array(this.count);

    if (vertices.length >= this.count) {
      // vertices가 충분히 많으면 균등 샘플링 (실수 step 사용)
      const step = vertices.length / this.count; // 실수로 계산

      for (let i = 0; i < this.count; i++) {
        // 가상 인덱스를 실수로 계산하여 전체 범위 커버
        const virtualIndex = i * step;
        const baseIndex = Math.floor(virtualIndex);
        // 다음 step 범위 내에서 랜덤 오프셋 추가
        const randomOffset = Math.floor(
          Math.random() * Math.max(1, Math.ceil(step))
        );
        const index = Math.min(baseIndex + randomOffset, vertices.length - 1);

        const vertex = vertices[index];
        positions[i * 3] = vertex.position.x;
        positions[i * 3 + 1] = vertex.position.y;
        positions[i * 3 + 2] = vertex.position.z;
        edgeBrightness[i] = vertex.edgeBrightness;
      }
    } else {
      // vertices가 부족하면 순환하며 샘플링
      console.warn(
        `⚠️ 파티클(${this.count})이 vertices(${vertices.length})보다 많아 순환 샘플링합니다.`
      );

      for (let i = 0; i < this.count; i++) {
        // 전체를 균등하게 분배하여 순환
        const virtualIndex = (i / this.count) * vertices.length;
        const index = Math.floor(virtualIndex) % vertices.length;

        const vertex = vertices[index];
        positions[i * 3] = vertex.position.x;
        positions[i * 3 + 1] = vertex.position.y;
        positions[i * 3 + 2] = vertex.position.z;
        edgeBrightness[i] = vertex.edgeBrightness;
      }
    }

    const actualStep = vertices.length / this.count;
    console.log(
      `✅ 모델에서 ${vertices.length}개 vertex (이름 기반 밀도 적용) 중 ${this.count}개 파티클 생성`,
      `| Step: ${actualStep.toFixed(2)} (${
        vertices.length >= this.count ? "균등 샘플링" : "순환 샘플링"
      })`
    );

    // 디버깅: 생성된 파티클의 분포 확인
    if (vertices.length < this.count) {
      const uniqueIndices = new Set();
      for (let i = 0; i < this.count; i++) {
        const virtualIndex = (i / this.count) * vertices.length;
        const index = Math.floor(virtualIndex) % vertices.length;
        uniqueIndices.add(index);
      }
      console.log(
        `   → 실제 사용된 고유 vertices: ${uniqueIndices.size}/${vertices.length}`
      );
    }

    return { positions, edgeBrightness };
  }
}

/**
 * 색상 스킴 정의
 * colors 배열에 원하는 만큼 색상을 지정할 수 있습니다.
 * weights 배열로 각 색상이 차지하는 비율을 지정할 수 있습니다.
 * weights가 없으면 균등하게 분배됩니다.
 * angle로 색상 분배 방향을 조정할 수 있습니다 (도 단위, 기본값: 0).
 *
 * 색상 지정 방법:
 * - Hex 숫자: new THREE.Color(0xff0000) 또는 new THREE.Color(0xFF0000)
 * - Hex 문자열: new THREE.Color("#ff0000") 또는 new THREE.Color("#FF0000")
 * - RGB 문자열: new THREE.Color("rgb(255, 0, 0)")
 * - 색상 이름: new THREE.Color("red")
 *
 * weights 예시:
 * - [0.4, 0.1, 0.5]: 첫 번째 색상 40%, 두 번째 10%, 세 번째 50%
 * - [1, 1, 1]: 균등 분배 (각 33.3%)
 *
 * angle 예시:
 * - 0: 위에서 아래로 (기본값, Y축 기준)
 * - 90: 왼쪽에서 오른쪽으로 (X축 기준)
 * - 45: 대각선 (왼쪽 위에서 오른쪽 아래)
 * - -45: 대각선 (오른쪽 위에서 왼쪽 아래)
 */
export const COLOR_SCHEMES = {
  fire: {
    colors: [
      new THREE.Color("#4097ff"), //
    ],
    angle: 0, // 기본값: 위에서 아래
  },
  neon: {
    colors: [
      new THREE.Color("#ff00ff"), // 마젠타 (hex 문자열)
      new THREE.Color("#00ffff"), // 시안 (hex 문자열)
    ],
    angle: 0, // 기본값
  },
  nature: {
    colors: [
      new THREE.Color(0x00ff00), // 초록색 (hex 숫자)
      new THREE.Color(0x66ffcc), // 청록색 (hex 숫자)
    ],
    angle: 0, // 기본값
  },
  rainbow: {
    colors: [
      new THREE.Color(0xff0000), // 빨강 (아래쪽 - 많이)
      new THREE.Color(0x0000ff), // 파랑 (중간 - 얇은 밴드)
      new THREE.Color(0xffff00), // 노랑 (위쪽 - 많이)
    ],
    weights: [0.6, 0.3, 0.1],
    angle: 45, // 위에서 아래로
  },
  // 예시: 한 개 색상 (단색) - hex 문자열 사용
  red: {
    colors: [new THREE.Color("#ff0000")],
    angle: 0, // 기본값
  },
  // 예시: 세 개 색상 - hex 문자열 사용
  sunset: {
    colors: [
      new THREE.Color("#ff6b6b"), // 연한 빨강
      new THREE.Color("#ffa500"), // 주황
      new THREE.Color("#ffd700"), // 금색
    ],
    angle: 45, // 대각선 (왼쪽 위에서 오른쪽 아래)
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

  // GSAP 애니메이션을 위한 직접 접근 가능한 객체들
  const animatableRef = useRef({
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    influences: [0, 0, 0, 0, 0],
  });

  // 모프 상태
  const [morphProgress, setMorphProgress] = useState(0);
  const [isMorphing, setIsMorphing] = useState(false);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const nextModelIndexRef = useRef<number>(0);

  // 스크롤 애니메이션 상태 (직접 사용하지 않고 setter만 사용)
  const [, setParticleScale] = useState(2.0); // 초기 크기: 크게
  const [, setScatterAmount] = useState(1.0); // 초기 산포: 완전히 흩어짐
  const [, setModelOffset] = useState<[number, number, number]>([0, 0, 0]); // 모델 위치 오프셋
  const [, setOpacity] = useState(1.0); // 투명도
  const [, setRotation] = useState<[number, number, number]>([0, 0, 0]); // 모델 회전

  // 색상 스킴 상태
  const [colorScheme, setColorScheme] = useState<ColorScheme>("rainbow");

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
      const texturePaths = TEXTURE_PATHS;

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
          : Array(TEXTURE_PATHS.length).fill(defaultTexture) // 동적으로 개수 설정
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
      console.log("텍스처 개수:", textures.length);
      console.log("================================");
    }
  }, [textures, defaultTexture]);

  // Shader Material 생성
  const shaderMaterial = useMemo(() => {
    // 텍스처가 로드되지 않았으면 기본 텍스처 사용
    const textureCount = TEXTURE_PATHS.length; // 동적으로 텍스처 개수 계산
    const finalTextures =
      textures.length > 0 ? textures : Array(textureCount).fill(defaultTexture); // 동적으로 개수 설정

    console.log("=== Shader Material 생성 ===");
    console.log("텍스처 개수:", textureCount);
    console.log("최종 텍스처 배열:", finalTextures.length);

    // 현재 색상 스킴
    const colorSchemeData = COLOR_SCHEMES[colorScheme];
    const colorArray = colorSchemeData.colors;
    const colorCount = colorArray.length;
    // weights가 없으면 균등 분배 (각 1/n)
    const weights =
      "weights" in colorSchemeData && colorSchemeData.weights
        ? colorSchemeData.weights
        : colorArray.map(() => 1.0 / colorCount);
    // angle이 없으면 기본값 0 (위에서 아래)
    const angle =
      "angle" in colorSchemeData && typeof colorSchemeData.angle === "number"
        ? colorSchemeData.angle
        : 0;

    // 색상 배열을 vec3 배열로 변환 (최대 10개 색상 지원)
    const maxColors = 10;
    const colorValues: THREE.Vector3[] = [];
    const weightValues: number[] = [];
    for (let i = 0; i < maxColors; i++) {
      if (i < colorCount) {
        const color = colorArray[i];
        // THREE.Color를 THREE.Vector3로 변환 (r, g, b -> x, y, z)
        colorValues.push(new THREE.Vector3(color.r, color.g, color.b));
        weightValues.push(weights[i] || 0);
      } else {
        // 부족한 색상은 마지막 색상으로 채움
        const lastColor = colorArray[colorCount - 1];
        colorValues.push(
          new THREE.Vector3(lastColor.r, lastColor.g, lastColor.b)
        );
        weightValues.push(0);
      }
    }

    // 기본 모델 Y 범위 (PARTICLE_SHAPE_SIZE 기반)
    const defaultMinY = -PARTICLE_SHAPE_SIZE / 2;
    const defaultMaxY = PARTICLE_SHAPE_SIZE / 2;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        u_scale: { value: PARTICLE_SIZE_SCALE }, // 파티클 크기 (ParticlesEnum.ts에서 조정 가능)
        u_opacity: { value: 1 },
        u_morphTargetInfluences: { value: [0, 0, 0, 0, 0] }, // 5개 모르프 타겟
        uMorphProgress: { value: 0 },
        uEffectStrength: { value: 0 },
        uNoiseStrength: { value: 0 },
        uScatterAmount: { value: 1.0 }, // 초기 산포: 완전히 흩어짐
        uSwirlFactor: { value: MORPH_CONFIG.swirlFactor },
        // 색상 배열 uniform 추가
        uColors: { value: colorValues },
        uColorCount: { value: colorCount },
        uColorWeights: { value: weightValues }, // 색상별 비율
        uColorAngle: { value: (angle * Math.PI) / 180 }, // 각도 (라디안으로 변환)
        // 모델 로컬 Y 범위 (색상 정규화용) - 모델 로딩 후 업데이트됨
        uModelMinY: { value: defaultMinY },
        uModelMaxY: { value: defaultMaxY },
        // 텍스처 사용 여부 (기본값: 1.0 = 사용)
        uUseTexture: { value: 1.0 },
        // 하위 호환성을 위해 uColor1, uColor2 유지
        uColor1: { value: colorArray[0] },
        uColor2: { value: colorArray[colorCount > 1 ? 1 : 0] },
        // 텍스처는 최대 5개까지 지원, 부족하면 첫 번째 텍스처로 채움
        u_texture1: { value: finalTextures[0] || defaultTexture },
        u_texture2: {
          value: finalTextures[1] || finalTextures[0] || defaultTexture,
        },
        u_texture3: {
          value: finalTextures[2] || finalTextures[0] || defaultTexture,
        },
        u_texture4: {
          value: finalTextures[3] || finalTextures[0] || defaultTexture,
        },
        u_texture5: {
          value: finalTextures[4] || finalTextures[0] || defaultTexture,
        },
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

    // Shader Material Uniforms 확인 (디버깅용)
    if (shaderMaterialRef.current) {
      console.log("=== Shader Material Uniforms ===");
      console.log(
        "uUseTexture:",
        shaderMaterialRef.current.uniforms.uUseTexture.value
      );
      console.log(
        "u_texture1:",
        shaderMaterialRef.current.uniforms.u_texture1.value
      );
      console.log(
        "u_texture2:",
        shaderMaterialRef.current.uniforms.u_texture2.value
      );
      console.log("================================");
    }
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
        const modelPaths = PARTICLE_MODEL_PATH;

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

        const [gamepad, card, saturn] = await Promise.all(
          modelPaths.map(loadModelSafely)
        );

        // 모델 로딩 결과 출력
        console.log("=== 모델 로딩 결과 ===");
        console.log("Gamepad (model_4):", gamepad ? "✓ 로드됨" : "✗ 실패");
        console.log("Card (model_2):", card ? "✓ 로드됨" : "✗ 실패");
        console.log("Saturn (model_3):", saturn ? "✓ 로드됨" : "✗ 실패");
        console.log("===================");

        // 모델이 있으면 중앙 정렬 및 동일 크기로 스케일링
        // PARTICLE_SHAPE_SIZE를 targetSize로 사용 (ParticlesEnum.ts에서 조정 가능)
        const targetSize = PARTICLE_SHAPE_SIZE; // 모든 모델을 이 크기로 통일
        [gamepad, card, saturn].forEach((result, index) => {
          if (result) {
            centerModels(result.scene, targetSize);
            console.log(
              `Model ${
                index + 1
              } 중앙 정렬 및 크기 조정 완료 (목표 크기: ${targetSize})`
            );
          }
        });

        // 모든 모델에 ParticlesEnum.ts의 공통 외곽 밝기 설정 사용
        const modelEdgeBrightnessConfigs: (
          | ModelEdgeBrightnessConfig
          | undefined
        )[] = [
          undefined, // Gamepad 모델 - 공통 설정 사용
          undefined, // Card 모델 - 공통 설정 사용
          undefined, // Saturn 모델 - 공통 설정 사용
        ];

        // 파티클 생성 (모델이 없으면 기본 형태 사용)
        const particleCount = PARTICLE_COUNT;
        const shapeSize = PARTICLE_SHAPE_SIZE; // 기본 형태도 동일한 크기로

        // Gamepad 모델 파티클 생성
        const gamepadData = gamepad
          ? new CreateParticlePositions(
              gamepad,
              particleCount,
              modelEdgeBrightnessConfigs[0]
            ).createParticles()
          : {
              positions: generateSphere(particleCount, shapeSize),
              edgeBrightness: new Float32Array(particleCount).fill(
                NAME_EDGE_BRIGHTNESS.default
              ),
            };

        // Card 모델 파티클 생성
        const cardData = card
          ? new CreateParticlePositions(
              card,
              particleCount,
              modelEdgeBrightnessConfigs[1]
            ).createParticles()
          : {
              positions: generateCube(particleCount, shapeSize),
              edgeBrightness: new Float32Array(particleCount).fill(
                NAME_EDGE_BRIGHTNESS.default
              ),
            };

        // Saturn 모델 파티클 생성
        const saturnData = saturn
          ? new CreateParticlePositions(
              saturn,
              particleCount,
              modelEdgeBrightnessConfigs[2]
            ).createParticles()
          : {
              positions: generatePyramid(particleCount, shapeSize),
              edgeBrightness: new Float32Array(particleCount).fill(
                NAME_EDGE_BRIGHTNESS.default
              ),
            };

        // 4번째 모르프: 내부가 가득 찬 Sphere 생성 (화면을 덮을 수 있을 만큼 큰 구)
        const filledSphereData = {
          positions: generateFilledSphere(particleCount, shapeSize),
          edgeBrightness: new Float32Array(particleCount).fill(
            NAME_EDGE_BRIGHTNESS.default
          ),
        };

        // 5번째 모르프: Plane 생성
        const planeData = {
          positions: generatePlane(particleCount, shapeSize),
          edgeBrightness: new Float32Array(particleCount).fill(
            NAME_EDGE_BRIGHTNESS.default
          ),
        };

        // 모든 파티클 위치를 동일한 크기로 정규화 (모델별 바운딩 박스 계산)
        const normalizeWithBounds = (
          positions: Float32Array,
          targetSize: number
        ): { positions: Float32Array; minY: number; maxY: number } => {
          if (positions.length === 0) {
            return { positions, minY: -targetSize / 2, maxY: targetSize / 2 };
          }

          const count = positions.length / 3;
          let minY = Infinity,
            maxY = -Infinity;

          // Y 범위 계산
          for (let i = 0; i < count; i++) {
            const y = positions[i * 3 + 1];
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }

          const normalized = normalizeParticlePositions(positions, targetSize);

          // 정규화 후 다시 Y 범위 계산
          let normalizedMinY = Infinity,
            normalizedMaxY = -Infinity;
          for (let i = 0; i < count; i++) {
            const y = normalized[i * 3 + 1];
            normalizedMinY = Math.min(normalizedMinY, y);
            normalizedMaxY = Math.max(normalizedMaxY, y);
          }

          return {
            positions: normalized,
            minY: normalizedMinY,
            maxY: normalizedMaxY,
          };
        };

        const gamepadNormalized = normalizeWithBounds(
          gamepadData.positions,
          targetSize
        );
        const cardNormalized = normalizeWithBounds(
          cardData.positions,
          targetSize
        );
        const saturnNormalized = normalizeWithBounds(
          saturnData.positions,
          targetSize
        );
        const filledSphereNormalized = normalizeWithBounds(
          filledSphereData.positions,
          targetSize
        );
        const planeNormalized = normalizeWithBounds(
          planeData.positions,
          targetSize
        );

        const gamepadPositions = gamepadNormalized.positions;
        const cardPositions = cardNormalized.positions;
        const saturnPositions = saturnNormalized.positions;
        const filledSpherePositions = filledSphereNormalized.positions;
        const planePositions = planeNormalized.positions;

        // 현재 모델의 Y 범위 저장 (기본값: gamepad)
        const currentMinY = gamepadNormalized.minY;
        const currentMaxY = gamepadNormalized.maxY;

        // 외곽 밝기는 위치 정규화 후에도 유지
        const currentEdgeBrightness = gamepadData.edgeBrightness;

        console.log(
          "모든 모델 파티클 위치 정규화 완료 (목표 크기:",
          targetSize,
          ")"
        );

        // 텍스처 인덱스 배열 생성 (위치 기반 규칙적 패턴)
        const textureIndices = new Float32Array(particleCount);

        // 텍스처 개수 (TEXTURE_PATHS 배열 길이에 따라 자동 조정)
        const textureCount = TEXTURE_PATHS.length;

        // 힌트 방식: 파티클별 랜덤 값 생성 (개별 전환 속도용)
        const rnd1Array = new Float32Array(particleCount);
        const rnd2Array = new Float32Array(particleCount);

        // 위치 기반 해시 함수로 규칙적으로 할당
        const hash = (x: number, y: number, z: number) => {
          const n = x * 73856093 + y * 19349663 + z * 83492791;
          return Math.abs(Math.floor(n)) % textureCount; // 동적으로 텍스처 개수 사용
        };

        // 랜덤 값 생성 함수 (위치 기반, 일관성 유지)
        const seededRandom = (seed: number) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };

        // 각 파티클의 위치를 기반으로 규칙적으로 텍스처 인덱스 및 랜덤 값 할당
        for (let i = 0; i < particleCount; i++) {
          const x = gamepadPositions[i * 3];
          const y = gamepadPositions[i * 3 + 1];
          const z = gamepadPositions[i * 3 + 2];

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
        // 모델 Y 범위를 shader에 설정
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.uModelMinY.value = currentMinY;
          shaderMaterialRef.current.uniforms.uModelMaxY.value = currentMaxY;
        }

        bufferGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(gamepadPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget1",
          new THREE.Float32BufferAttribute(cardPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget2",
          new THREE.Float32BufferAttribute(saturnPositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget3",
          new THREE.Float32BufferAttribute(filledSpherePositions, 3)
        );
        bufferGeometry.setAttribute(
          "morphTarget4",
          new THREE.Float32BufferAttribute(planePositions, 3)
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
        // 외곽 밝기 attribute 추가
        bufferGeometry.setAttribute(
          "aEdgeBrightness",
          new THREE.Float32BufferAttribute(currentEdgeBrightness, 1)
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

        // 모델 위치 저장 (5개 모르프)
        modelPositionsRef.current = [
          gamepadPositions,
          cardPositions,
          saturnPositions,
          filledSpherePositions,
          planePositions,
        ];
        sourcePositionsRef.current = new Float32Array(gamepadPositions);
        currentPositionsRef.current = new Float32Array(gamepadPositions);

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
        // 완료 - 최종 위치를 모든 ref에 저장
        setCurrentModelIndex(nextModelIndex);
        nextModelIndexRef.current = nextModelIndex;

        if (
          currentPositionsRef.current &&
          nextTargetPositions &&
          sourcePositionsRef.current &&
          meshRef.current?.geometry
        ) {
          // geometry의 현재 위치를 모든 ref에 복사
          const finalPositions = meshRef.current.geometry.attributes.position
            .array as Float32Array;
          currentPositionsRef.current.set(finalPositions);
          sourcePositionsRef.current.set(finalPositions);

          console.log("모프 완료 - 위치 업데이트:", {
            modelIndex: nextModelIndex,
            modelName: ["Gamepad", "Card", "Saturn", "FilledSphere", "Plane"][
              nextModelIndex
            ],
          });
        }
        setMorphProgress(0);
        setIsMorphing(false);
        const modelNames = [
          "Gamepad",
          "Card",
          "Saturn",
          "FilledSphere",
          "Plane",
        ];
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
      console.log("=== 색상 스킴 변경 요청 ===");
      console.log("스킴:", scheme);

      setColorScheme(scheme);
      if (shaderMaterialRef.current) {
        const colorSchemeData = COLOR_SCHEMES[scheme];
        console.log("색상 데이터:", colorSchemeData);

        const colorArray = colorSchemeData.colors;
        const colorCount = colorArray.length;
        console.log("색상 개수:", colorCount);

        // weights가 없으면 균등 분배 (각 1/n)
        const weights =
          "weights" in colorSchemeData && colorSchemeData.weights
            ? colorSchemeData.weights
            : colorArray.map(() => 1.0 / colorCount);

        // angle이 없으면 기본값 0 (위에서 아래)
        const angle =
          "angle" in colorSchemeData &&
          typeof colorSchemeData.angle === "number"
            ? colorSchemeData.angle
            : 0;

        // 색상 배열 업데이트
        const maxColors = 10;
        for (let i = 0; i < maxColors; i++) {
          if (i < colorCount) {
            const color = colorArray[i];
            // THREE.Color를 THREE.Vector3로 변환 (r, g, b -> x, y, z)
            shaderMaterialRef.current.uniforms.uColors.value[i] =
              new THREE.Vector3(color.r, color.g, color.b);
            shaderMaterialRef.current.uniforms.uColorWeights.value[i] =
              weights[i] || 0;
          } else {
            // 부족한 색상은 마지막 색상으로 채움
            const lastColor = colorArray[colorCount - 1];
            shaderMaterialRef.current.uniforms.uColors.value[i] =
              new THREE.Vector3(lastColor.r, lastColor.g, lastColor.b);
            shaderMaterialRef.current.uniforms.uColorWeights.value[i] = 0;
          }
        }

        // 색상 개수 업데이트
        shaderMaterialRef.current.uniforms.uColorCount.value = colorCount;
        // 각도 업데이트 (라디안으로 변환)
        shaderMaterialRef.current.uniforms.uColorAngle.value =
          (angle * Math.PI) / 180;

        // 하위 호환성을 위해 uColor1, uColor2도 업데이트
        shaderMaterialRef.current.uniforms.uColor1.value = colorArray[0];
        shaderMaterialRef.current.uniforms.uColor2.value =
          colorArray[colorCount > 1 ? 1 : 0];
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
        setUseTexture: (use: boolean) => void;
        setMorphProgress: (progress: number) => void;
        setTargetModelIndex: (index: number) => void;
        setInfluences: (influences: number[]) => void;
        setScale: (scale: number) => void;
        setScatter: (scatter: number) => void;
        setModelOffset: (
          offset:
            | [number, number, number]
            | { x?: number; y?: number; z?: number }
        ) => void;
        setOpacity: (opacity: number) => void;
        setRotation: (rotation: [number, number, number]) => void;
        animatable: {
          rotation: { x: number; y: number; z: number };
          position: { x: number; y: number; z: number };
          influences: number[];
        };
      };
    };
    win.particleSystem = {
      triggerMorph,
      setColorScheme: handleColorSchemeChange,
      setOpacity: (opacity: number) => {
        setOpacity(opacity);
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.uOpacity.value = opacity;
        }
      },
      setRotation: (
        rotation:
          | [number, number, number]
          | { x?: number; y?: number; z?: number }
      ) => {
        if (wrapperRef.current) {
          // 객체 형태로 전달된 경우 (개별 축 설정)
          if (typeof rotation === "object" && !Array.isArray(rotation)) {
            const currentX = wrapperRef.current.rotation.x;
            const currentY = wrapperRef.current.rotation.y;
            const currentZ = wrapperRef.current.rotation.z;

            const newX = rotation.x !== undefined ? rotation.x : currentX;
            const newY = rotation.y !== undefined ? rotation.y : currentY;
            const newZ = rotation.z !== undefined ? rotation.z : currentZ;

            wrapperRef.current.rotation.set(newX, newY, newZ);
            // animatableRef도 동기화
            animatableRef.current.rotation.x = newX;
            animatableRef.current.rotation.y = newY;
            animatableRef.current.rotation.z = newZ;
            setRotation([newY, newX, newZ]); // 상태 업데이트 (순서 주의)
          } else {
            // 배열 형태로 전달된 경우 (전체 설정)
            const [x, y, z] = rotation as [number, number, number];
            wrapperRef.current.rotation.set(x, y, z);
            // animatableRef도 동기화
            animatableRef.current.rotation.x = x;
            animatableRef.current.rotation.y = y;
            animatableRef.current.rotation.z = z;
            setRotation([y, x, z]); // 상태 업데이트 (순서 주의)
          }
        }
      },
      setUseTexture: (use: boolean) => {
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.uUseTexture.value = use
            ? 1.0
            : 0.0;
          console.log("텍스처 사용 여부 변경:", use);
        }
      },
      setMorphProgress: () => {
        // 스크롤 기반 morph progress 설정 (사용하지 않음)
        // shader의 u_morphTargetInfluences는 setInfluences에서 직접 제어
      },
      setTargetModelIndex: (index: number) => {
        // 목표 모델 인덱스에 따라 shader의 u_morphTargetInfluences 직접 설정
        if (shaderMaterialRef.current) {
          const influences = [0, 0, 0, 0, 0]; // 5개 모르프 타겟

          // index: 0 = gamepad, 1 = card, 2 = saturn, 3 = filledSphere, 4 = plane
          if (index === 0) {
            // Gamepad (기본 position, influence 없음)
            influences[0] = 0;
            influences[1] = 0;
            influences[2] = 0;
            influences[3] = 0;
          } else if (index === 1) {
            // Card (morphTarget1)
            influences[0] = 1.0;
            influences[1] = 0;
            influences[2] = 0;
            influences[3] = 0;
          } else if (index === 2) {
            // Saturn (morphTarget2)
            influences[0] = 1.0; // Card를 거쳐야 함
            influences[1] = 1.0;
            influences[2] = 0;
            influences[3] = 0;
          } else if (index === 3) {
            // FilledSphere (morphTarget3)
            influences[0] = 0;
            influences[1] = 0;
            influences[2] = 1.0;
            influences[3] = 0;
          } else if (index === 4) {
            // Plane (morphTarget4)
            influences[0] = 0;
            influences[1] = 0;
            influences[2] = 0;
            influences[3] = 1.0;
          }

          shaderMaterialRef.current.uniforms.u_morphTargetInfluences.value =
            influences;
        }

        nextModelIndexRef.current = index;
        setCurrentModelIndex(index);
      },
      setInfluences: (influences: number[]) => {
        // Shader의 u_morphTargetInfluences를 직접 설정
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.u_morphTargetInfluences.value =
            influences;
          // animatableRef도 동기화
          animatableRef.current.influences = [...influences];
        }
      },
      animatable: animatableRef.current,
      setScale: (scale: number) => {
        setParticleScale(scale);
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.u_scale.value = scale;
        }
      },
      setScatter: (scatter: number) => {
        setScatterAmount(scatter);
        if (shaderMaterialRef.current) {
          shaderMaterialRef.current.uniforms.uScatterAmount.value = scatter;
        }
      },
      setModelOffset: (
        offset:
          | [number, number, number]
          | { x?: number; y?: number; z?: number }
      ) => {
        if (wrapperRef.current) {
          // 객체 형태로 전달된 경우 (개별 축 설정)
          if (typeof offset === "object" && !Array.isArray(offset)) {
            const currentX = wrapperRef.current.position.x;
            const currentY = wrapperRef.current.position.y;
            const currentZ = wrapperRef.current.position.z;

            const newX = offset.x !== undefined ? offset.x : currentX;
            const newY = offset.y !== undefined ? offset.y : currentY;
            const newZ = offset.z !== undefined ? offset.z : currentZ;

            wrapperRef.current.position.set(newX, newY, newZ);
            // animatableRef도 동기화
            animatableRef.current.position.x = newX;
            animatableRef.current.position.y = newY;
            animatableRef.current.position.z = newZ;
            setModelOffset([newY, newX, newZ]); // 상태 업데이트 (순서 주의)
          } else {
            // 배열 형태로 전달된 경우 (전체 설정)
            const [x, y, z] = offset as [number, number, number];
            wrapperRef.current.position.set(x, y, z);
            // animatableRef도 동기화
            animatableRef.current.position.x = x;
            animatableRef.current.position.y = y;
            animatableRef.current.position.z = z;
            setModelOffset([y, x, z]); // 상태 업데이트 (순서 주의)
          }
        }
      },
    };

    // 디버그: 시스템이 준비되었는지 확인
    console.log(
      "ParticleSystem ready, triggerMorph and setColorScheme available"
    );

    return () => {
      delete win.particleSystem;
    };
  }, [triggerMorph, handleColorSchemeChange]);

  // 클릭 이벤트 제거됨 - 버튼을 통해서만 morph 가능

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

    // animatableRef의 값이 변경되면 실제 객체에 반영
    if (wrapperRef.current) {
      wrapperRef.current.rotation.set(
        animatableRef.current.rotation.x,
        animatableRef.current.rotation.y,
        animatableRef.current.rotation.z
      );
      wrapperRef.current.position.set(
        animatableRef.current.position.x,
        animatableRef.current.position.y,
        animatableRef.current.position.z
      );
    }

    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.u_morphTargetInfluences.value =
        animatableRef.current.influences;
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
