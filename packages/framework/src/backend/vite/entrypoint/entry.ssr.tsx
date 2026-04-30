import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React, { Suspense } from "react";
import type { ErrorInfo, ReactFormState } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server.edge";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "./payload.js";
import { RouteStack } from "../../../client/apps/client/contexts/route-stack-context.js";
import { RoutingContext } from "../../../client/apps/client/contexts/routing-context.js";
import { ProgressBarProvider } from "react-transition-progress";
import { clientTelemetry } from "../telemetry.client.js";

function MetaHeaders(props: {
  telemetryTraceMetaHeaders: { [name: string]: string };
}) {
  let metaHeaders = [];
  for (const name of Object.getOwnPropertyNames(
    props.telemetryTraceMetaHeaders,
  )) {
    metaHeaders.push(
      <meta
        key={name}
        name={name}
        content={props.telemetryTraceMetaHeaders[name]}
      />,
    );
  }
  return metaHeaders;
}

function PageRequiresJavaScript() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 900,
            letterSpacing: "-0.025em",
          }}
        >
          JavaScript required
        </h1>
        <p style={{ marginTop: "12px" }}>
          This page requires JavaScript to be enabled in your web browser.
        </p>
      </div>
    </div>
  );
}

function SsrApp(props: {
  url: URL;
  payload: Promise<RscPayload>;
  telemetryTraceMetaHeaders: { [name: string]: string };
}) {
  let navigate = () => {
    throw new Error("Cannot call navigate during SSR");
  };

  let replace = () => {
    throw new Error("Cannot call replace during SSR");
  };

  let refresh = () => {
    throw new Error("Cannot call refresh during SSR");
  };

  let routeStack = React.use(props.payload).stack;

  return (
    <>
      <MetaHeaders
        telemetryTraceMetaHeaders={props.telemetryTraceMetaHeaders}
      />
      <ProgressBarProvider>
        <RoutingContext
          version={1}
          path={props.url.pathname}
          mask={undefined}
          searchParams={props.url.searchParams}
          optimisticPath={props.url.pathname}
          optimisticSearchParams={props.url.searchParams}
          isTransitioning={false}
          navigate={navigate}
          replace={replace}
          refresh={refresh}
        >
          <RouteStack stack={routeStack} />
        </RoutingContext>
      </ProgressBarProvider>
    </>
  );
}

export async function renderHtml(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    url: URL;
    formState?: ReactFormState;
    nonce?: string;
    debugNojs?: boolean;
    telemetryTraceMetaHeaders: { [name: string]: string };
  },
): Promise<ReadableStream<Uint8Array>> {
  const [rscStreamForSsr, rscStreamForBrowserFlightData] = rscStream.tee();

  let payload: Promise<RscPayload> | undefined = undefined;
  function SsrRoot() {
    payload ??= createFromReadableStream(rscStreamForSsr);
    return (
      <Suspense
        fallback={
          <html>
            <MetaHeaders
              telemetryTraceMetaHeaders={options.telemetryTraceMetaHeaders}
            />
            <body>
              {!options.debugNojs ? (
                <noscript>
                  <PageRequiresJavaScript />
                </noscript>
              ) : (
                <PageRequiresJavaScript />
              )}
            </body>
          </html>
        }
      >
        <SsrApp
          url={options.url}
          payload={payload}
          telemetryTraceMetaHeaders={options.telemetryTraceMetaHeaders}
        />
      </Suspense>
    );
  }

  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent("index");
  let responseStream: ReadableStream<Uint8Array> = await renderToReadableStream(
    <SsrRoot />,
    {
      bootstrapScriptContent: options?.debugNojs
        ? undefined
        : bootstrapScriptContent,
      nonce: options?.nonce,
      formState: options?.formState,
      onError: (error: unknown, errorInfo: ErrorInfo) => {
        clientTelemetry.onClientSideRenderError({
          isSsr: true,
          url: options.url,
          error,
          errorInfo,
          type: "recoverable",
        });

        // We must return digest here so that the error thrown by renderToReadableStream will have the digest value necessary for the router to correctly detect special errors.
        if (
          typeof error === "object" &&
          error !== null &&
          "digest" in error &&
          typeof error.digest === "string"
        ) {
          return error.digest;
        } else {
          return undefined;
        }
      },
    },
  );

  if (!options?.debugNojs) {
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(rscStreamForBrowserFlightData, {
        nonce: options?.nonce,
      }),
    );
  }

  return responseStream;
}
