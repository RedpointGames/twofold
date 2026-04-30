import {
  defaultTelemetryBehaviour,
  defineClientTelemetry,
} from "@twofold/framework/telemetry";

export default defineClientTelemetry({
  onClientSideRenderError(context) {
    console.log("kitchen sink custom onClientSideRenderError");
    return defaultTelemetryBehaviour();
  },
  async getTraceHttpHeadersForRscPageLoad(context) {
    if (context.isSsr) {
      return {};
    }

    const kitchenSinkTrace = document.querySelector<HTMLMetaElement>(
      "meta[name=kitchen-sink-trace]",
    )?.content;

    return {
      "kitchen-sink-telemetry-id": kitchenSinkTrace ?? "",
      "kitchen-sink-telemetry-type": "rsc-page-load",
    };
  },
  async getTraceHttpHeadersForServerAction(context) {
    if (context.isSsr) {
      return {};
    }

    const kitchenSinkTrace = document.querySelector<HTMLMetaElement>(
      "meta[name=kitchen-sink-trace]",
    )?.content;

    return {
      "kitchen-sink-telemetry-id": kitchenSinkTrace ?? "",
      "kitchen-sink-telemetry-type": "server-action",
    };
  },
});
