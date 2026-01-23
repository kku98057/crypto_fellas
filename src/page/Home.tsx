import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import ParticleSystem from "../components/canvas/ParticleSystem";
import PostProcessing from "../components/canvas/PostProcessing";
import type { ColorScheme } from "../types/ColorType";
import { PARTICLE_SIZE_SCALE } from "../enum/ParticlesEnum";
import styles from "./home.module.scss";
import Button from "../components/Button";
import { SplitText } from "gsap/SplitText";

// GSAP ScrollTrigger 등록
gsap.registerPlugin(ScrollTrigger);
gsap.registerPlugin(SplitText);
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
  setMorphProgress: (progress: number) => void;
  setTargetModelIndex: (index: number) => void;
  setInfluences: (influences: number[]) => void;
  setScale: (scale: number) => void;
  setScatter: (scatter: number) => void;
  setModelOffset: (offset: [number, number, number]) => void;
  setRotation: (rotation: [number, number, number]) => void; // 모델 회전
  setOpacity: (opacity: number) => void; // 투명도\
}

const MODEL_NAMES = ["Gamepad", "Card"]; // 2개 섹션만 사용

export default function Home() {
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("fire");
  const [introComplete, setIntroComplete] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceType, setDeviceType] = useState<"pc" | "tablet" | "mobile">(
    "pc"
  );
  const bufferGeometry = new THREE.BufferGeometry();
  const systemRef = useRef<ParticleSystemRef | null>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  const leftListRef = useRef<HTMLUListElement>(null);
  const rightListRef = useRef<HTMLUListElement>(null);
  const leftListWidthRef = useRef<number>(0);
  const rightListWidthRef = useRef<number>(0);
  const leftListPositionRef = useRef<number>(0);
  const rightListPositionRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const leftIsHoveredRef = useRef<boolean>(false);
  const rightIsHoveredRef = useRef<boolean>(false);
  const heroTitleTextRef = useRef<HTMLHeadingElement>(null);
  const heroDescRef = useRef<HTMLParagraphElement>(null);
  const heroContentsTextRef = useRef<HTMLParagraphElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroContentsListRef = useRef<HTMLUListElement>(null);
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

  // 초기 로드 시 스크롤 위치를 0으로 설정
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 디바이스 타입 감지 (PC/Tablet/Mobile)
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      if (width >= 1440) {
        setDeviceType("pc");
        setIsMobile(false);
      } else if (width >= 1024) {
        setDeviceType("tablet");
        setIsMobile(false);
      } else {
        setDeviceType("mobile");
        setIsMobile(true);
      }
    };

    checkDeviceType();
    window.addEventListener("resize", checkDeviceType);
    return () => window.removeEventListener("resize", checkDeviceType);
  }, []);

  // ParticleSystem 연결
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

  // 파트너 리스트 애니메이션 제어 (JavaScript로)
  useEffect(() => {
    if (!leftListRef.current || !rightListRef.current) return;

    const leftList = leftListRef.current;
    const rightList = rightListRef.current;

    // 리스트 너비 계산 (2배 복제했으므로 절반)
    const updateWidths = () => {
      const leftWidth = leftList.scrollWidth / 2;
      const rightWidth = rightList.scrollWidth / 2;

      if (leftWidth > 0) leftListWidthRef.current = leftWidth;
      if (rightWidth > 0) rightListWidthRef.current = rightWidth;
    };

    // 초기 너비 계산
    updateWidths();

    // 초기 위치 설정 (DOM이 준비된 후)
    const initPositions = () => {
      // 첫 번째 리스트: 0에서 시작 (왼쪽에서 오른쪽으로 이동)
      leftListPositionRef.current = 0;
      leftList.style.transform = `translateX(0px)`;

      // 두 번째 리스트: -50%에서 시작 (오른쪽에서 왼쪽으로 이동)
      if (rightListWidthRef.current > 0) {
        rightListPositionRef.current = -rightListWidthRef.current;
        rightList.style.transform = `translateX(${rightListPositionRef.current}px)`;
      }
    };

    // 즉시 실행
    initPositions();

    // DOM이 완전히 로드된 후 다시 확인
    setTimeout(() => {
      updateWidths();
      initPositions();
    }, 100);

    let lastTime = performance.now();
    const baseSpeed = 1.5; // 기본 속도 (px/frame)

    const animate = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 16.67); // 최대 60fps
      lastTime = currentTime;

      // 각 리스트별 hover 상태 확인 (애니메이션 재시작 방지)
      const leftSpeedMultiplier = leftIsHoveredRef.current ? 0.5 : 1.0;
      const rightSpeedMultiplier = rightIsHoveredRef.current ? 0.5 : 1.0;

      const leftSpeed = baseSpeed * leftSpeedMultiplier * (deltaTime / 16.67); // 프레임 독립적
      const rightSpeed = baseSpeed * rightSpeedMultiplier * (deltaTime / 16.67); // 프레임 독립적

      // 첫 번째 리스트: 오른쪽으로 이동 (0 → -50%)
      if (leftListWidthRef.current > 0) {
        leftListPositionRef.current -= leftSpeed;
        if (leftListPositionRef.current <= -leftListWidthRef.current) {
          leftListPositionRef.current = 0; // 무한 루프
        }
        leftList.style.transform = `translateX(${leftListPositionRef.current}px)`;
      }

      // 두 번째 리스트: 왼쪽으로 이동 (-50% → 0)
      if (rightListWidthRef.current > 0) {
        rightListPositionRef.current += rightSpeed;
        if (rightListPositionRef.current >= 0) {
          rightListPositionRef.current = -rightListWidthRef.current; // 무한 루프
        }
        rightList.style.transform = `translateX(${rightListPositionRef.current}px)`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // 리사이즈 시 너비 재계산
    const handleResize = () => {
      updateWidths();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, []); // dependency 제거 - 한 번만 실행

  // Intro 자동 애니메이션 (스크롤 기반 아님)
  useEffect(() => {
    const startIntro = () => {
      if (!systemRef.current) {
        setTimeout(startIntro, 100);
        return;
      }

      console.log("Intro 애니메이션 시작");

      // Intro 애니메이션: 흩어진 상태에서 GamePad 모양으로 모이기
      const introTimeline = gsap.timeline({
        onComplete: () => {
          setIntroComplete(true);
          console.log("Intro 애니메이션 완료");

          // 스크롤 위치를 0으로 초기화
          window.scrollTo(0, 0);
        },
      });

      // 초기 상태 설정
      if (systemRef.current.setScatter) {
        systemRef.current.setScatter(1.0); // 완전히 흩어짐
      }
      if (systemRef.current.setScale) {
        systemRef.current.setScale(PARTICLE_SIZE_SCALE * 5); // Intro 시작: 크게 (기본 크기의 5배)
      }

      // 애니메이션 시퀀스
      introTimeline
        .to(
          {},
          {
            delay: 1,
            duration: 1.5,
            ease: "none",
            onUpdate: function () {
              const progress = this.progress();
              console.log(progress);
              // 산포: 1.0 → 0.0
              systemRef.current?.setScatter?.(3.0 - progress * 3);
              // 크기: (기본 크기 * 5) → 기본 크기
              const introStartSize = PARTICLE_SIZE_SCALE * 15;
              const introEndSize = PARTICLE_SIZE_SCALE;
              systemRef.current?.setScale?.(
                introStartSize - progress * (introStartSize - introEndSize)
              );
            },
            onComplete: () => {
              const body = document.body;
              setTimeout(() => {
                body.style.overflow = "auto";
              }, 500);
            },
          }
        )
        .to({}, { duration: 0.5 }); // 0.5초 대기
    };

    startIntro();
  }, []);

  // 카메라 ref
  const cameraRef = useRef<THREE.Camera | null>(null);

  // SplitText 애니메이션 (useGSAP 사용) - 화면 크기별 분리
  useGSAP(
    () => {
      if (
        !heroTitleTextRef.current ||
        !heroDescRef.current ||
        !heroContentsTextRef.current ||
        isLoading
      )
        return;

      const titleSplit = SplitText.create(heroTitleTextRef.current, {
        type: "chars",
        autoSplit: true,
      });

      const descSplit = SplitText.create(heroDescRef.current, {
        type: "chars",
        autoSplit: true,
      });
      const mm = gsap.matchMedia();
      // 1. PC (1440px 이상)
      mm.add("(min-width: 1440px)", () => {
        pcAnimation();
      });

      // 2. Tablet (1024px ~ 1439px)
      mm.add("(min-width: 769px) and (max-width: 1439px)", () => {
        pcAnimation();
      });
      mm.add("(max-width: 768px)", () => {
        mobileAnimation();
      });

      // 두 요소를 동시에 애니메이션
      const introAnimationConfig = {
        y: 100,
        opacity: 0,
        stagger: 0.025,
        duration: 0.8,
        ease: "power4.inOut",
      };

      if (titleSplit.chars && titleSplit.chars.length > 0) {
        gsap.from(titleSplit.chars, introAnimationConfig);
      }

      if (descSplit.chars && descSplit.chars.length > 0) {
        gsap.from(descSplit.chars, introAnimationConfig);
      }

      return () => mm.revert();
    },
    { dependencies: [isLoading] }
  );

  // GSAP ScrollTrigger 설정 (Intro 완료 후에만 작동)
  useEffect(() => {
    if (!introComplete || !systemRef.current) return;

    const sections = sectionsRef.current;

    // PC/Mobile에 따른 애니메이션 설정
    const animConfig = isMobile
      ? {
          // Mobile 설정
          cameraZoomStart: 12, // Canvas 초기 카메라 위치와 일치
          cameraZoomEnd: 10,
          offsetX: 0.8,
          offsetY: 0.5,
          scrubSpeed: 1, // Pin에서는 1로 통일
        }
      : {
          // PC 설정
          cameraZoomStart: 12, // Canvas 초기 카메라 위치와 일치
          cameraZoomEnd: 8,
          offsetX: 1.5,
          offsetY: 0.8,
          scrubSpeed: 1,
        };

    console.log(
      `정밀 스크롤 애니메이션 설정 (${isMobile ? "Mobile" : "PC"} 모드)`
    );

    const triggers: ScrollTrigger[] = [];

    // 섹션 0: GamePad 유지 (Intro 후 시작점) - Pin
    if (sections[0]) {
      const trigger0 = ScrollTrigger.create({
        trigger: sections[0],
        start: "top top",
        end: "+=100%",
        pin: true,
        scrub: animConfig.scrubSpeed,
        id: "section-0-gamepad",
        anticipatePin: 1,
        onUpdate: (self) => {
          if (systemRef.current) {
            // 정밀한 스크롤 진행도
            const scrollProgress = self.progress;

            // GamePad 상태 유지
            systemRef.current.setInfluences?.([0, 0]);
            systemRef.current.setScatter?.(0);
            systemRef.current.setScale?.(PARTICLE_SIZE_SCALE);
            systemRef.current.setModelOffset?.([0, 0, 0]);

            if (cameraRef.current) {
              cameraRef.current.position.z = animConfig.cameraZoomStart;
            }

            setCurrentModelIndex(0);

            // 디버깅용
            if (scrollProgress === 0 || scrollProgress === 1) {
              console.log(
                `섹션 0 진행도: ${(scrollProgress * 100).toFixed(1)}%`
              );
            }
          }
        },
        onEnter: () => console.log("📍 섹션 0 진입: GamePad"),
        onLeave: () => console.log("📍 섹션 0 이탈"),
        onEnterBack: () => console.log("📍 섹션 0 재진입"),
      });
      triggers.push(trigger0);
    }

    // 섹션 1: GamePad → Card - 연속 애니메이션 (점프 없이)
    if (sections[1]) {
      const trigger1 = ScrollTrigger.create({
        trigger: sections[1],
        start: "top top",
        end: "+=500%",
        pin: true,
        scrub: animConfig.scrubSpeed,
        id: "section-1-smooth",
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress; // 0 ~ 1

          if (systemRef.current && cameraRef.current) {
            // === 부드러운 연속 애니메이션 (점프 없이) ===

            // Morphing: 0 → 1.0 (연속적)
            systemRef.current.setInfluences?.([progress, 0]);

            // Camera Zoom: 30% 이후부터 시작
            let cameraZ = animConfig.cameraZoomStart;
            if (progress > 0.3) {
              const cameraProgress = (progress - 0.3) / 0.7; // 30~100%
              const easedCameraProgress =
                gsap.parseEase("power2.inOut")(cameraProgress);
              cameraZ =
                animConfig.cameraZoomStart -
                easedCameraProgress *
                  (animConfig.cameraZoomStart - animConfig.cameraZoomEnd);
            }
            cameraRef.current.position.z = cameraZ;

            // Model Move: 50% 이후부터 시작
            let offsetX = 0;
            let offsetY = 0;
            if (progress > 0.5) {
              const moveProgress = (progress - 0.5) / 0.5; // 50~100%
              const easedMoveProgress =
                gsap.parseEase("power2.out")(moveProgress);
              offsetX = easedMoveProgress * animConfig.offsetX;
              offsetY = easedMoveProgress * animConfig.offsetY;
            }
            systemRef.current.setModelOffset?.([offsetX, offsetY, 0]);

            // 공통 설정
            systemRef.current.setScatter?.(0);
            systemRef.current.setScale?.(PARTICLE_SIZE_SCALE);
            setCurrentModelIndex(1);
          }
        },
        onEnter: () => console.log("📍 섹션 1 진입"),
        onLeave: () => console.log("📍 섹션 1 완료"),
      });
      triggers.push(trigger1);
    }

    // ScrollTrigger 리프레시 (반응형 대응)
    ScrollTrigger.refresh();

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  function pcAnimation() {
    // 화면 크기별 애니메이션 설정
    const introAnimationConfig = {
      y: 100,
      opacity: 0,
      stagger: 0.025,
      duration: 0.8,
      ease: "power4.inOut",
    };
    const contentsSplit = SplitText.create(heroContentsTextRef.current, {
      type: "chars",
      autoSplit: true,
    });
    if (contentsSplit.chars && contentsSplit.chars.length > 0) {
      gsap.from(contentsSplit.chars, {
        ...introAnimationConfig,
        stagger: 0,
        delay: 0.5,
      });
    }
    const heroAnimation = gsap
      .timeline({
        scrollTrigger: {
          trigger: sectionsRef.current[0],
          scrub: 1,
          markers: true,
        },
      })
      .to(
        {},
        {
          duration: 0.5,
          onUpdate: function () {
            const progress = this.progress();
            if (systemRef.current) {
              // x축으로 2만큼 이동 (0 → 2)
              // const offsetX = progress * 2;
              // systemRef.current.setModelOffset?.([offsetX, 0, 0]);

              // systemRef.current.setInfluences?.([progress, 0, 0, 0, 0]);

              // x축으로 30도 회전 (0도 → 30도)
              const rotationX = progress * 30 * (Math.PI / 180); // 라디안 변환
              systemRef.current.setRotation?.([rotationX, 0, 0]);
            }
          },
        },
        0.5
      );
    const aboutAnimation = gsap
      .timeline({
        scrollTrigger: {
          trigger: sectionsRef.current[1],
          end: "+=400%",
          pin: true,
          scrub: 1,
        },
      })
      .from(
        sectionsRef.current[1].querySelector(`.${styles.title}`),
        {
          opacity: 0,
        },
        0
      )
      .to(
        sectionsRef.current[1].querySelector(`.${styles.title}`),
        {
          opacity: 0,
        },
        0.5
      )

      .from(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:first-child`
        ),
        {
          opacity: 0,
        },
        1
      )
      .to(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:first-child`
        ),
        {
          opacity: 0,
        },
        1.5
      )
      .from(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(2)`
        ),
        {
          opacity: 0,
        },
        2
      )
      .to(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(2)`
        ),
        {
          opacity: 0,
        },
        2.5
      )
      .from(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(3)`
        ),
        {
          opacity: 0,
        },
        3
      )
      .to(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(3)`
        ),
        {
          opacity: 0,
        },
        3.5
      )
      .from(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(4)`
        ),
        {
          opacity: 0,
        },
        4
      )
      .to(
        sectionsRef.current[1].querySelector(
          `.${styles.contents_text} span:nth-child(4)`
        ),
        {
          opacity: 0,
        },
        4.5
      )

      .from(
        sectionsRef.current[1].querySelector(`.${styles.contents_list}`),
        {
          opacity: 0,
        },
        5
      )
      .to(
        sectionsRef.current[1].querySelector(`.${styles.contents_list}`),
        {
          opacity: 0,
        },
        5.5
      );

    const partnersAnimation = gsap
      .timeline({
        scrollTrigger: {
          trigger: `.${styles.partners} .${styles.title}`,
          toggleActions: "play reverse play reverse",
          start: "top 70%",
          end: "bottom top",
        },
      })
      .from(sectionsRef.current[2], {
        opacity: 0,
      });

    const keypointItems = sectionsRef.current[3].querySelectorAll(
      `.${styles.keypoint_item}`
    );
  }
  // function tabletAnimation() {
  //   // 화면 크기별 애니메이션 설정
  //   const introAnimationConfig = {
  //     y: 100,
  //     opacity: 0,
  //     stagger: 0.025,
  //     duration: 0.8,
  //     ease: "power4.inOut",
  //   };
  //   const contentsSplit = SplitText.create(heroContentsTextRef.current, {
  //     type: "chars",
  //     autoSplit: true,
  //   });
  //   if (contentsSplit.chars && contentsSplit.chars.length > 0) {
  //     gsap.from(contentsSplit.chars, {
  //       ...introAnimationConfig,
  //       stagger: 0,
  //       delay: 0.5,
  //     });
  //   }
  // }
  function mobileAnimation() {
    // 이전 Mobile ScrollTrigger 제거
    const existingTrigger = ScrollTrigger.getById("section-0-hero-mobile");
    if (existingTrigger) {
      existingTrigger.kill();
    }
    if (sectionsRef.current[0]) {
      gsap.set(sectionsRef.current[0], { clearProps: "all" });
    }

    if (
      sectionsRef.current[0] &&
      heroTitleTextRef.current &&
      heroTitleRef.current &&
      heroContentsListRef.current
    ) {
      const timeline = gsap
        .timeline({
          scrollTrigger: {
            trigger: sectionsRef.current[0],
            start: "top top",
            end: "+=300%",
            pin: true,
            scrub: 1,
            id: "section-0-hero-mobile",
          },
        })
        .from(heroTitleRef.current, {
          yPercent: 100,
        })
        .from(
          heroContentsTextRef.current,
          {
            opacity: 0,
          },
          0.25
        )
        .from(
          heroContentsListRef.current.querySelectorAll("li"),
          {
            opacity: 0,
            stagger: 0.25,
          },
          0.25
        );
    }

    return null;
  }

  return (
    <>
      {/* CSS 애니메이션 정의 */}
      <style>
        {`
          @keyframes fadeInOut {
            0% { opacity: 0; }
            20% { opacity: 0.3; }
            80% { opacity: 0.3; }
            100% { opacity: 0; }
          }
          
          @keyframes fadeOut {
            0% { opacity: 0.5; }
            100% { opacity: 0; }
          }
        `}
      </style>
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
          camera={{ position: [0, 0, 12], fov: 75 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ background: "#000000" }}
          onCreated={({ camera }) => {
            cameraRef.current = camera;
            // 로딩 완료 처리 (약간의 지연을 두어 렌더링 완료 보장)
            setTimeout(() => {
              setIsLoading(false);
            }, 1500);
          }}
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
              autoRotate={false} // 스크롤 애니메이션 중에는 auto rotate 끔
              autoRotateSpeed={0.5}
              enablePan={false}
              enableZoom={false}
            />
            <PostProcessing {...postProcessingConfig} />
          </Suspense>
        </Canvas>
        {/* 커스텀 로딩 UI */}
      </div>
      {/* Intro 화면 (자동 애니메이션) */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.loading_content}>
            <div className={styles.loading_spinner}></div>
          </div>
        </div>
      )}
      <>
        <section
          className={styles.hero}
          ref={(el) => {
            if (el) sectionsRef.current[0] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.title} ref={heroTitleRef}>
              <h1 className={styles.title_text} ref={heroTitleTextRef}>
                Recreated by
                <br className={styles.br_pc} /> Your Choice
              </h1>
              <p className={styles.desc} ref={heroDescRef}>
                A New Paradigm of Value Circulation.
              </p>
            </div>
            <div className={styles.contents}>
              <p className={styles.contents_text} ref={heroContentsTextRef}>
                Beyond bubbles and speculation, MGG converts
                <br />
                authentic user contribution into 'immutable scarcity,'
                <br />
                forging a sustainable future for the Web3 economy.
              </p>
              <ul className={styles.contents_list} ref={heroContentsListRef}>
                <li>
                  <strong>22,462</strong>
                  <span>HOLDERS</span>
                </li>
                <li>
                  <strong>1,432,714</strong>
                  <span>TRANSACTIONS</span>
                </li>
                <li>
                  <strong>200,000,000</strong>
                  <span>TOKENS BURNED</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section
          className={styles.about}
          ref={(el) => {
            if (el) sectionsRef.current[1] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.title}>
              <h2 className={styles.title_text}>
                <span>MGG</span> Token Introduction
              </h2>
              <p className={styles.desc}>
                {" "}
                The Driving Force for Real-World Value Completion
              </p>
            </div>
            <div className={styles.contents}>
              <div className={styles.contents_text}>
                <p>
                  <span>
                    The MGG Token was born from Crypto Palace with the mission
                    to overcome speculative bubbles and build a sustainable Web3
                    economy.
                  </span>
                  <span>
                    As the consideration for core ecosystem activities like Node
                    growth and Arena participation, MGG is subjected to Burn,
                    permanently preserving its value.
                  </span>

                  <span>
                    We have leveraged the Palace Card to grant MGG value a new
                    dimension of utility in the real world. The vision of MGG is
                    now to continuously expand and evolve this innovative
                    connection into an integrated digital economic zone.
                  </span>
                  <span>
                    Ultimately, we will pioneer a new era of Web3 where every
                    user activity completes the value of real-life existence.
                  </span>
                </p>
              </div>
              <ul className={styles.contents_list}>
                <li>
                  <div className={styles.contents_list_item}>
                    <img src="/image/about/about_card1.webp" alt="" />
                  </div>
                  <div className={styles.contents_list_item_text}>
                    <strong>MIMBO NODE</strong>
                    <span>
                      Your Immutable
                      <br /> Wealth Pipeline
                    </span>
                  </div>
                </li>
                <li>
                  <div className={styles.contents_list_item}>
                    <img src="/image/about/about_card2.webp" alt="" />
                  </div>
                  <div className={styles.contents_list_item_text}>
                    <strong>MGG Arena</strong>
                    <span>
                      The Ultimate Stage
                      <br /> for Reward and Glory
                    </span>
                  </div>
                </li>
                <li>
                  <div className={styles.contents_list_item}>
                    <img src="/image/about/about_card3.webp" alt="" />
                  </div>
                  <div className={styles.contents_list_item_text}>
                    <strong>FELLAS Card</strong>
                    <span>
                      'Life': Extending Digital
                      <br /> Value to Real Life
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section
          className={styles.partners}
          ref={(el) => {
            if (el) sectionsRef.current[2] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.title}>
              <h3 className={styles.title_text}>OUR PARTNERS</h3>
              <p className={styles.desc}>
                MGG partners with the best verified global partners for
                <br />
                technology, strategy, and real-life expansion.
              </p>
            </div>
            <div className={styles.contents}>
              <div className={styles.partners_wrapper}>
                <ul
                  ref={leftListRef}
                  className={`${styles.contents_list} ${styles.slide_left}`}
                  onMouseEnter={() => {
                    leftIsHoveredRef.current = true;
                  }}
                  onMouseLeave={() => {
                    leftIsHoveredRef.current = false;
                  }}
                >
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  {/* 중복 추가로 무한 스크롤 효과 */}
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                </ul>
              </div>
              <div className={styles.partners_wrapper}>
                <ul
                  ref={rightListRef}
                  className={`${styles.contents_list} ${styles.slide_right}`}
                  onMouseEnter={() => {
                    rightIsHoveredRef.current = true;
                  }}
                  onMouseLeave={() => {
                    rightIsHoveredRef.current = false;
                  }}
                >
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  {/* 중복 추가로 무한 스크롤 효과 */}
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                  <li>
                    <img src="/image/partners/partner.png" alt="" />
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <section
          className={styles.keypoint}
          ref={(el) => {
            if (el) sectionsRef.current[3] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.contents}>
              <div className={styles.keypoint_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span>KEY POINT 1</span>
                  <h3>
                    Foundational <br />
                    Liquidity Base
                  </h3>
                  <p>
                    The Mimbo Node is the backbone of the ecosystem, responsible
                    for the production of $MGG and providing a stable liquidity
                    pool. It serves as a channel for external capital influx,
                    securing market liquidity and economic stability from its
                    root.
                  </p>
                </div>
              </div>
              <div className={styles.keypoint_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span>KEY POINT 2</span>
                  <h3>
                    Core Activity Burn
                    <br /> Structure
                  </h3>
                  <p>
                    Every activity within the ecosystem—from Node mining to
                    active $MGG usage in the Arena by users— triggers the
                    burning of MGG Tokens. This structure inherently ensures the
                    natural rise in MGG's value.
                  </p>
                </div>
              </div>
              <div className={styles.keypoint_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span>KEY POINT 3</span>
                  <h3>
                    Real-World
                    <br />
                    Connection Medium
                  </h3>
                  <p>
                    The Palace Card is the critical medium that links MGG value
                    to the real world. It maximizes the utility of digital
                    value, expanding the scope of the MGG ecosystem's worth.
                  </p>
                </div>
              </div>
              <div className={styles.keypoint_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span>KEY POINT 4</span>
                  <h3>Sustainable Pool</h3>
                  <p>
                    The structure is designed to naturally regulate the supply
                    of rewards based on changes in MGG value and user
                    participation. Through long-term reward planning, we
                    overcome the limitations of existing P2E models and offer a
                    predictable future guided by the market's pulse.
                  </p>
                </div>
              </div>
              <div className={styles.keypoint_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span>KEY POINT 5</span>
                  <h3>Community Governance</h3>
                  <p>
                    Upon the stable growth of the MGG ecosystem, the goal is to
                    delegate ecosystem leadership to the community. Through a
                    transparent system, we will transfer the genuine ownership
                    and operational authority of MGG to Node holders, minimizing
                    centralization risks and deciding the future together.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className={styles.vision}
          ref={(el) => {
            if (el) sectionsRef.current[4] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.title}>
              <h3 className={styles.title_text}>MGG Vision</h3>
              <p className={styles.desc}>Our Promise to Recreate Destiny</p>
            </div>
            <div className={styles.contents}>
              <div className={styles.vision_item}>
                <div className={styles.models}></div>
                <div className={styles.contents_data}>
                  <span> We Promise</span>
                  <h3>
                    a New Economic
                    <br /> Order for Web3
                  </h3>
                  <p>
                    We put an end to the past of the Web3 economy, which was
                    plagued by speculative bubbles and disorder. MGG creates a
                    new economic order where ‘immutable scarcity’ and
                    ‘sustainable growth’ coexist, based solely on the pure
                    contribution and strategy of our users. MGG is not a
                    temporary project; it is an organic entity that continually
                    generates and proves its own value, evolving perpetually.
                    Stop leaving your future to chance. Your wise choices and
                    actions are the future of MGG and the new history of Web3.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className={styles.end}
          ref={(el) => {
            if (el) sectionsRef.current[5] = el as HTMLDivElement;
          }}
        >
          <div className={styles.container}>
            <div className={styles.title}>
              <h5 className={styles.title_text}>
                Join <span>MGG</span>'s revolutionary journey now and recreate
                your destiny.
              </h5>
            </div>
            <div className={styles.contents}>
              <Button size="large">
                <span>MIMBO NODE</span>
              </Button>
              <Button size="large">
                <span>MGG Arean</span>
              </Button>
              <Button size="large">
                <span>Fellas card</span>
              </Button>
            </div>
          </div>
        </section>
      </>
    </>
  );
}
