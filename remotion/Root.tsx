import { Composition } from "remotion";
import { Demo } from "./compositions/Demo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="GameLoggerDemo"
      component={Demo}
      durationInFrames={750}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
