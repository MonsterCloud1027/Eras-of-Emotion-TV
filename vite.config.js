import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(rootDir, "data");

/** Dev: serve /data from repo data/; build: copy into dist/data (Python pipeline unchanged). */
function dataDirPlugin() {
  return {
    name: "data-dir-static",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const rel = urlPath.replace(/^\//, "");
        const filePath = path.resolve(dataDir, rel);

        if (!filePath.startsWith(dataDir + path.sep) && filePath !== dataDir) {
          res.statusCode = 403;
          res.end();
          return;
        }

        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) {
            next();
            return;
          }
          const types = {
            ".json": "application/json",
            ".csv": "text/csv",
            ".tsv": "text/tab-separated-values",
          };
          const ext = path.extname(filePath);
          res.setHeader(
            "Content-Type",
            types[ext] || "application/octet-stream"
          );
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist", "data");
      fs.mkdirSync(path.dirname(outDir), { recursive: true });
      fs.cpSync(dataDir, outDir, { recursive: true });
    },
  };
}

/** GitHub Project Pages: https://<user>.github.io/<repo>/ — set in CI via VITE_BASE_PATH */
function normalizeBase(base) {
  if (!base || base === "/") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

const pagesBase = normalizeBase(process.env.VITE_BASE_PATH || "/");

export default defineConfig({
  base: pagesBase,
  root: rootDir,
  publicDir: "public",
  plugins: [dataDirPlugin()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        lyricalThemes: path.resolve(rootDir, "lyrical-themes.html"),
        lyricalPatterns: path.resolve(rootDir, "lyrical-patterns.html"),
        lyricalComplexity: path.resolve(rootDir, "lyrical-complexity.html"),
        songStructure: path.resolve(rootDir, "song-structure.html"),
      },
    },
  },
});
