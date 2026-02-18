import { useCurrentFrame, interpolate } from "remotion";
import { Screenshot } from "./Screenshot";

const BAR_HEIGHT = 200;

export const ScreenshotScene: React.FC<{
  filename: string;
  label: string;
}> = ({ filename, label }) => {
  const frame = useCurrentFrame();

  const imgOpacity = interpolate(frame, [0, 15], [0, 1], {
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
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
      }}
    >
      {/* Screenshot area */}
      <div
        style={{
          height: 1920 - BAR_HEIGHT,
          opacity: imgOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Screenshot filename={filename} />
      </div>

      {/* Black bar with label */}
      <div
        style={{
          height: BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          borderTop: "1px solid #27272a",
          padding: "0 48px",
        }}
      >
        <div
          style={{
            fontSize: 56,
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
      </div>
    </div>
  );
};
