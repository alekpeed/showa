import { AlbumHotspot } from "./components/AlbumHotspot";
import { CabinetTransport } from "./components/CabinetTransport";
import { DebugHotspots } from "./components/DebugHotspots";
import { ErrorNotice } from "./components/ErrorNotice";
import { LibrarySleeves } from "./components/LibrarySleeves";
import { PhotoAlbumOverlay } from "./components/PhotoAlbumOverlay";
import { RadioPanel } from "./components/RadioPanel";
import { Television } from "./components/Television";
import { ThumbnailQueue } from "./components/ThumbnailQueue";
import { CONTENT } from "./content/loadContent";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useRadio } from "./radio/useRadio";
import { SceneCanvas } from "./scene/SceneCanvas";

export default function App() {
  useKeyboardShortcuts();
  useRadio();

  return (
    <SceneCanvas>
      <h1 className="visually-hidden">{CONTENT.appConfig.appNameJa}</h1>

      <LibrarySleeves />
      <Television />
      <ThumbnailQueue />
      <CabinetTransport />
      <RadioPanel />
      <AlbumHotspot />
      <ErrorNotice />
      <PhotoAlbumOverlay />

      {import.meta.env.DEV && <DebugHotspots />}
    </SceneCanvas>
  );
}
