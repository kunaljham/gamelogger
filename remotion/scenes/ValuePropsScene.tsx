import { useCurrentFrame, interpolate } from "remotion";

const BULLETS = [
  "Log scores game-by-game, with private notes on every match",
  "Track your win/loss record against each opponent over time",
  "Invite your opponents so they can track their side of the match too",
];

export const ValuePropsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
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
        padding: "0 400px",
        gap: 48,
        opacity,
      }}
    >
      {BULLETS.map((text, i) => (
        <div
          key={i}
          style={{
            fontSize: 40,
            color: "#fafafa",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
};
