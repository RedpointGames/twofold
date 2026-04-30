import {
  isNotFoundError,
  isRedirectError,
  isUnauthorizedError,
} from "../runtime/helpers/errors.js";
import {
  ClientErrorContext,
  ClientTracingContext,
  defineClientTelemetry_requireAllHooks,
  isDefaultTelemetryBehaviour,
} from "./telemetry.js";
import appClientTelemetry from "virtual:twofold/telemetry-client";

export const clientTelemetry = defineClientTelemetry_requireAllHooks({
  onClientSideRenderError(context: ClientErrorContext) {
    if (appClientTelemetry?.onClientSideRenderError) {
      let appResult = appClientTelemetry.onClientSideRenderError(context);
      if (!isDefaultTelemetryBehaviour(appResult)) {
        return appResult;
      }
    }

    if (
      isNotFoundError(context.error) ||
      isUnauthorizedError(context.error) ||
      isRedirectError(context.error)
    ) {
      // These should already have been reported by the server.
    } else if (!import.meta.env.SSR) {
      // No need to report in SSR, because they will be reported to onServerSideReceivedSsrError.
      console.error(context.error);
    }
  },

  async getTraceHttpHeadersForServerAction(context: ClientTracingContext) {
    if (appClientTelemetry?.getTraceHttpHeadersForServerAction) {
      return appClientTelemetry.getTraceHttpHeadersForServerAction(context);
    }
  },

  async getTraceHttpHeadersForRscPageLoad(context: ClientTracingContext) {
    if (appClientTelemetry?.getTraceHttpHeadersForRscPageLoad) {
      return appClientTelemetry.getTraceHttpHeadersForRscPageLoad(context);
    }
  },
});
