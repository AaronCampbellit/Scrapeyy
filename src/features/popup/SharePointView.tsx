import { useState } from "react";

import {
  SHAREPOINT_METADATA_FIELDS,
  sharePointMetadataText,
  type SharePointMetadata,
} from "../../sharepoint/scrape";
import type { PopupSite } from "./PopupApp";

interface SharePointViewProps {
  site?: PopupSite | undefined;
  disabled: boolean;
  metadata?: SharePointMetadata | undefined;
  onScrape(): void | Promise<void>;
}

export function SharePointView({
  site,
  disabled,
  metadata,
  onScrape,
}: SharePointViewProps) {
  const available = site && site.access !== "unavailable";
  const [copiedField, setCopiedField] = useState<string>();
  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
  };

  return (
    <section className="popup-view sharepoint-view" aria-label="SharePoint">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Microsoft 365</span>
          <h2>SharePoint Scraper</h2>
        </div>
      </div>
      <div className="site-card">
        <div>
          <span className="eyebrow">Current site</span>
          <strong className="site-origin">{site?.origin ?? "Open SharePoint"}</strong>
        </div>
      </div>
      <button
        aria-label="Scrape SharePoint details"
        className="capture-primary"
        disabled={!available || disabled}
        onClick={() => void onScrape()}
        type="button"
      >
        <span className="capture-icon" aria-hidden="true">S</span>
        <span>
          <strong>Get SharePoint IDs</strong>
          <small>Read the current site, web, and list or library identifiers</small>
        </span>
      </button>
      {metadata ? (
        <div className="sharepoint-results" aria-label="SharePoint details">
          <span className="eyebrow">SharePoint details</span>
          <div className="sharepoint-field-list">
            {SHAREPOINT_METADATA_FIELDS.map((field) => (
              <div className="sharepoint-field" key={field}>
                <span>{field}</span>
                <code>{metadata[field]}</code>
                <button
                  aria-label={`Copy ${field}`}
                  onClick={() => void copyText(field, metadata[field])}
                  type="button"
                >
                  {copiedField === field ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>
          <button
            aria-label="Copy all SharePoint details"
            onClick={() => void copyText("all", sharePointMetadataText(metadata))}
            type="button"
          >
            {copiedField === "all" ? "Copied all" : "Copy all"}
          </button>
        </div>
      ) : (
        <div className="popup-empty sharepoint-empty">
          <strong>No SharePoint details yet</strong>
          <span>Open a SharePoint list or document library, then scrape it here.</span>
        </div>
      )}
    </section>
  );
}
