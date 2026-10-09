import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

const BASE = "/agentic-coding-guide/";
const EDITIONS = ["v2", "v3"];

// Vite's dev/preview SPA fallback always serves the root index.html; deep
// links under /v2/ or /v3/ (e.g. /v3/intro/agents) must get that edition's
// entry instead. In production, public/404.html does the equivalent
// redirect on GitHub Pages.
function editionFallback(): Plugin {
  const rewrite = (req: { url?: string }) => {
    const url = req.url ?? "";
    if (/\.[a-z0-9]+(\?|$)/i.test(url.split("?")[0])) return;
    const slug = EDITIONS.find((e) => url.startsWith(`${BASE}${e}/`));
    if (slug) req.url = `${BASE}${slug}/index.html`;
  };
  return {
    name: "edition-spa-fallback",
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
// Three entry points: the original site at /, the spatial field guide at
// /v2/ and the city at /v3/.
export default defineConfig({
  base: BASE,
  plugins: [editionFallback()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        v2: resolve(__dirname, "v2/index.html"),
        v3: resolve(__dirname, "v3/index.html"),
      },
      output: {
        // Screenshot URL modules are shared by every entry; give their
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
