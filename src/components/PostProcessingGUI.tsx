import { useControls } from "leva";
import { useEffect } from "react";

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

interface PostProcessingGUIProps {
  onConfigChange: (config: PostProcessingConfig) => void;
}

export default function PostProcessingGUI({
  onConfigChange,
}: PostProcessingGUIProps) {
  const config = useControls(
    "Post Processing", // 포스트 프로세싱 설정
    {
      // Bloom 효과 - 밝은 부분이 빛나는 효과 (빛번짐, 글로우)
      "Bloom Enabled": {
        value: true, // Bloom 효과 활성화 (기본값: true)
      },
      "Bloom Intensity": {
        value: 1.5,
        min: 0,
        max: 5,
        step: 0.1, // 강도: 빛나는 효과의 세기 (높을수록 더 밝게 빛남)
      },
      "Bloom Threshold": {
        value: 0.3, // 임계값 낮춤 (더 많은 부분이 빛남)
        min: 0,
        max: 1,
        step: 0.01, // 임계값: 이 값보다 밝은 부분만 빛남 (0~1, 높을수록 더 밝은 부분만, 낮을수록 더 많은 부분이 빛남)
      },
      "Bloom Smoothing": {
        value: 0.025,
        min: 0,
        max: 1,
        step: 0.001, // 스무딩: 빛 번짐의 부드러움 정도 (높을수록 더 부드럽게 번짐)
      },

      // Tone Mapping - 톤 매핑 (밝기 조절, HDR 효과)
      "ToneMapping Enabled": {
        value: true, // 톤 매핑 효과 활성화 여부
      },
      "ToneMapping Exposure": {
        value: 1.0,
        min: 0,
        max: 3,
        step: 0.1, // 노출: 전체적인 밝기 조절 (0=어둡게, 3=밝게)
      },

      // Vignette 효과 - 비네팅 (모서리가 어두워지는 효과)
      "Vignette Enabled": {
        value: false, // 비네팅 효과 활성화 여부
      },
      "Vignette Offset": {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01, // 오프셋: 어두워지는 영역의 크기 (0=중앙만, 1=전체)
      },
      "Vignette Darkness": {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01, // 어두움: 모서리의 어두움 정도 (0=밝음, 1=매우 어두움)
      },

      // Chromatic Aberration - 색수차 효과 (무지개 테두리 효과)
      "ChromaticAberration Enabled": {
        value: false, // 색수차 효과 활성화 여부
      },
      "ChromaticAberration OffsetX": {
        value: 0.0005,
        min: 0,
        max: 0.01,
        step: 0.0001, // X축 오프셋: 수평 방향 색수차 강도
      },
      "ChromaticAberration OffsetY": {
        value: 0.0005,
        min: 0,
        max: 0.01,
        step: 0.0001, // Y축 오프셋: 수직 방향 색수차 강도
      },

      // Depth of Field - 심도 효과 (블러, 초점 효과)
      "DepthOfField Enabled": {
        value: false, // 심도 효과 활성화 여부
      },
      "DepthOfField FocusDistance": {
        value: 0.02,
        min: 0,
        max: 0.1,
        step: 0.001, // 초점 거리: 선명하게 보이는 거리 (0에 가까울수록 가까운 것에 초점)
      },
      "DepthOfField FocalLength": {
        value: 0.02,
        min: 0,
        max: 0.1,
        step: 0.001, // 초점 길이: 초점이 맞는 범위의 크기
      },
      "DepthOfField BokehScale": {
        value: 2.0,
        min: 0,
        max: 10,
        step: 0.1, // 보케 스케일: 흐려지는 부분의 블러 강도 (높을수록 더 흐림)
      },
    },
    { collapsed: false } // GUI 패널을 기본적으로 펼쳐진 상태로 유지
  );

  // GUI 설정이 변경될 때마다 콜백 호출하여 PostProcessing 컴포넌트에 전달
  useEffect(() => {
    const configRecord = config as Record<string, boolean | number>;
    const processedConfig: PostProcessingConfig = {
      // Bloom 효과 설정
      bloom: {
        enabled: configRecord["Bloom Enabled"] as boolean, // 활성화 여부
        intensity: configRecord["Bloom Intensity"] as number, // 강도
        threshold: configRecord["Bloom Threshold"] as number, // 임계값
        smoothing: configRecord["Bloom Smoothing"] as number, // 스무딩
      },
      // 톤 매핑 설정
      toneMapping: {
        enabled: configRecord["ToneMapping Enabled"] as boolean, // 활성화 여부
        exposure: configRecord["ToneMapping Exposure"] as number, // 노출
      },
      // 비네팅 효과 설정
      vignette: {
        enabled: configRecord["Vignette Enabled"] as boolean, // 활성화 여부
        offset: configRecord["Vignette Offset"] as number, // 오프셋 (영역 크기)
        darkness: configRecord["Vignette Darkness"] as number, // 어두움 정도
      },
      // 색수차 효과 설정
      chromaticAberration: {
        enabled: configRecord["ChromaticAberration Enabled"] as boolean, // 활성화 여부
        offset: [
          configRecord["ChromaticAberration OffsetX"] as number, // X축 오프셋
          configRecord["ChromaticAberration OffsetY"] as number, // Y축 오프셋
        ],
      },
      // 심도 효과 설정
      depthOfField: {
        enabled: configRecord["DepthOfField Enabled"] as boolean, // 활성화 여부
        focusDistance: configRecord["DepthOfField FocusDistance"] as number, // 초점 거리
        focalLength: configRecord["DepthOfField FocalLength"] as number, // 초점 길이
        bokehScale: configRecord["DepthOfField BokehScale"] as number, // 보케 스케일 (블러 강도)
      },
    };

    // 설정 변경을 부모 컴포넌트에 전달
    onConfigChange(processedConfig);
  }, [config, onConfigChange]);

  return null; // GUI는 leva가 자동으로 렌더링
}
