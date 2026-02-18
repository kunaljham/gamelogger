import { Series } from "remotion";
import { FeedScene } from "../scenes/FeedScene";
import { LogMatchScene } from "../scenes/LogMatchScene";
import { OpponentsScene } from "../scenes/OpponentsScene";
import { InviteScene } from "../scenes/InviteScene";

export const LandingDemo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={150}>
        <FeedScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <LogMatchScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <OpponentsScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <InviteScene />
      </Series.Sequence>
    </Series>
  );
};
