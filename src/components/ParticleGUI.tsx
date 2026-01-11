import { useControls } from "leva";
import { useEffect } from "react";

export default function ParticleGUI() {
  const config = useControls(
    "Particle Settings", // 파티클 설정
    {
      // 텍스처 사용 여부
      "Use Texture": {
        value: true, // 기본값: true (텍스처 사용)
        label: "텍스처 사용", // 한글 라벨
      },
    },
    { collapsed: false } // GUI 패널을 기본적으로 펼쳐진 상태로 유지
  );

  // GUI 설정이 변경될 때마다 파티클 시스템에 전달
  useEffect(() => {
    const win = window as Window & {
      particleSystem?: {
        setUseTexture: (use: boolean) => void;
      };
    };

    if (win.particleSystem && win.particleSystem.setUseTexture) {
      const useTexture = config["Use Texture"] as boolean;
      win.particleSystem.setUseTexture(useTexture);
    }
  }, [config]);

  return null; // GUI는 leva가 자동으로 렌더링
}

