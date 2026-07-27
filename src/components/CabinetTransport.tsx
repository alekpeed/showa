/**
 * The amplifier's 音量 knob.
 *
 * This used to also render four brass plaques across the drawer front -- 前へ,
 * 再生, 次へ, ホーム. They were invented objects, painted onto a drawer that has
 * no buttons in the approved artwork, and every one of them duplicated something
 * she can already reach: the television toggles playback when clicked, the queue
 * puts every video one click away, and the next video follows on its own. They
 * are gone, and the drawer is a drawer again.
 *
 * The actions behind them are untouched -- Space, the arrow keys and autoplay
 * still call into the same store.
 */
import { place } from "../scene/designSystem";
import { HOTSPOTS } from "../scene/hotspots";
import { useStore } from "../state/store";
import { Knob } from "./Knob";

const videoVolumeHotspot = HOTSPOTS.find((h) => h.id === "video-volume")!;

export function CabinetTransport() {
  const videoVolume = useStore((s) => s.videoVolume);
  const setVideoVolume = useStore((s) => s.setVideoVolume);

  return (
    <Knob
      value={videoVolume}
      onChange={setVideoVolume}
      labelJa="音量"
      style={place(videoVolumeHotspot)}
    />
  );
}
