import {
  defaultTelemetryBehaviour,
  defineClientTelemetry,
} from "@twofold/framework/telemetry";

let kitchenSinkTrace = import.meta.env.SSR
  ? undefined
  : document.querySelector<HTMLMetaElement>("meta[name=kitchen-sink-trace]")
      ?.content;

export default defineClientTelemetry({
  onClientSideRenderError(context) {
    console.log("kitchen sink custom onClientSideRenderError");
    return defaultTelemetryBehaviour();
  },
  async onClientSideNavigationBegin(context) {
    kitchenSinkTrace = `clientside-${Math.random()}`;
  },
  async getTraceHttpHeadersForRscPageLoad(context) {
    return {
      "kitchen-sink-telemetry-id": kitchenSinkTrace ?? "",
      "kitchen-sink-telemetry-type": "rsc-page-load",
    };
  },
  async getTraceHttpHeadersForServerAction(context) {
    return {
      "kitchen-sink-telemetry-id": kitchenSinkTrace ?? "",
      "kitchen-sink-telemetry-type": "server-action",
    };
  },
});
