import { Composition } from "remotion";
import { Demo } from "./compositions/Demo";
import { LandingDemo } from "./compositions/LandingDemo";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="GameLoggerDemo"
        component={Demo}
        durationInFrames={750}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="LandingDemo"
        component={LandingDemo}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
