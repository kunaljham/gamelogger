import { Series } from "remotion";
import { TitleScene } from "../scenes/TitleScene";
import { ScreenshotSceneLandscape } from "../scenes/ScreenshotSceneLandscape";
import { OutroScene } from "../scenes/OutroScene";

export const Demo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={105}>
        <TitleScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <ScreenshotSceneLandscape
          filename="feed.png"
          label="Browse your match history"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <ScreenshotSceneLandscape
          filename="log-match.png"
          label="Log scores game-by-game"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <ScreenshotSceneLandscape
          filename="opponents.png"
          label="Track your record against every opponent"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <ScreenshotSceneLandscape
          filename="invite.png"
          label="Invite opponents to track their side too"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={105}>
        <OutroScene type="cta" />
      </Series.Sequence>
    </Series>
  );
};
