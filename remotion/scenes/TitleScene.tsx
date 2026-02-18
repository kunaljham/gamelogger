import { useCurrentFrame, interpolate } from "remotion";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [30, 50], [20, 0], {
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
        gap: 32,
        padding: "0 400px",
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 700,
          color: "#fafafa",
          fontFamily: "Inter, sans-serif",
          opacity: titleOpacity,
        }}
      >
        GameLogger
      </div>
      <div
        style={{
          fontSize: 48,
          color: "#a1a1aa",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          lineHeight: 1.3,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        Track your friendly squash matches without affecting your USR
      </div>
    </div>
  );
};
