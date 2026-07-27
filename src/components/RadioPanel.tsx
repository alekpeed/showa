/**
 * The tuner: station display, power (the amplifier's input selector), volume knob
 * and power lamp.
 *
 * The input selector is used as the power control because its painted labels read
 * PHONO / TUNER / AUX -- "switch the amplifier to the tuner" is the physically
 * honest meaning of turning the radio on, and it needs no new object in the scene.
 */
import { CONTENT } from "../content/loadContent";
import { fontSize, place } from "../scene/designSystem";
import { HOTSPOTS, RADIO_LAMP, TUNER_DISPLAY } from "../scene/hotspots";
import { useStore } from "../state/store";
import { Knob } from "./Knob";
import styles from "./RadioPanel.module.css";

const powerHotspot = HOTSPOTS.find((h) => h.id === "radio-power")!;
const volumeHotspot = HOTSPOTS.find((h) => h.id === "radio-volume")!;

const STATUS_TEXT: Record<string, string> = {
  off: "電源オフ",
  connecting: "つないでいます…",
  playing: "放送中",
  error: "受信できません",
};

export function RadioPanel() {
  const radioStatus = useStore((s) => s.radioStatus);
  const radioVolume = useStore((s) => s.radioVolume);
  const toggleRadio = useStore((s) => s.toggleRadio);
  const setRadioVolume = useStore((s) => s.setRadioVolume);

  const isOn = radioStatus === "playing" || radioStatus === "connecting";

  return (
    <>
      {/* Illuminated station display laid over the painted tuner window. Station
          and status stack, because side by side they overrun the 336px window. */}
      <div className={styles.display} style={place(TUNER_DISPLAY)} data-on={isOn || undefined}>
        <span className={styles.station} style={{ fontSize: fontSize(24) }}>
          {CONTENT.radio.name}
        </span>
        <span className={styles.status} style={{ fontSize: fontSize(18) }}>
          {STATUS_TEXT[radioStatus]}
        </span>
        {radioStatus === "playing" && (
          <span className={styles.equalizer} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </div>

      <span
        className={styles.lamp}
        style={place(RADIO_LAMP)}
        data-on={isOn || undefined}
        aria-hidden="true"
      />

      <button
        type="button"
        className={styles.power}
        style={place(powerHotspot)}
        onClick={toggleRadio}
        aria-pressed={isOn}
        aria-label={`ラジオ　${CONTENT.radio.name}`}
      >
        <span className={styles.powerRing} aria-hidden="true" />
      </button>

      <Knob
        value={radioVolume}
        onChange={setRadioVolume}
        labelJa="ラジオの音量"
        style={place(volumeHotspot)}
      />

      <span className="visually-hidden" role="status">
        ラジオ　{STATUS_TEXT[radioStatus]}
      </span>
    </>
  );
}
