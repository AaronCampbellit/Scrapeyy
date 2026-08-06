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
  const url = URL.createObjectURL(bundle);
  try {
    return await api.download({
      url,
      filename: path,
      saveAs,
      conflictAction: "uniquify",
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
