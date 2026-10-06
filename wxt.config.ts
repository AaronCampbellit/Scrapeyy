import { defineConfig, type UserManifest } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
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
