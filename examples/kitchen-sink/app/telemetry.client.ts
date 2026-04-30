import {
  defaultTelemetryBehaviour,
  defineClientTelemetry,
} from "@twofold/framework/telemetry";

export default defineClientTelemetry({
  onClientSideRenderError(context) {
    console.log("kitchen sink custom onClientSideRenderError");
    return defaultTelemetryBehaviour();
  },
});
