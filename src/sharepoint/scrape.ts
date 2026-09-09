export interface SharePointMetadata {
  SiteId: string;
  WebId: string;
  ListId: string;
  WebUrl: string;
  WebTitle: string;
  ListTitle: string;
}

export const SHAREPOINT_METADATA_FIELDS = [
  "SiteId",
  "WebId",
  "ListId",
  "WebUrl",
  "WebTitle",
  "ListTitle",
] as const satisfies readonly (keyof SharePointMetadata)[];

export function isSharePointMetadata(
  value: unknown,
): value is SharePointMetadata {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return SHAREPOINT_METADATA_FIELDS.every(
    (field) => typeof candidate[field] === "string" && candidate[field] !== "",
  );
}

type FetchJson = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function unwrapOData(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("SharePoint returned an invalid response.");
  }
  const record = value as Record<string, unknown>;
  const unwrapped = record.d;
  return typeof unwrapped === "object" && unwrapped !== null
    ? (unwrapped as Record<string, unknown>)
    : record;
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const result = value[key];
  if (typeof result !== "string" || !result.trim()) {
    throw new Error(`SharePoint did not return ${key}.`);
  }
  return result.replace(/^\{|\}$/g, "");
}

export function isSharePointUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      /(?:^|\.)sharepoint\.com$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function sharePointMetadataText(metadata: SharePointMetadata): string {
  return SHAREPOINT_METADATA_FIELDS
    .map((key) => `${key}: ${metadata[key]}`)
    .join("\n");
}

export async function scrapeSharePointMetadata(
  location: Pick<Location, "href"> | URL,
  fetchJson: FetchJson = fetch,
): Promise<SharePointMetadata> {
  const pageUrl = new URL(location.href);
  if (!isSharePointUrl(pageUrl.href)) {
    throw new Error("Open a SharePoint list or document library first.");
  }

  const decodedPath = decodeURIComponent(pageUrl.pathname);
  const siteMatch = decodedPath.match(/^\/(?:sites|teams)\/[^/]+/i);
  if (!siteMatch) {
    throw new Error("Scrapeyy could not determine the SharePoint site URL.");
  }

  const webPath = siteMatch[0];
  const webUrl = `${pageUrl.origin}${webPath}`;
  const listPath = decodedPath
    .replace(/\/Forms\/[^/]+\.aspx$/i, "")
    .replace(/\/[^/]+\.aspx$/i, "")
    .replace(/\/$/, "");

  if (!listPath || listPath.toLowerCase() === webPath.toLowerCase()) {
    throw new Error(
      "Open the SharePoint list or document library you want to inspect.",
    );
  }

  const getJson = async (url: string) => {
    const response = await fetchJson(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json;odata=nometadata" },
    });
    if (!response.ok) {
      throw new Error(
        `SharePoint request failed: ${response.status} ${response.statusText}`,
      );
    }
    return unwrapOData(await response.json());
  };

  const encodedListPath = encodeURIComponent(listPath).replace(/'/g, "%27");
  const [site, web, list] = await Promise.all([
    getJson(`${webUrl}/_api/site?$select=Id`),
    getJson(`${webUrl}/_api/web?$select=Id,Url,Title`),
    getJson(
      `${webUrl}/_api/web/GetList(@listUrl)?@listUrl='${encodedListPath}'&$select=Id,Title`,
    ),
  ]);

  return {
    SiteId: requiredString(site, "Id"),
    WebId: requiredString(web, "Id"),
    ListId: requiredString(list, "Id"),
    WebUrl: requiredString(web, "Url"),
    WebTitle: requiredString(web, "Title"),
    ListTitle: requiredString(list, "Title"),
  };
}
