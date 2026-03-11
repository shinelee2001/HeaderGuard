import esbuild from "esbuild";
import { mkdir, cp } from "node:fs/promises";
import path from "node:path";

const isWatch = process.argv.includes("--watch");
const root = process.cwd();
const distDir = path.join(root, "dist");

async function copyStaticFiles() {
  await mkdir(path.join(distDir, "src", "popup"), { recursive: true });
  await mkdir(path.join(distDir, "icons"), { recursive: true });

  await cp(path.join(root, "manifest.json"), path.join(distDir, "manifest.json"));
  await cp(path.join(root, "icons"), path.join(distDir, "icons"), { recursive: true });
  await cp(
    path.join(root, "src", "popup", "popup.html"),
    path.join(distDir, "src", "popup", "popup.html")
  );
  await cp(
    path.join(root, "src", "popup", "popup.css"),
    path.join(distDir, "src", "popup", "popup.css")
  );
}

const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
  logLevel: "info"
};

async function buildAll() {
  await copyStaticFiles();

  const ctxBackground = await esbuild.context({
    ...common,
    entryPoints: ["src/background/service_worker.ts"],
    outfile: "dist/src/background/service_worker.js"
  });

  const ctxPopup = await esbuild.context({
    ...common,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/src/popup/popup.js"
  });

  if (isWatch) {
    await ctxBackground.watch();
    await ctxPopup.watch();
    console.log("Watching for changes...");
    return;
  }

  await ctxBackground.rebuild();
  await ctxPopup.rebuild();
  await ctxBackground.dispose();
  await ctxPopup.dispose();
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});