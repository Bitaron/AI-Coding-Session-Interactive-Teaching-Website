import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

const BASE = "/agentic-coding-guide/";

// Vite's dev/preview SPA fallback always serves the root index.html; deep
// links under /v2/ (e.g. /v2/intro/3) must get the v2 entry instead. In
// production, public/404.html does the equivalent redirect on GitHub Pages.
function v2Fallback(): Plugin {
  const rewrite = (req: { url?: string }) => {
    const url = req.url ?? "";
    const isV2Route =
      url.startsWith(`${BASE}v2/`) && !/\.[a-z0-9]+(\?|$)/i.test(url.split("?")[0]);
    if (isV2Route) req.url = `${BASE}v2/index.html`;
  };
  return {
    name: "v2-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

// GitHub Pages project site: served from /<repo-name>/, not the domain root.
// Two entry points: the original site at / and the spatial redesign at /v2/.
export default defineConfig({
  base: BASE,
  plugins: [v2Fallback()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        v2: resolve(__dirname, "v2/index.html"),
      },
      output: {
        // Screenshot URL modules are shared by both entries; give their
        // chunk a readable name, and keep three.js cacheable on its own.
        manualChunks(id) {
          if (id.endsWith(".png")) return "shots";
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
