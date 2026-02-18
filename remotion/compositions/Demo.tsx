import { Series } from "remotion";
import { TitleScene } from "../scenes/TitleScene";
import { FeedScene } from "../scenes/FeedScene";
import { LogMatchScene } from "../scenes/LogMatchScene";
import { OpponentsScene } from "../scenes/OpponentsScene";
import { InviteScene } from "../scenes/InviteScene";
import { OutroScene } from "../scenes/OutroScene";

export const Demo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={105}>
        <TitleScene />
      </Series.Sequence>
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
      <Series.Sequence durationInFrames={105}>
        <OutroScene type="cta" />
      </Series.Sequence>
    </Series>
  );
};
