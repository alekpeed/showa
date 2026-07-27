import { AlbumHotspot } from "./components/AlbumHotspot";
import { CabinetTransport } from "./components/CabinetTransport";
import { DebugHotspots } from "./components/DebugHotspots";
import { ErrorNotice } from "./components/ErrorNotice";
import { LibrarySleeves } from "./components/LibrarySleeves";
import { NewspaperHotspot } from "./components/NewspaperHotspot";
import { PhoneHotspot } from "./components/PhoneHotspot";
import { PhotoAlbumOverlay } from "./components/PhotoAlbumOverlay";
import { RadioPanel } from "./components/RadioPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Television } from "./components/Television";
import { ThumbnailQueue } from "./components/ThumbnailQueue";
import { CONTENT } from "./content/loadContent";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNews } from "./news/useNews";
import { useCompanion } from "./phone/useCompanion";
import { useRadio } from "./radio/useRadio";
import { SceneCanvas } from "./scene/SceneCanvas";

export default function App() {
  useKeyboardShortcuts();
  useRadio();
  // Lifted to the root so the scene and the settings panel share one instance --
  // otherwise "generate now" in settings would not update the newspaper.
  const news = useNews();
  const companion = useCompanion();

  return (
    <SceneCanvas>
      <h1 className="visually-hidden">{CONTENT.appConfig.appNameJa}</h1>

      <LibrarySleeves />
      <Television />
      <ThumbnailQueue />
      <CabinetTransport />
      <RadioPanel />
      <AlbumHotspot />
      {news.available && <NewspaperHotspot news={news} />}
      {companion.available && <PhoneHotspot companion={companion} />}
      <ErrorNotice />
      <PhotoAlbumOverlay />
      <SettingsPanel news={news} companion={companion} />

      {import.meta.env.DEV && <DebugHotspots />}
    </SceneCanvas>
  );
}
