#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import * as vite from "vite";
import { Target, withTwofold } from "./vite/plugins.js";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import kleur from "kleur";
import { randomBytes } from "node:crypto";
import { Config } from "../types/importable.js";
import { homedir } from "node:os";
import { createCA, createCert } from "mkcert";

let nodeVersion = process.versions.node.split(".").map(Number);

if (
  !nodeVersion ||
  typeof nodeVersion[0] !== "number" ||
  typeof nodeVersion[1] !== "number" ||
  typeof nodeVersion[2] !== "number"
) {
  console.log("Could determine Node.js version, exiting.");
  process.exit(1);
}

let hasRequiredNodeVersion =
  nodeVersion[0] > 22 ||
  (nodeVersion[0] === 22 &&
    (nodeVersion[1] > 20 || (nodeVersion[1] === 20 && nodeVersion[2] >= 0)));

if (!hasRequiredNodeVersion) {
  console.log("You must use Node.js version 22.20.0 or higher to run twofold.");
  process.exit(1);
}

async function loadConfig(): Promise<Config | undefined> {
  let config: Config | undefined;
  if (
    existsSync("config/application.ts") ||
    existsSync("config/application.js")
  ) {
    const imported = await vite.runnerImport<{ default: Config }>(
      "/config/application",
    );
    config = imported.module.default;
  }
  return config;
}

interface SavedCertificate {
  key: string;
  cert: string;
  ca: string;
}

async function generateHttps() {
  let httpsCertPath = path.join(homedir(), "twofold-localhost-cert.json");
  let httpsCert: SavedCertificate;
  if (statSync(httpsCertPath).isFile()) {
    httpsCert = JSON.parse(readFileSync(httpsCertPath, "utf8"));
  } else {
    const ca = await createCA({
      organization: "Twofold",
      countryCode: "US",
      state: "NA",
      locality: "NA",
      validity: 3650,
    });
    const cert = await createCert({
      ca: { key: ca.key, cert: ca.cert },
      domains: ["127.0.0.1", "localhost"],
      validity: 3650,
    });
    httpsCert = {
      key: cert.key,
      cert: cert.cert,
      ca: ca.cert,
    };
    writeFileSync(httpsCertPath, JSON.stringify(httpsCert));
  }
  return httpsCert;
}

let program = new Command();

program.name("twofold").description("Twofold CLI");

program
  .command("dev")
  .option(
    "-p, --port <number>",
    "Port to run the development server on",
    "3000",
  )
  .option("-h, --https", "Enable HTTPS", false)
  .option("--cf", "Run for Cloudflare Workers instead of Node", false)
  .description("Run the development server")
  .action(async (options) => {
    process.env.NODE_ENV = "development";

    const cf = typeof options.cf === "boolean" ? options.cf : false;
    const target = cf ? Target.Cloudflare : Target.Node;

    {
      let key = process.env.TWOFOLD_SECRET_KEY;
      if (!key || typeof key !== "string") {
        console.warn(
          `Missing ${kleur.yellow("TWOFOLD_SECRET_KEY")}. Generating a random key.`,
        );
        process.env.TWOFOLD_SECRET_KEY = randomBytes(32).toString("hex");
      }
    }

    function createServerRestartHandler() {
      let restarting = false;

      return async (server: vite.ViteDevServer) => {
        if (restarting) {
          return;
        }
        restarting = true;
        try {
          console.log(
            "Performing full restart of server because files were created, renamed or deleted underneath /app/pages ...",
          );
          const previousUrls = server.resolvedUrls;
          await server.close();
          const newServer = await startDevServer(true, target);
          if (previousUrls) {
            server.resolvedUrls = newServer.resolvedUrls;
          }
        } finally {
          restarting = false;
        }
      };
    }

    async function startDevServer(
      isRestart: boolean,
      target: Target,
    ): Promise<vite.ViteDevServer> {
      const port = parseInt(options.port, 10) || 3000;
      const https = typeof options.https === "boolean" ? options.https : false;
      const server = await vite.createServer(
        vite.mergeConfig(
          withTwofold(
            {
              server: {
                host: "0.0.0.0",
                port,
                https: https ? await generateHttps() : undefined,
              },
            },
            false,
            target,
          ),
          (await loadConfig())?.experimental_viteConfig?.dev ?? {},
        ),
      );
      const handleServerRestart = createServerRestartHandler();
      await server.listen();

      server.watcher.on("unlink", invalidateOnTreeChange);
      server.watcher.on("add", invalidateOnTreeChange);

      async function invalidateOnTreeChange(changedFile: string) {
        if (!changedFile.startsWith(process.cwd())) {
          return;
        }
        const relativePath = path
          .relative(process.cwd(), changedFile)
          .replaceAll("\\", "/");
        if (
          relativePath.startsWith("app/") ||
          relativePath.startsWith("config/")
        ) {
          await handleServerRestart(server);
        }
      }

      if (!isRestart) {
        await server.printUrls();
      }

      return server;
    }

    const server = await startDevServer(false, target);
    await server.bindCLIShortcuts({ print: true });
  });

program
  .command("build")
  .option("--cf", "Build for Cloudflare Workers instead of Node", false)
  .description("Build the project for production")
  .action(async (options) => {
    const cf = typeof options.cf === "boolean" ? options.cf : false;
    process.env.NODE_ENV = "production";
    const builder = await vite.createBuilder(
      vite.mergeConfig(
        withTwofold({}, true, cf ? Target.Cloudflare : Target.Node),
        (await loadConfig())?.experimental_viteConfig?.build ?? {},
      ),
    );
    await builder.buildApp();

    if (cf) {
      console.log(
        `
🎉 Your Twofold app was successfully built for Cloudflare.

You can now deploy '${kleur["bold"](kleur["green"](`.twofold`))}' as a Cloudflare Worker ('.twofold/index.js' should be the entrypoint).
`,
      );
    } else {
      console.log(
        `
🎉 Your Twofold app was successfully built.

You can now run '${kleur["bold"](kleur["green"](`.twofold/index.js`))}' to run your server.

You can also copy the self-contained '.twofold' folder to another location (e.g. inside a Docker container), and run your app without source code or installing node_modules.
`,
      );
    }
  });

program
  .command("preview")
  .option("--cf", "Build for Cloudflare Workers instead of Node", false)
  .option(
    "-p, --port <number>",
    "Port to run the development server on",
    "3000",
  )
  .description("Preview a built production build")
  .action(async (options) => {
    const cf = typeof options.cf === "boolean" ? options.cf : false;
    process.env.NODE_ENV = "production";
    const port = parseInt(options.port, 10) || 3000;
    const previewServer = await vite.preview(
      vite.mergeConfig(
        withTwofold(
          {
            preview: {
              port: port,
            },
          },
          true,
          cf ? Target.Cloudflare : Target.Node,
        ),
        (await loadConfig())?.experimental_viteConfig?.preview ?? {},
      ),
    );
    await previewServer.printUrls();
    await previewServer.bindCLIShortcuts({ print: true });
  });

program.parse();
