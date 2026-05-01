import {
  defaultTelemetryBehaviour,
  defineServerTelemetry,
} from "@twofold/framework/telemetry";
import { randomUUID } from "node:crypto";

export default defineServerTelemetry({
  async onServerSideActionError(context) {
    console.log("kitchen sink custom onServerSideActionError");
    return defaultTelemetryBehaviour();
  },
  async onServerSideApiAuthUnknownError(context) {
    console.log("kitchen sink custom onServerSideApiAuthUnknownError");
    return defaultTelemetryBehaviour();
  },
  async onServerSideApiError(context) {
    console.log("kitchen sink custom onServerSideApiError");
    return defaultTelemetryBehaviour();
  },
  async onServerSideCatastrophicError(context) {
    console.log("kitchen sink custom onServerSideCatastrophicError");
    return defaultTelemetryBehaviour();
  },
  async onServerSidePageAuthUnknownError(context) {
    console.log("kitchen sink custom onServerSidePageAuthUnknownError");
    return defaultTelemetryBehaviour();
  },
  async onServerSidePageMiddlewareError(context) {
    console.log("kitchen sink custom onServerSidePageMiddlewareError");
    return defaultTelemetryBehaviour();
  },
  onServerSidePageRenderError(context) {
    console.log("kitchen sink custom onServerSidePageRenderError");
    return defaultTelemetryBehaviour();
  },
  async getTraceMetaHeadersForBrowser(context) {
    return {
      "kitchen-sink-trace": randomUUID(),
    };
  },
  async continueTraceForRequest(request, next) {
    const kitchenSinkTrace = request.headers.get("kitchen-sink-trace");
    if (kitchenSinkTrace) {
      console.log(`continuing with trace header '${kitchenSinkTrace}'`);
    }
    return await next();
  },
});
