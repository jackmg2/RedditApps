#!/usr/bin/env -S node --experimental-strip-types

// Bundles server sources to dist/.
//
// build.ts [--minify] [--watch]
// --minify    Minify output.
// --watch     Automatically rebuild whenever an input changes.

import fs from "node:fs";
import type { BuildOptions } from "esbuild";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

fs.rmSync("dist/server", { recursive: true, force: true });

const opts: BuildOptions = {
  bundle: true,
  logLevel: "info", // Print the port and build demarcations.
  metafile: true,
  sourcemap: "linked",
  target: "es2023", // https://esbuild.github.io/content-types/#tsconfig-json
};

const serverOpts: BuildOptions = {
  ...opts,
  entryPoints: ["src/server/index.ts"],
  format: "cjs",
  outdir: "dist/server",
  platform: "node",
};

if (watch) {
  const serverCtx = await esbuild.context(serverOpts);
  await serverCtx.watch();
} else {
  const server = await esbuild.build(serverOpts);
  if (server.metafile)
    fs.writeFileSync("dist/server.meta.json", JSON.stringify(server.metafile));
}
