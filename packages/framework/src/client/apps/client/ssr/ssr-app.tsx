import "../ext/react-refresh";
import { use, createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
// @ts-expect-error: Could not find a declaration file for module 'react-server-dom-webpack/client.edge'.
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { RoutingContext } from "../contexts/routing-context";
import { InlineRSCStream } from "../components/inline-rsc-stream";
import { RouteStackEntry, RouteStack } from "../contexts/route-stack-context";
import { ReactDOMServerReadableStream } from "react-dom/server";
import type { BrowserOptions } from "@sentry/react";
import { ProgressBarProvider } from "react-transition-progress";

export function SSRApp({
  url,
  getRouteStack,
  rscStreamReader,
  sentryTrace,
  sentryBaggage,
}: {
  url: URL;
  getRouteStack: () => Promise<RouteStackEntry[]>;
  rscStreamReader: ReadableStreamDefaultReader<Uint8Array>;
  sentryTrace: string | undefined;
  sentryBaggage: string | undefined;
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

  let routeStackPromise = getRouteStack();
  let routeStack = use(routeStackPromise);

  return (
    <>
      {sentryTrace ? <meta name="sentry-trace" content={sentryTrace} /> : null}
      {sentryBaggage ? <meta name="baggage" content={sentryBaggage} /> : null}

      <ProgressBarProvider>
        <RoutingContext
          version={1}
          path={url.pathname}
          mask={undefined}
          searchParams={url.searchParams}
          optimisticPath={url.pathname}
          optimisticSearchParams={url.searchParams}
          isTransitioning={false}
          navigate={navigate}
          replace={replace}
          refresh={refresh}
        >
          <RouteStack stack={routeStack} />
        </RoutingContext>

        <InlineRSCStream reader={rscStreamReader} />
      </ProgressBarProvider>
    </>
  );
}

type RenderOptions = {
  rscStream: ReadableStream<Uint8Array>;
  // ssrManifestModuleMap: Record<string, any>;
  urlString: string;
  bootstrapUrl: string;
  signal: AbortSignal;
  sentryBrowserOptions: BrowserOptions | undefined;
  captureException: (error: unknown) => boolean;
  sentryTrace: string | undefined;
  sentryBaggage: string | undefined;
};

function getBootstrapScript(
  sentryBrowserOptions: BrowserOptions | undefined,
  extraScript?: string,
) {
  let scripts = [];
  if (sentryBrowserOptions) {
    scripts.push(
      `window.SentryConfig = ${JSON.stringify(sentryBrowserOptions)}`,
    );
  }
  if (extraScript) {
    scripts.push(extraScript);
  }
  return scripts.join(";");
}

export async function render({
  rscStream,
  urlString,
  bootstrapUrl,
  signal,
  sentryBrowserOptions,
  captureException,
  sentryTrace,
  sentryBaggage,
}: RenderOptions): Promise<ReadableStream<Uint8Array>> {
  let [rscStream1, rscStream2] = rscStream.tee();
  let [formStateStream, routeStackStream] = rscStream1.tee(); // formState and route stack
  let [inlineRscStream, inlineRscErrorStream] = rscStream2.tee(); // ssr render and error free render

  // right now we cant hydrate a suspense above body tag, so if the rsc stream fails to
  // ssr we need to handle that error here (vs defering to the client). note to future
  // self: once you can suspend+hydrate above body i think this code can be cleaned up.

  let { formState } = await createFromReadableStream(formStateStream, {
    serverConsumerManifest: {
      moduleMap: null,
      serverModuleMap: null,
      moduleLoading: null,
    },
  });

  let routeStack: RouteStackEntry[];
  async function getRouteStack() {
    if (!routeStack) {
      let payload = await createFromReadableStream(routeStackStream, {
        serverConsumerManifest: {
          // client references
          moduleMap: null,
          // this is a map of server references, passing in a map lets you
          // change which module to load the references from
          serverModuleMap: null,
          moduleLoading: null,
          // moduleLoading: {
          //   prefix: "/__tf/assets/",
          // },
        },
      });

      routeStack = payload.stack;
    }

    return routeStack;
  }

  let inlineRscStreamReader = inlineRscStream.getReader();

  let url = new URL(urlString);

  let htmlStream: ReactDOMServerReadableStream;
  try {
    htmlStream = await renderToReadableStream(
      createElement(SSRApp, {
        url,
        rscStreamReader: inlineRscStreamReader,
        getRouteStack,
        sentryTrace,
        sentryBaggage,
      }),
      {
        bootstrapModules: [bootstrapUrl],
        bootstrapScriptContent: getBootstrapScript(sentryBrowserOptions),
        formState,
        onError(err: unknown) {
          if (signal.aborted) {
            // dont care about errors if we're aborted
          } else if (err instanceof Error && isSafeError(err)) {
            // certain errors we know are safe for client handling
          } else if (err instanceof Error) {
            // do something useful here
            if (!captureException(err)) {
              console.error(err);
            }
          } else if (err === null) {
            // think we can ignore this case, happens when stream
            // is cancelled on the react-server side
          } else {
            console.error(
              `An unknown error occurred while SSR rendering: ${url.pathname}`,
            );
          }
        },
        signal,
      },
    );

    // at this point we can cancel the error stream since we don't need it
    inlineRscErrorStream.cancel();
  } catch (e: unknown) {
    // the ssr stream crashed before it started streaming. we'll create a
    // new ssr stream that renders the client app with the rsc stream inline.
    // the rsc stream most likely has a serialized error and the client app
    // will handle that.
    captureException(e);
    try {
      htmlStream = await renderToReadableStream(
        createElement(InlineRSCStream, {
          reader: inlineRscErrorStream.getReader(),
        }),
        {
          bootstrapModules: [bootstrapUrl],
          bootstrapScriptContent: getBootstrapScript(
            sentryBrowserOptions,
            "window.SSRDidError = true;",
          ),
          onError(err: unknown) {
            captureException(err);
            if (signal.aborted) {
              // dont care about errors if we're aborted
            } else {
              console.error(
                `An unknown error occurred while SSR error rendering: ${url.pathname}`,
              );
            }
          },
          signal,
        },
      );
    } catch (e: unknown) {
      // at this point we just cant render. we've had two streams crash.
      // we'll throw and let the worker communicate an error back to
      // the main process.
      captureException(e);
      throw new Error("Unable to render", { cause: e });
    }
  }

  return htmlStream;
}

function isSafeError(err: Error & { digest?: string }) {
  return (
    err.digest === "TwofoldNotFoundError" ||
    err.digest === "TwofoldUnauthorizedError" ||
    err.digest?.startsWith("TwofoldRedirectError")
  );
}
