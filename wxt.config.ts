import { defineConfig, type UserManifest } from "wxt";
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  zip: {
    excludeSources: ["node_modules/**", ".output/**", ".wxt/**", ".git/**", ".codex/**", ".playwright*/**", "work/**", "coverage/**", "dist/**", "**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.local"],
  },
  hooks: {
    "build:done": async (wxt) => {
      const destination = resolve(wxt.config.outDir, "legal");
      await mkdir(destination, { recursive: true });
      for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md", "third-party-licenses"]) {
        await cp(resolve(wxt.config.root, name), resolve(destination, name), { recursive: true });
      }
    },
  },
  manifest: ({ manifestVersion }) => {
    const optionalOrigins = ["http://*/*", "https://*/*"];
    const icons = {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png",
    };
    return {
      name: "Scrapeyy",
      description:
        "Capture structured data and design references from websites.",
      icons,
      ...(manifestVersion === 2
        ? { browser_action: { default_icon: icons } }
        : { action: { default_icon: icons } }),
      permissions: ["activeTab", "scripting", "storage", "downloads", "alarms"],
      // On-demand content scripts have no manifest matches for WXT to inherit.
      // Their shadow-root UI still fetches this packaged stylesheet.
      web_accessible_resources: [
        {
          resources: ["content-scripts/content.css"],
          matches: optionalOrigins,
          use_dynamic_url: true,
        },
      ],
      ...(manifestVersion === 2
        ? {
            optional_permissions:
              optionalOrigins as unknown as NonNullable<
                UserManifest["optional_permissions"]
              >,
          }
        : { optional_host_permissions: optionalOrigins }),
      browser_specific_settings: {
        gecko: {
          id: "scrapeyy@local",
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
    };
  },
});
