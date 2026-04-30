import {
  defaultTelemetryBehaviour,
  defineServerTelemetry,
} from "@twofold/framework/telemetry";

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
});
