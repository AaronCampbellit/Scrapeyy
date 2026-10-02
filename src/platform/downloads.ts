import { extensionBrowser } from "./browser-api";

export interface DownloadApi {
  download(options: {
    url: string;
    filename: string;
    saveAs: boolean;
    conflictAction: "uniquify";
  }): Promise<number>;
}

const defaultApi: DownloadApi = {
  download: (options) => extensionBrowser.downloads.download(options),
};

export async function downloadBundle(
  bundle: Blob,
  path: string,
  saveAs = false,
  api: DownloadApi = defaultApi,
): Promise<number> {
  const objectUrlSupported = typeof URL.createObjectURL === "function";
  const url = objectUrlSupported
    ? URL.createObjectURL(bundle)
    : await blobDataUrl(bundle);
  try {
    return await api.download({
      url,
      filename: path,
      saveAs,
      conflictAction: "uniquify",
    });
  } finally {
    if (objectUrlSupported) {
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }
}

export async function blobDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
