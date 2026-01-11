import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ParticleSystem from "../components/canvas/ParticleSystem";
import ParticleControls from "../components/ParticleControls";
import PostProcessing from "../components/canvas/PostProcessing";
import PostProcessingGUI from "../components/PostProcessingGUI";
import ParticleGUI from "../components/ParticleGUI";
import type { ColorScheme } from "../types/ColorType";

// GSAP ScrollTrigger 등록
gsap.registerPlugin(ScrollTrigger);

interface PostProcessingConfig {
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    smoothing: number;
  };
  toneMapping: {
    enabled: boolean;
    exposure: number;
  };
  vignette: {
    enabled: boolean;
    offset: number;
    darkness: number;
  };
  chromaticAberration: {
    enabled: boolean;
    offset: [number, number];
  };
  depthOfField: {
    enabled: boolean;
    focusDistance: number;
    focalLength: number;
    bokehScale: number;
  };
}

interface ParticleSystemRef {
  triggerMorph: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setMorphProgress: (progress: number) => void; // 외부에서 morph progress 제어
  setTargetModelIndex: (index: number) => void; // 목표 모델 인덱스 설정
}

const MODEL_NAMES = ["Gamepad", "Card", "Saturn"];

export default function Home() {
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("fire");
  const systemRef = useRef<ParticleSystemRef | null>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  const [postProcessingConfig, setPostProcessingConfig] =
    useState<PostProcessingConfig>({
      bloom: {
        enabled: true, // Bloom 켜기
        intensity: 1.5,
        threshold: 0.3, // 낮춤 (더 많은 부분이 빛남)
        smoothing: 0.025,
      },
      toneMapping: {
        enabled: true,
        exposure: 1.0,
      },
      vignette: {
        enabled: false,
        offset: 0.5,
        darkness: 0.5,
      },
      chromaticAberration: {
        enabled: false,
        offset: [0.0005, 0.0005],
      },
      depthOfField: {
        enabled: false,
        focusDistance: 0.02,
        focalLength: 0.02,
        bokehScale: 2.0,
      },
    });

  useEffect(() => {
    const checkSystem = () => {
      const win = window as Window & {
        particleSystem?: ParticleSystemRef;
      };
      if (win.particleSystem) {
        systemRef.current = win.particleSystem;
      }
    };

    checkSystem();
    const interval = setInterval(checkSystem, 100);
    return () => clearInterval(interval);
  }, []);

  // GSAP ScrollTrigger 설정
  useEffect(() => {
    // systemRef가 준비될 때까지 대기
    const checkAndSetup = () => {
      if (!systemRef.current) {
        setTimeout(checkAndSetup, 100);
        return;
      }

      const sections = sectionsRef.current;

      // 각 섹션에 대해 ScrollTrigger 생성
      sections.forEach((section, index) => {
        if (!section) return;

        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: 1, // 스크롤과 애니메이션 동기화 (1 = 1초 딜레이)
          onUpdate: (self) => {
            const progress = self.progress; // 0~1 사이 값

            if (systemRef.current) {
              // 각 섹션별로 influence 계산
              const influences = [0, 0, 0, 0];

              if (index === 0) {
                // Section 0: Gamepad → Card
                influences[0] = progress; // card influence
                influences[1] = 0;
              } else if (index === 1) {
                // Section 1: Card → Saturn
                influences[0] = 1.0; // card는 완료
                influences[1] = progress; // saturn influence
              } else if (index === 2) {
                // Section 2: Saturn (고정)
                influences[0] = 1.0;
                influences[1] = 1.0;
              }

              // Shader에 직접 적용
              const win = window as Window & {
                particleSystem?: {
                  setInfluences?: (influences: number[]) => void;
                };
              };

              if (win.particleSystem?.setInfluences) {
                win.particleSystem.setInfluences(influences);
              }

              setCurrentModelIndex(index);
            }
          },
          onEnter: () => {
            console.log(`Entering section ${index}: ${MODEL_NAMES[index]}`);
          },
          onLeave: () => {
            console.log(`Leaving section ${index}: ${MODEL_NAMES[index]}`);
          },
          markers: false, // 디버깅용 마커 (개발 중에는 true로 설정)
        });
      });
    };

    checkAndSetup();

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  const handleShapeChange = () => {
    const win = window as Window & {
      particleSystem?: ParticleSystemRef;
    };

    if (win.particleSystem) {
      win.particleSystem.triggerMorph();
    } else if (systemRef.current) {
      systemRef.current.triggerMorph();
    } else {
      console.warn("ParticleSystem not ready yet");
      // 재시도
      setTimeout(() => {
        const retryWin = window as Window & {
          particleSystem?: ParticleSystemRef;
        };
        if (retryWin.particleSystem) {
          retryWin.particleSystem.triggerMorph();
        }
      }, 100);
    }
  };

  const handleColorSchemeChange = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    const win = window as Window & {
      particleSystem?: ParticleSystemRef;
    };

    if (win.particleSystem) {
      win.particleSystem.setColorScheme(scheme);
    } else if (systemRef.current) {
      systemRef.current.setColorScheme(scheme);
    } else {
      console.warn("ParticleSystem not ready yet for color scheme change");
      // 재시도
      setTimeout(() => {
        const retryWin = window as Window & {
          particleSystem?: ParticleSystemRef;
        };
        if (retryWin.particleSystem) {
          retryWin.particleSystem.setColorScheme(scheme);
        }
      }, 100);
    }
  };

  return (
    <>
      {/* Canvas를 fixed로 고정 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 75 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "#000000" }}
        >
          <Suspense fallback={null}>
            <ParticleSystem
              onShapeChange={(shapeName) => {
                const index = MODEL_NAMES.findIndex(
                  (name) => name === shapeName
                );
                if (index !== -1) setCurrentModelIndex(index);
              }}
              onColorSchemeChange={setColorScheme}
            />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              autoRotate
              autoRotateSpeed={0.5}
              enablePan={true}
              enableZoom={true}
              mouseButtons={{
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }}
            />
            <PostProcessing {...postProcessingConfig} />
          </Suspense>
        </Canvas>
      </div>

      {/* 스크롤 가능한 섹션들 (각 섹션 = 1개 모델) */}
      {/* <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        {MODEL_NAMES.map((modelName, index) => (
          <div
            key={index}
            ref={(el: HTMLDivElement | null) => {
              if (el) sectionsRef.current[index] = el;
            }}
            style={{
              height: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: "4rem",
                fontWeight: "bold",
                textShadow: "0 0 20px rgba(0,0,0,0.8)",
                opacity: 0.3,
              }}
            >
              {modelName}
            </div>
          </div>
        ))}
      </div> */}

      {/* UI 요소들 */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        <ParticleControls
          currentShape={MODEL_NAMES[currentModelIndex] || "Rocket"}
          currentColorScheme={colorScheme}
          onShapeChange={handleShapeChange}
          onColorSchemeChange={handleColorSchemeChange}
        />
      </div>
      <PostProcessingGUI onConfigChange={setPostProcessingConfig} />
      <ParticleGUI />
    </>
  );
}
