import { useState, useEffect } from "react";
import { staticFile } from "remotion";

export const Screenshot: React.FC<{
  filename: string;
  height?: number | string;
}> = ({ filename, height = "100%" }) => {
  const [errored, setErrored] = useState(false);
  const src = staticFile(filename);

  useEffect(() => {
    setErrored(false);
  }, [filename]);

  if (errored) {
    return (
      <div
        style={{
          width: typeof height === "number" ? height * 0.5 : 200,
          height,
          borderRadius: 16,
          backgroundColor: "#27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 48 }}>📱</div>
        <div style={{ color: "#71717a", fontSize: 18, fontFamily: "Inter, sans-serif" }}>
          {filename}
        </div>
        <div style={{ color: "#52525b", fontSize: 14, fontFamily: "Inter, sans-serif" }}>
          Add to public/
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      onError={() => setErrored(true)}
      style={{
        height,
        borderRadius: 16,
        objectFit: "contain",
      }}
    />
  );
};
