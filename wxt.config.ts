import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Scrapeyy",
    description: "Capture structured data and design references from websites.",
    permissions: ["activeTab", "scripting", "storage", "downloads", "alarms"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
  },
});
