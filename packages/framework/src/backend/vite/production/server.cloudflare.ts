import { serverTelemetry } from "../telemetry.server";
import cloudflareWorkersAdapter, {
  CloudflareWorkersPlatformInfo,
} from "@hattip/adapter-cloudflare-workers/no-static";
import { createRouter } from "@hattip/router";

const applicationRouter = (await import("../entrypoint/entry.server")).default;

const router = createRouter<CloudflareWorkersPlatformInfo>();

// Register early middleware to guard static files.
applicationRouter.registerMiddlewareToRouter(router);

// Serve static files.
router.use(async (context) => {
  // assets only served on GET; we need to filter here so that
  // we don't operate on the request for form submissions etc.
  if (context.request.method === "GET") {
    // @ts-expect-error context.platform.env is unknown
    const response = (await context.platform.env.ASSETS.fetch(
      context.request,
    )) as Response;
    if (response.status !== 404) {
      return response;
    } else {
      // passthrough
    }
  }
});

// Handle all other requests via compiled server.
router.use(async (context) => {
  return await applicationRouter.fetchFromContext(context);
});

export default serverTelemetry.wrapCloudflareExport({
  fetch: cloudflareWorkersAdapter(router.buildHandler()),
});
