import { extensionBrowser } from "./browser-api";

export interface PermissionApi {
  contains(request: { origins: string[] }): Promise<boolean>;
  request(request: { origins: string[] }): Promise<boolean>;
  remove(request: { origins: string[] }): Promise<boolean>;
}

const defaultApi: PermissionApi = {
  contains: (request) => extensionBrowser.permissions.contains(request),
  request: (request) => extensionBrowser.permissions.request(request),
  remove: (request) => extensionBrowser.permissions.remove(request),
};

export function originPattern(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Origin must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Origin must use http or https");
  }
  return `${url.origin}/*`;
}

export async function hasOriginAccess(
  origin: string,
  api: PermissionApi = defaultApi,
): Promise<boolean> {
  return await api.contains({ origins: [originPattern(origin)] });
}

export async function requestOriginAccess(
  origin: string,
  api: PermissionApi = defaultApi,
): Promise<boolean> {
  return await api.request({ origins: [originPattern(origin)] });
}

export async function revokeOriginAccess(
  origin: string,
  api: PermissionApi = defaultApi,
): Promise<boolean> {
  return await api.remove({ origins: [originPattern(origin)] });
}
