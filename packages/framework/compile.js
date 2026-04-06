import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

const rewriteImports = {
  name: "rewrite-imports",
  async setup(build) {
    let outDir;
    build.onStart(() => {
      const options = build.initialOptions;
      const absWorkingDir = options.absWorkingDir ?? process.cwd();
      outDir = options.outdir
        ? path.resolve(absWorkingDir, options.outdir)
        : options.outfile
          ? path.dirname(path.resolve(absWorkingDir, options.outfile))
          : null;
    });
    build.onEnd(async (args) => {
      if (outDir) {
        for (const file of readdirSync(outDir, {
          recursive: true,
          withFileTypes: true,
        })) {
          if (file.isFile() && file.name.endsWith(".js")) {
            const originalContents = readFileSync(
              path.join(file.parentPath, file.name),
              "utf-8",
            );
            const newContents = originalContents.replaceAll(
              /"@twofold\/([a-z-]+)"/g,
              `"@${process.env.PACKAGE_NAMESPACE}/$1"`,
            );
            if (originalContents != newContents) {
              writeFileSync(path.join(file.parentPath, file.name), newContents);
            }
          }
        }
      }
    });
  },
};

async function main() {
  let dir = new URL("./dist/", import.meta.url);

  await rm(dir, { recursive: true, force: true });

  await build({
    format: "esm",
    logLevel: "info",
    entryPoints: ["./src/backend/**/*.ts"],
    outdir: "./dist/backend",
    packages: "external",
    platform: "node",
    plugins:
      process.env.PACKAGE_NAMESPACE !== undefined
        ? [rewriteImports]
        : undefined,
  });
}

await main();
