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
  // 하위 호환성을 위한 개별 Props
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomSmoothing?: number;
  toneMappingExposure?: number;
  vignetteOffset?: number;
  vignetteDarkness?: number;
  chromaticAberrationOffset?: [number, number];
  depthOfFieldFocusDistance?: number;
  depthOfFieldFocalLength?: number;
  depthOfFieldBokehScale?: number;
  enabled?: {
    bloom?: boolean;
    toneMapping?: boolean;
    vignette?: boolean;
    chromaticAberration?: boolean;
    depthOfField?: boolean;
  };
}

export default function PostProcessing(props: PostProcessingProps) {
  // 개별 Props 방식 또는 객체 방식 모두 지원
  const bloomConfig = {
    enabled: props.enabled?.bloom ?? props.bloom?.enabled ?? true,
    intensity: props.bloomIntensity ?? props.bloom?.intensity ?? 1.5,
    threshold: props.bloomThreshold ?? props.bloom?.threshold ?? 0.5,
    smoothing: props.bloomSmoothing ?? props.bloom?.smoothing ?? 0.025,
  };

  const toneMappingConfig = {
    enabled: props.enabled?.toneMapping ?? props.toneMapping?.enabled ?? true,
    exposure: props.toneMappingExposure ?? props.toneMapping?.exposure ?? 1.0,
  };

  const vignetteConfig = {
    enabled: props.enabled?.vignette ?? props.vignette?.enabled ?? false,
    offset: props.vignetteOffset ?? props.vignette?.offset ?? 0.5,
    darkness: props.vignetteDarkness ?? props.vignette?.darkness ?? 0.5,
  };

  const chromaticAberrationConfig = {
    enabled:
      props.enabled?.chromaticAberration ??
      props.chromaticAberration?.enabled ??
      false,
    offset: props.chromaticAberrationOffset ??
      props.chromaticAberration?.offset ?? [0.0005, 0.0005],
  };

  const depthOfFieldConfig = {
    enabled:
      props.enabled?.depthOfField ?? props.depthOfField?.enabled ?? false,
    focusDistance:
      props.depthOfFieldFocusDistance ??
      props.depthOfField?.focusDistance ??
      0.02,
    focalLength:
      props.depthOfFieldFocalLength ?? props.depthOfField?.focalLength ?? 0.02,
    bokehScale:
      props.depthOfFieldBokehScale ?? props.depthOfField?.bokehScale ?? 2.0,
  };

  return (
    <EffectComposer key={`bloom-${bloomConfig.enabled}`}>
      <>
        {bloomConfig.enabled && (
          <Bloom
            key="bloom-effect"
            intensity={bloomConfig.intensity}
            threshold={bloomConfig.threshold}
            smoothing={bloomConfig.smoothing}
            blendFunction={BlendFunction.ADD}
          />
        )}
        {toneMappingConfig.enabled && (
          <ToneMapping
            key="tonemapping-effect"
            exposure={toneMappingConfig.exposure}
            resolution={256}
          />
        )}
        {vignetteConfig.enabled && (
          <Vignette
            key="vignette-effect"
            offset={vignetteConfig.offset}
            darkness={vignetteConfig.darkness}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
        {chromaticAberrationConfig.enabled && (
          <ChromaticAberration
            key="chromatic-effect"
            offset={chromaticAberrationConfig.offset as [number, number]}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
        {depthOfFieldConfig.enabled && (
          <DepthOfField
            key="dof-effect"
            focusDistance={depthOfFieldConfig.focusDistance}
            focalLength={depthOfFieldConfig.focalLength}
            bokehScale={depthOfFieldConfig.bokehScale}
          />
        )}
      </>
    </EffectComposer>
  );
}
