import { useCurrentFrame, interpolate } from "remotion";

export const OutroScene: React.FC<{ type: "invite" | "cta" }> = ({ type }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const slideY = interpolate(frame, [0, 20], [20, 0], {
    extrapolateRight: "clamp",
  });

  if (type === "invite") {
    return (
      <div
        style={{
          width: 1920,
          height: 1080,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: "#fafafa",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.3,
            opacity,
            transform: `translateY(${slideY}px)`,
          }}
        >
          Invite your opponents to track their side too
        </div>
      </div>
    );
  }

  // CTA scene
  const fadeOut = interpolate(frame, [75, 95], [1, 0], {
    extrapolateLeft: "clamp",
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
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontSize: 62,
          color: "#a1a1aa",
          fontFamily: "Inter, sans-serif",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        Get started at
      </div>
      <div
        style={{
          fontSize: 84,
          fontWeight: 700,
          color: "#fafafa",
          fontFamily: "Inter, sans-serif",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        gamelogger.app
      </div>
    </div>
  );
};
