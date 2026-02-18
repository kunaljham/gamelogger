import { useCurrentFrame, interpolate } from "remotion";
import { Screenshot } from "./Screenshot";

export const ScreenshotSceneLandscape: React.FC<{
  filename: string;
  label: string;
}> = ({ filename, label }) => {
  const frame = useCurrentFrame();

  const imgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [0, 15], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  const labelOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const labelY = interpolate(frame, [15, 30], [15, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        gap: 24,
      }}
    >
      {/* Label above */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 600,
          color: "#fafafa",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {label}
      </div>

      {/* Screenshot centered */}
      <div
        style={{
          opacity: imgOpacity,
          transform: `scale(${imgScale})`,
        }}
      >
        <Screenshot filename={filename} height={850} />
      </div>
    </div>
  );
};
