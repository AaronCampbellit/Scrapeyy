import { useEffect, useState } from "react";

import type { CaptureRun } from "../../contracts/models";
import type { PreviewType } from "../../platform/preview-window";
import type { AppTheme } from "../../storage/app-settings";
import { captureText } from "./capture-text";
import "../shared/theme.css";
import "./preview.css";

export interface PreviewCapture {
  run: CaptureRun;
  title: string;
  theme: AppTheme;
  screenshot?: Blob;
}

export interface PreviewServices {
  load(runId: string): Promise<PreviewCapture | undefined>;
  exportRun(runId: string): Promise<void>;
}

export function PreviewApp({
  runId,
  initialView,
  services,
}: {
  runId: string | null;
  initialView: PreviewType;
  services: PreviewServices;
}) {
  const [capture, setCapture] = useState<PreviewCapture>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [view, setView] = useState(initialView);
  const [imageUrl, setImageUrl] = useState<string>();
  const [imageError, setImageError] = useState(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>();
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCapture(undefined);
    setError(undefined);
    setView(initialView);
    setZoom("fit");
    if (!runId) {
      setLoading(false);
      setError("No capture was selected. Open a preview from the Inbox.");
      return;
    }
    void services
      .load(runId)
      .then((result) => {
        if (!active) return;
        if (result) setCapture(result);
        else
          setError(
            "This capture is no longer in the Inbox. It may have been cleared or expired.",
          );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this capture.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [runId, initialView, services]);

  useEffect(() => {
    setImageUrl(undefined);
    setImageError(false);
    setDimensions(undefined);
    if (!capture?.screenshot) return;
    const url = URL.createObjectURL(capture.screenshot);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capture?.screenshot]);

  useEffect(() => {
    document.title = capture
      ? `${capture.title} · Scrapeyy preview`
      : "Scrapeyy preview";
  }, [capture?.title]);

  const exportCapture = async () => {
    if (!capture) return;
    setExporting(true);
    setNotice(undefined);
    try {
      await services.exportRun(capture.run.id);
      setNotice(
        capture.run.screenshot
          ? "Screenshot saved to device."
          : "Export started.",
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not export this capture.",
      );
    } finally {
      setExporting(false);
    }
  };

  const readableText =
    capture && view === "text" ? captureText(capture.run) : "";

  return (
    <main
      className="preview-shell"
      data-theme={capture?.theme ?? "dark"}
      aria-busy={loading}
    >
      <header className="preview-header">
        <div className="preview-title">
          <span className="preview-eyebrow">Scrapeyy · Inbox preview</span>
          <h1>{capture?.title ?? "Capture preview"}</h1>
          {capture ? (
            <p>
              {new Date(
                capture.run.completedAt ?? capture.run.startedAt,
              ).toLocaleString()}{" "}
              ·{" "}
              {capture.run.screenshot
                ? `PNG · ${capture.run.screenshot.kind}`
                : `${capture.run.recordCount} records`}{" "}
              · {capture.run.status}
            </p>
          ) : null}
        </div>
        {capture ? (
          <button
            className="preview-save"
            disabled={exporting}
            type="button"
            onClick={() => void exportCapture()}
          >
            {exporting
              ? "Saving…"
              : capture.run.screenshot
                ? "Save PNG…"
                : "Export"}
          </button>
        ) : null}
        <button type="button" onClick={() => window.close()}>
          Close
        </button>
      </header>
      {capture ? (
        <div className="preview-toolbar">
          <div
            role="group"
            aria-label="Preview type"
            className="preview-switch"
          >
            <button
              type="button"
              aria-pressed={view === "text"}
              onClick={() => setView("text")}
            >
              Text
            </button>
            <button
              type="button"
              aria-pressed={view === "screenshot"}
              onClick={() => setView("screenshot")}
            >
              Screenshot
            </button>
          </div>
          {view === "screenshot" && imageUrl && !imageError ? (
            <div
              className="preview-zoom"
              role="group"
              aria-label="Screenshot zoom"
            >
              <button
                type="button"
                aria-pressed={zoom === "fit"}
                onClick={() => setZoom("fit")}
              >
                Fit width
              </button>
              <button
                type="button"
                aria-label="Actual size"
                aria-pressed={zoom === 100}
                onClick={() => setZoom(100)}
              >
                100%
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoom !== "fit" && zoom <= 25}
                onClick={() =>
                  setZoom(Math.max(25, (zoom === "fit" ? 100 : zoom) - 25))
                }
              >
                −
              </button>
              <output aria-label="Zoom level">
                {zoom === "fit" ? "Fit width" : `${zoom}%`}
              </output>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={zoom !== "fit" && zoom >= 400}
                onClick={() =>
                  setZoom(Math.min(400, (zoom === "fit" ? 100 : zoom) + 25))
                }
              >
                +
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <section
        className="preview-content"
        aria-label="Capture preview"
        tabIndex={0}
      >
        {loading ? (
          <p className="preview-message" role="status">
            Loading capture…
          </p>
        ) : error ? (
          <p className="preview-message" role="alert">
            {error}
          </p>
        ) : capture ? (
          view === "text" ? (
            readableText ? (
              <div className="preview-text">{readableText}</div>
            ) : (
              <p className="preview-message">No readable text was extracted.</p>
            )
          ) : imageError ? (
            <p className="preview-message" role="alert">
              The screenshot could not be displayed.
            </p>
          ) : imageUrl ? (
            <img
              className="preview-image"
              alt="Captured screenshot"
              src={imageUrl}
              style={
                zoom === "fit"
                  ? { maxWidth: "100%" }
                  : {
                      maxWidth: "none",
                      width: dimensions
                        ? (dimensions.width * zoom) / 100
                        : undefined,
                    }
              }
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setImageError(true)}
            />
          ) : (
            <p className="preview-message">
              No screenshot was captured for this run.
            </p>
          )
        ) : null}
      </section>
      <footer className="preview-footer">
        <span>
          {view === "screenshot" && dimensions
            ? `${dimensions.width} × ${dimensions.height} px`
            : "Saved locally in this browser"}
        </span>
        {capture?.run.warnings?.length ? (
          <details>
            <summary>
              {capture.run.warnings.length} warning
              {capture.run.warnings.length === 1 ? "" : "s"}
            </summary>
            <ul>
              {capture.run.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {notice ? <span role="status">{notice}</span> : null}
      </footer>
    </main>
  );
}
