import type { ColorScheme } from "../types/ColorType";
import { COLOR_SCHEMES } from "./canvas/ParticleSystem";
import styles from "./ParticleControls.module.scss";

interface ParticleControlsProps {
  currentShape: string;
  currentColorScheme: ColorScheme;
  onShapeChange: () => void;
  onColorSchemeChange: (scheme: ColorScheme) => void;
}

/**
 * 파티클 시스템 컨트롤 UI 컴포넌트
 */
export default function ParticleControls({
  currentShape,
  currentColorScheme,
  onShapeChange,
  onColorSchemeChange,
}: ParticleControlsProps) {
  // const colorSchemes: { scheme: ColorScheme; gradient: string }[] = [
  //   {
  //     scheme: "fire",
  //     gradient: "linear-gradient(to bottom right, #ff4500, #ffcc00)",
  //   },
  //   {
  //     scheme: "neon",
  //     gradient: "linear-gradient(to bottom right, #ff00ff, #00ffff)",
  //   },
  //   {
  //     scheme: "nature",
  //     gradient: "linear-gradient(to bottom right, #00ff00, #66ffcc)",
  //   },
  //   {
  //     scheme: "rainbow",
  //     gradient:
  //       "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)",
  //   },
  // ];

  return (
    <div id="particle-controls" className={styles.controls}>
      <div className={styles.info}>Shape: {currentShape} (Click to morph)</div>
      <button onClick={onShapeChange} className={styles.shapeButton}>
        Change Shape
      </button>
      <div className={styles.colorPicker}>
        {Object.keys(COLOR_SCHEMES).map((scheme) => (
          <div
            key={scheme}
            className={`${styles.colorOption} ${
              currentColorScheme === scheme ? styles.active : ""
            }`}
            style={{
              background:
                COLOR_SCHEMES[scheme as ColorScheme].colors[0].getStyle(),
            }}
            onClick={() => onColorSchemeChange(scheme as ColorScheme)}
            title={scheme}
          />
        ))}
      </div>
    </div>
  );
}
