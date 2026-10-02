import type { PopupSite } from "./PopupApp";
import type { VideoInventory } from "../../media/videos";
import type { AppSettings, ScreenshotDestination } from "../../storage/app-settings";

interface CaptureViewProps {
  settings: AppSettings;
  onScreenshotDestinationChange(destination: ScreenshotDestination): void | Promise<void>;
  site?: PopupSite | undefined;
  disabled: boolean;
  onCreateRecipe(): void | Promise<void>;
  onQuickCapture(): void | Promise<void>;
  onScreenshot(kind: "visible" | "full-page" | "selection"): void | Promise<void>;
  onInspectVideos(): void | Promise<void>;
  onDownloadVideo(url: string): void | Promise<void>;
  onExportVideoDetails(): void | Promise<void>;
  videos?: VideoInventory | undefined;
}

export function CaptureView({
  settings,
  onScreenshotDestinationChange,
  site,
  disabled,
  onCreateRecipe,
  onQuickCapture,
  onScreenshot,
  onInspectVideos,
  onDownloadVideo,
  onExportVideoDetails,
  videos,
}: CaptureViewProps) {
  const available = site && site.access !== "unavailable";
  return (
    <section className="popup-view capture-view" aria-label="Capture">
      <div className="site-card">
        <div>
          <span className="eyebrow">Current site</span>
          <strong className="site-origin">{site?.origin ?? "Open a website"}</strong>
        </div>
        <span className={`status-dot status-${site?.access ?? "unavailable"}`}>
          {!available
            ? "Unavailable on this page"
            : site.access === "persistent"
              ? "Always allowed"
              : "Allowed for this visit"}
        </span>
      </div>
      <button
        aria-label="Quick Capture"
        className="capture-primary"
        disabled={!available || disabled}
        onClick={() => void onQuickCapture()}
        type="button"
      >
        <span className="capture-icon" aria-hidden="true">+</span>
        <span>
          <strong>Quick Capture</strong>
          <small>Click an element, drag a region, or choose the full page</small>
        </span>
      </button>
      <section className="quick-tools" aria-label="Screenshots">
        <div><strong>Screenshot</strong><small>Capture a PNG of this page</small></div>
        <label className="settings-field">
          <span>Save screenshots to</span>
          <select aria-label="Save screenshots to" value={settings.screenshotDestination} disabled={disabled}
            onChange={(event) => void onScreenshotDestinationChange(event.currentTarget.value as ScreenshotDestination)}>
            <option value="ask">Save As dialog</option>
            <option value="automatic">Automatically save to device</option>
            <option value="inbox">Scrapeyy Inbox</option>
          </select>
        </label>
        {settings.screenshotDestination === "automatic" ? <small>Download folder / {settings.screenshotSubfolder} · Change location in Settings.</small> : null}
        <div className="screenshot-actions">
          <button type="button" disabled={!available || disabled} onClick={() => void onScreenshot("visible")}>Visible page</button>
          <button type="button" disabled={!available || disabled} onClick={() => void onScreenshot("full-page")}>Full page</button>
          <button type="button" disabled={!available || disabled} onClick={() => void onScreenshot("selection")}>Draw selection</button>
        </div>
        {disabled ? <small role="status">Working… Keep this page selected.</small> : null}
      </section>
      <section className="quick-tools" aria-label="Video tools">
        <div className="tool-heading"><div><strong>Video tools</strong><small>Find video files, links, and captions</small></div>
          <button type="button" disabled={!available || disabled} onClick={() => void onInspectVideos()}>Scan videos</button>
        </div>
        {videos ? <div className="video-results">
          <small>{videos.videos.length} video{videos.videos.length === 1 ? "" : "s"} found</small>
          {videos.videos.map((video, index) => <article key={index}>
            <strong>{video.title}</strong>
            {video.sources.map((source) => <div className="video-source" key={source.url}>
              <small>{source.kind === "file" ? "Direct file" : source.kind === "stream" ? "Streaming playlist" :
                source.kind === "blob" ? "Browser stream" : source.kind === "embed" ? "Embedded player" : "Media link"}</small>
              <span title={source.url}>{source.url}</span>
              {source.note ? <small>{source.note}</small> : null}
              {source.kind === "file" ? <button type="button" disabled={disabled}
                onClick={() => void onDownloadVideo(source.url)}>Download video</button> : null}
            </div>)}
            {!video.sources.length ? <small>No source exposed yet. Start playback, then scan again.</small> : null}
            <small>{video.captions.length} caption track{video.captions.length === 1 ? "" : "s"}
              {video.duration === null ? "" : " · " + Math.round(video.duration) + " seconds"}</small>
          </article>)}
          {videos.notes.map((note) => <p key={note}>{note}</p>)}
          <button type="button" disabled={disabled} onClick={() => void onExportVideoDetails()}>Export video details</button>
        </div> : null}
      </section>
      <button
        aria-label="Create Recipe"
        className="capture-secondary"
        disabled={!available || disabled}
        onClick={() => void onCreateRecipe()}
        type="button"
      >
        <span>
          <strong>Create Recipe</strong>
          <small>Add fields, pagination, schedules, and delivery</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
      <div className="local-note">
        <span aria-hidden="true">●</span>
        Captures stay in this browser.
      </div>
    </section>
  );
}
