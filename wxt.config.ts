import { defineConfig, type UserManifest } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ manifestVersion }) => {
    const optionalOrigins = ["http://*/*", "https://*/*"];
    return {
      name: "Scrapeyy",
      description:
        "Capture structured data and design references from websites.",
      permissions: ["activeTab", "scripting", "storage", "downloads", "alarms"],
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
