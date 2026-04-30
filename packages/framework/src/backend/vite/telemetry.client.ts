import {
  isNotFoundError,
  isRedirectError,
  isUnauthorizedError,
} from "../runtime/helpers/errors.js";
import {
  ClientErrorContext,
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
    } else {
      console.error(context.error);
    }
  },
});
