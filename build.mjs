import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [
    "src/background.ts",
    "src/content.ts",
    "src/sciezka.ts",
  ],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "es2020",
  sourcemap: watch,
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(options);
  console.log("Build complete.");
}
