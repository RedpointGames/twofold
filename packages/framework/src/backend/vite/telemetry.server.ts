import kleur from "kleur";
import {
  isNotFoundError,
  isRedirectError,
  isUnauthorizedError,
  redirectErrorInfo,
} from "../runtime/helpers/errors.js";
import { tfPaths } from "./special-pages.js";
import {
  defineServerTelemetry_requireAllHooks,
  isDefaultTelemetryBehaviour,
  ServerErrorContext,
  ServerTracingContext,
} from "./telemetry.js";
import appServerTelemetry from "virtual:twofold/telemetry-server";

function logError(context: ServerErrorContext, isCatastrophic?: boolean) {
  const defaultCategory = isCatastrophic
    ? "Catastrophic"
    : "Internal server error";
  let location;
  switch (context.location) {
    case "api-middleware":
      location = " [API Middleware]";
      break;
    case "api":
      location = " [API Route]";
      break;
    case "page-middleware":
      location = " [Page Middleware]";
      break;
    case "page":
      location = " [Page]";
      break;
    case "action-request":
      location = " [Action via Request]";
      break;
    case "action-form":
      location = " [Action via Form]";
      break;
    case "ssr":
      location = " [SSR]";
      break;
    case "client-asset":
      location = " [Client Asset]";
      break;
    default:
      location = "";
      break;
  }
  if (location !== "") {
    location = kleur["yellow"](location);
  }
  if (context.error) {
    if (isNotFoundError(context.error)) {
      console.error(
        `${kleur["red"](`[Not found]`)}%s %s`,
        location,
        context.url,
      );
    } else if (isUnauthorizedError(context.error)) {
      console.error(
        `${kleur["red"](`[Unauthorized]`)}%s %s`,
        location,
        context.url,
      );
    } else if (isRedirectError(context.error)) {
      const redirectError = redirectErrorInfo(context.error);
      console.error(
        `${kleur["cyan"](`[Redirect]`)}%s %s -> %s`,
        location,
        context.url,
        redirectError.url,
      );
    } else {
      console.error(
        `${kleur["red"](`[${defaultCategory}]`)}%s %s %o`,
        location,
        context.url,
        context.error,
      );
    }
  } else {
    console.error(
      `${kleur["red"](`[${defaultCategory}]`)}%s %s`,
      location,
      context.url,
    );
  }
}

export const serverTelemetry = defineServerTelemetry_requireAllHooks({
  async onServerSideCatastrophicError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSideCatastrophicError) {
      let appResult =
        await appServerTelemetry.onServerSideCatastrophicError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    logError(context, true);
  },

  async onServerSideApiError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSideApiError) {
      let appResult = await appServerTelemetry.onServerSideApiError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    logError(context);

    if (isNotFoundError(context.error)) {
      return new Response("Not found", { status: 404 });
    } else if (isUnauthorizedError(context.error)) {
      return new Response("Unauthorized", { status: 401 });
    } else if (isRedirectError(context.error)) {
      let { status, url } = redirectErrorInfo(context.error);
      return new Response(null, {
        status,
        headers: {
          Location: url,
        },
      });
    } else {
      return new Response("Internal server error", { status: 500 });
    }
  },

  async onServerSidePageMiddlewareError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSidePageMiddlewareError) {
      let appResult =
        await appServerTelemetry.onServerSidePageMiddlewareError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    logError(context);

    if (isNotFoundError(context.error)) {
      return context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.notFound,
      );
    } else if (isUnauthorizedError(context.error)) {
      return context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.unauthorized,
      );
    } else if (isRedirectError(context.error)) {
      const errorInfo = redirectErrorInfo(context.error);
      return context.applicationRuntime.createRedirectResponse(
        context.renderRequest,
        errorInfo.url,
        errorInfo.status,
      );
    } else {
      return context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.internalServerError,
        context.error,
      );
    }
  },

  onServerSidePageRenderError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSidePageRenderError) {
      let appResult = appServerTelemetry.onServerSidePageRenderError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    logError(context);

    if (
      typeof context.error === "object" &&
      context.error !== null &&
      "digest" in context.error &&
      typeof context.error.digest === "string"
    ) {
      // Pass digest from server to client unmodified. This is what allows the client to recognise special errors such as "not found".
      return context.error.digest;
    } else {
      // No digest for this error.
      return undefined;
    }
  },

  async onServerSideActionError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSideActionError) {
      let appResult = await appServerTelemetry.onServerSideActionError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    logError(context);

    // @note: If a response is returned here, the client
    // will not get an opportunity to catch the error from
    // the server call.
    //
    // Therefore, we only replace content for errors that
    // are really unexpected from a server action.

    if (isNotFoundError(context.error)) {
      return await context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.notFound,
      );
    } else if (isUnauthorizedError(context.error)) {
      // @note: We do not return the unauthorized page here
      // in case the client wants to catch the unauthorized error.
    } else if (isRedirectError(context.error)) {
      const redirectInfo = redirectErrorInfo(context.error);
      return context.applicationRuntime.createRedirectResponse(
        context.renderRequest,
        redirectInfo.url,
      );
    }
  },

  async onServerSidePageAuthUnknownError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSidePageAuthUnknownError) {
      let appResult =
        await appServerTelemetry.onServerSidePageAuthUnknownError(context);
      if (!isDefaultTelemetryBehaviour(appResult) && appResult) {
        return appResult;
      }
    }

    logError(context);

    if (isNotFoundError(context.error)) {
      return context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.notFound,
      );
    } else if (isUnauthorizedError(context.error)) {
      return context.applicationRuntime.noAuthChecks_runSpecialPage(
        context.renderRequest,
        tfPaths.throwing.unauthorized,
      );
    } else if (isRedirectError(context.error)) {
      const redirectInfo = redirectErrorInfo(context.error);
      return context.applicationRuntime.createRedirectResponse(
        context.renderRequest,
        redirectInfo.url,
        redirectInfo.status,
      );
    } else {
      logError(context);
      return new Response("Access denied due to an internal error", {
        status: 403,
      });
    }
  },

  async onServerSideApiAuthUnknownError(context: ServerErrorContext) {
    if (appServerTelemetry?.onServerSideApiAuthUnknownError) {
      let appResult =
        await appServerTelemetry.onServerSideApiAuthUnknownError(context);
      if (!isDefaultTelemetryBehaviour(appResult) && appResult) {
        return appResult;
      }
    }

    logError(context);

    if (isNotFoundError(context.error)) {
      return new Response("Not Found", { status: 404 });
    } else if (isUnauthorizedError(context.error)) {
      return new Response("Unauthorized", { status: 401 });
    } else if (isRedirectError(context.error)) {
      let { status, url } = redirectErrorInfo(context.error);
      return new Response(null, {
        status,
        headers: {
          Location: url,
        },
      });
    } else {
      logError(context);
      return new Response("Access denied due to an internal error", {
        status: 403,
      });
    }
  },

  async onServerSideDeniedAccessToClientAsset(context) {
    if (appServerTelemetry?.onServerSideDeniedAccessToClientAsset) {
      let appResult =
        await appServerTelemetry.onServerSideDeniedAccessToClientAsset(context);
      if (!isDefaultTelemetryBehaviour(appResult) && appResult) {
        return appResult;
      }
    }

    logError(context);

    return new Response("Access denied to protected asset", {
      status: 403,
    });
  },

  async getTraceMetaHeadersForBrowser(context: ServerTracingContext) {
    if (appServerTelemetry?.getTraceMetaHeadersForBrowser) {
      return appServerTelemetry.getTraceMetaHeadersForBrowser(context);
    }
  },

  async continueTraceForRequest(
    request: Request,
    next: () => Promise<Response>,
  ) {
    if (appServerTelemetry?.continueTraceForRequest) {
      return await appServerTelemetry.continueTraceForRequest(request, next);
    }

    return await next();
  },
});
