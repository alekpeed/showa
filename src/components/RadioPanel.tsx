/**
 * The tuner: station display, power, volume knob and power lamp.
 *
 * Power is the large brass knob beside the station display -- one click on, one
 * click off. It used to be the amplifier's input selector, which was defensible
 * on paper (its painted labels read PHONO / TUNER / AUX) and useless in practice:
 * the control that looks like the radio's switch has to be the radio's switch.
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
