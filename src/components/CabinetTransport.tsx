/**
 * The drawer-front transport panel and the amplifier's 音量 knob.
 *
 * The approved artwork has no play/previous/next/home buttons, so the four
 * controls are rendered as brass plaques across the drawer beneath the sleeves --
 * a surface that already exists in the scene. Each is 80x76 design pixels, which
 * stays above the 52x52 CSS minimum at the smallest supported window.
 */
import { fontSize, place } from "../scene/designSystem";
import { HOTSPOTS, TRANSPORT_BUTTONS } from "../scene/hotspots";
import { useStore } from "../state/store";
import { Knob } from "./Knob";
import styles from "./CabinetTransport.module.css";

const videoVolumeHotspot = HOTSPOTS.find((h) => h.id === "video-volume")!;

export function CabinetTransport() {
  const playbackStatus = useStore((s) => s.playbackStatus);
  const videoVolume = useStore((s) => s.videoVolume);
  const setVideoVolume = useStore((s) => s.setVideoVolume);
  const togglePlayback = useStore((s) => s.togglePlayback);
  const nextVideo = useStore((s) => s.nextVideo);
  const previousVideo = useStore((s) => s.previousVideo);
  const goHome = useStore((s) => s.goHome);

  const isPlaying = playbackStatus === "playing";

  const handle = (action: string) => {
    switch (action) {
      case "video-toggle":
        togglePlayback();
        break;
      case "video-next":
        nextVideo(false);
        break;
      case "video-previous":
        previousVideo();
        break;
      case "home":
        goHome();
        break;
    }
  };

  return (
    <>
      {TRANSPORT_BUTTONS.map((button) => {
        const isToggle = button.action === "video-toggle";
        const labelJa = isToggle && isPlaying ? "一時停止" : button.labelJa;
        return (
          <button
            key={button.id}
            type="button"
            className={styles.plaque}
            style={place(button.rect)}
            onClick={() => handle(button.action)}
            aria-label={labelJa}
          >
            <span className={styles.glyph} aria-hidden="true">
              {isToggle ? (isPlaying ? "❙❙" : "▶") : button.action === "video-next" ? "▶❙" : button.action === "video-previous" ? "❙◀" : "⌂"}
            </span>
            <span className={styles.label} style={{ fontSize: fontSize(19) }}>
              {labelJa}
            </span>
          </button>
        );
      })}

      <Knob
        value={videoVolume}
        onChange={setVideoVolume}
        labelJa="音量"
        style={place(videoVolumeHotspot)}
      />
    </>
  );
}
