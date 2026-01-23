// src/types/window.d.ts
interface Window {
  postProcessing?: {
    bloom?: {
      intensity: number;
      threshold: number;
      smoothing: number;
    };
    toneMapping?: {
      exposure: number;
    };
    vignette?: {
      offset: number;
      darkness: number;
    };
    chromaticAberration?: {
      offset: [number, number];
    };
    depthOfField?: {
      focusDistance: number;
      focalLength: number;
      bokehScale: number;
    };
  };
  particleSystem?: {
    triggerMorph: () => void;
    setColorScheme: (scheme: string) => void;
    setUseTexture: (use: boolean) => void;
    setMorphProgress: (progress: number) => void;
    setTargetModelIndex: (index: number) => void;
    setInfluences: (influences: number[]) => void;
    setScale: (scale: number) => void;
    setScatter: (scatter: number) => void;
    setModelOffset: (
      offset: [number, number, number] | { x?: number; y?: number; z?: number }
    ) => void;
    setOpacity: (opacity: number) => void;
    setRotation: (
      rotation:
        | [number, number, number]
        | { x?: number; y?: number; z?: number }
    ) => void;
    animatable: {
      rotation: { x: number; y: number; z: number };
      position: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
      influences: number[];
    };
  };
  fs?: {
    readFile: (
      path: string,
      options?: { encoding?: string }
    ) => Promise<Uint8Array | string>;
  };
  storage?: {
    get: (key: string, shared?: boolean) => Promise<any>;
    set: (key: string, value: any, shared?: boolean) => Promise<any>;
    delete: (key: string, shared?: boolean) => Promise<any>;
    list: (prefix?: string, shared?: boolean) => Promise<any>;
  };
}
