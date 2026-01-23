import { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
  ChromaticAberration,
  DepthOfField,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

interface PostProcessingProps {
  bloom?: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    smoothing: number;
  };
  toneMapping?: {
    enabled: boolean;
    exposure: number;
  };
  vignette?: {
    enabled: boolean;
    offset: number;
    darkness: number;
  };
  chromaticAberration?: {
    enabled: boolean;
    offset: [number, number];
  };
  depthOfField?: {
    enabled: boolean;
    focusDistance: number;
    focalLength: number;
    bokehScale: number;
  };
}

export default function PostProcessing(props: PostProcessingProps) {
  const { gl, scene, camera } = useThree();
  const bloomIntensityRef = useRef(props.bloom?.intensity ?? 1.5);
  const bloomThresholdRef = useRef(props.bloom?.threshold ?? 0.3);

  // 설정값
  const bloomConfig = {
    enabled: props.bloom?.enabled ?? true,
    intensity: props.bloom?.intensity ?? 1.5,
    threshold: props.bloom?.threshold ?? 0.3,
    smoothing: props.bloom?.smoothing ?? 0.025,
  };

  const toneMappingConfig = {
    enabled: props.toneMapping?.enabled ?? true,
    exposure: props.toneMapping?.exposure ?? 1.0,
  };

  const vignetteConfig = {
    enabled: props.vignette?.enabled ?? false,
    offset: props.vignette?.offset ?? 0.5,
    darkness: props.vignette?.darkness ?? 0.5,
  };

  const chromaticAberrationConfig = {
    enabled: props.chromaticAberration?.enabled ?? false,
    offset:
      props.chromaticAberration?.offset ??
      ([0.0005, 0.0005] as [number, number]),
  };

  const depthOfFieldConfig = {
    enabled: props.depthOfField?.enabled ?? false,
    focusDistance: props.depthOfField?.focusDistance ?? 0.02,
    focalLength: props.depthOfField?.focalLength ?? 0.02,
    bokehScale: props.depthOfField?.bokehScale ?? 2.0,
  };

  // window에 간단한 API 노출
  useEffect(() => {
    const win = window as any;

    if (!win.postProcessing) {
      win.postProcessing = {};
    }

    // Bloom 제어를 위한 ref 기반 API
    win.postProcessing.bloom = {
      get intensity() {
        return bloomIntensityRef.current;
      },
      set intensity(value: number) {
        bloomIntensityRef.current = value;
        // 실제 업데이트는 useFrame이나 다른 방식으로 처리
      },
      get threshold() {
        return bloomThresholdRef.current;
      },
      set threshold(value: number) {
        bloomThresholdRef.current = value;
      },
    };

    console.log("✅ PostProcessing API 준비 완료");

    return () => {
      if (win.postProcessing) {
        delete win.postProcessing.bloom;
      }
    };
  }, []);

  // Canvas 컨텍스트가 없으면 렌더링하지 않음
  if (!gl || !scene || !camera) {
    return null;
  }

  return (
    <EffectComposer>
      <>
        {bloomConfig.enabled && (
          <Bloom
            intensity={bloomIntensityRef.current}
            luminanceThreshold={bloomThresholdRef.current}
            luminanceSmoothing={bloomConfig.smoothing}
          />
        )}
        {toneMappingConfig.enabled && <ToneMapping />}
        {vignetteConfig.enabled && (
          <Vignette
            offset={vignetteConfig.offset}
            darkness={vignetteConfig.darkness}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
        {chromaticAberrationConfig.enabled && (
          <ChromaticAberration
            offset={chromaticAberrationConfig.offset}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
        {depthOfFieldConfig.enabled && (
          <DepthOfField
            focusDistance={depthOfFieldConfig.focusDistance}
            focalLength={depthOfFieldConfig.focalLength}
            bokehScale={depthOfFieldConfig.bokehScale}
          />
        )}
      </>
    </EffectComposer>
  );
}
