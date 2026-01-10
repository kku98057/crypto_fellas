import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import ParticleSystem from "../components/canvas/ParticleSystem";
import ParticleControls from "../components/ParticleControls";

type ColorScheme = "fire" | "neon" | "nature" | "rainbow";

interface ParticleSystemRef {
  triggerMorph: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const MODEL_NAMES = ["Rocket", "Man", "Saturn", "Telephone"];

export default function Home() {
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("fire");
  const systemRef = useRef<ParticleSystemRef | null>(null);

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
    <section>
      <Canvas
        camera={{ position: [0, 0, 30], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          <ParticleSystem
            onShapeChange={(shapeName) => {
              const index = MODEL_NAMES.findIndex((name) => name === shapeName);
              if (index !== -1) setCurrentModelIndex(index);
            }}
            onColorSchemeChange={setColorScheme}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            autoRotate
            autoRotateSpeed={0.5}
            enablePan={false}
            enableZoom={true}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
        </Suspense>
      </Canvas>
      <ParticleControls
        currentShape={MODEL_NAMES[currentModelIndex] || "Rocket"}
        currentColorScheme={colorScheme}
        onShapeChange={handleShapeChange}
        onColorSchemeChange={handleColorSchemeChange}
      />
    </section>
  );
}
