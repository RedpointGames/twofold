import type { Layout } from "../build/rsc/layout";
import type { RenderRequest } from "./entrypoint/request.server";
import type { Page } from "../build/rsc/page";
import type { ReplacementResponse } from "./replacement-response";
import type { ApplicationRuntime } from "./router";
import type { ErrorInfo } from "react";

export interface ServerErrorContextAuthExtendedInfo {
  relatedId: string;
  appPath: string | undefined;
  applicableAuthEntity: Page | Layout | undefined;
}

/**
 * Context provided when errors are caught on the server.
 */
export interface ServerErrorContext {
  applicationRuntime: ApplicationRuntime;
  url: URL;
  renderRequest: RenderRequest;
  error: unknown;
  willRecover: boolean;
  location:
    | "api-middleware"
    | "api"
    | "page-middleware"
    | "page"
    | "action-request"
    | "action-form"
    | "ssr"
    | "client-asset"
    | undefined;
  authExtendedInfo?: ServerErrorContextAuthExtendedInfo;
}

/**
 * Context for tracing events on the server.
 */
export interface ServerTracingContext {
  applicationRuntime: ApplicationRuntime;
  url: URL;
  request: Request;
}

/**
 * Context provided when errors are caught on the client.
 */
export type ClientErrorContext = {
  isSsr: boolean;
  url: URL;
  error: unknown;
} & (
  | {
      errorInfo: {
        componentStack?: string | undefined;
        errorBoundary?: React.Component<unknown> | undefined;
      };
      type: "caught";
    }
  | {
      errorInfo: { componentStack?: string | undefined };
      type: "uncaught";
    }
  | {
      errorInfo: ErrorInfo;
      type: "recoverable";
    }
);

/**
 * Context for tracing events on the client.
 */
export type ClientTracingContext = {
  isSsr: boolean;
  path: string;
  actionId?: string;
  actionBody?: BodyInit;
};

/**
 * Context for navigation events on the client.
 */
export type ClientNavigationContext = {
  path: string;
  type: "navigate" | "back" | "refresh";
};

/**
 * All telemetry hooks are optional. If not specified, the default behaviour will apply.
 */
type TelemetryHook<T> = T | undefined;

/**
 * Some telemetry hooks use 'undefined' to indicate that the response should not be replaced. Telemetry hooks can use defaultTelemetryBehaviour() to indicate that 'the default behaviour' should be used instead of 'do not replace the response'.
 */
type TelemetryDefaultable<T> = T | { defaultBehaviour: true };

/**
 * Indicates that the default behaviour should be used for this telemetry hook.
 *
 * @returns A value that indicates that default behaviour should be used.
 */
export function defaultTelemetryBehaviour(): { defaultBehaviour: true } {
  return { defaultBehaviour: true };
}

export function isDefaultTelemetryBehaviour(
  value: unknown,
): value is { defaultBehaviour: "true" } {
  return (
    value !== undefined &&
    value !== null &&
    typeof value === "object" &&
    "defaultBehaviour" in value &&
    typeof value.defaultBehaviour === "boolean" &&
    value.defaultBehaviour
  );
}

/**
 * Configuration of telemetry on the server.
 */
export interface ServerTelemetry {
  /**
   * Called when there is a catastrophic error in the HTTP pipeline that prevents us from handling an error in any other way.
   */
  onServerSideCatastrophicError?: TelemetryHook<
    (context: ServerErrorContext) => Promise<TelemetryDefaultable<void>>
  >;

  /**
   * Called when there is a non-recoverable error from an API route. This will cause a change in the response content.
   */
  onServerSideApiError?: TelemetryHook<
    (context: ServerErrorContext) => Promise<TelemetryDefaultable<Response>>
  >;

  /**
   * Called when there is a non-recoverable error on the server when running middleware for a page.
   */
  onServerSidePageMiddlewareError?: TelemetryHook<
    (
      context: ServerErrorContext,
    ) => Promise<TelemetryDefaultable<ReplacementResponse>>
  >;

  /**
   * Called when there is a recoverable error during page rendering on the server. This should return the digest to be associated with the error.
   *
   * You should almost always return defaultTelemetryBehaviour() if you implement this hook, as the digest is needed for client-side code to directly detect 'not found' and 'unauthorized' errors.
   */
  onServerSidePageRenderError?: TelemetryHook<
    (context: ServerErrorContext) => TelemetryDefaultable<string | undefined>
  >;

  /**
   * Called when an error is thrown by a server action. The error is only returned to the client and re-thrown by client JavaScript if this telemetry hook does not replace the response.
   */
  onServerSideActionError?: TelemetryHook<
    (
      context: ServerErrorContext,
    ) => Promise<TelemetryDefaultable<ReplacementResponse>>
  >;

  /**
   * Called when authentication policies run for a page and throw an unknown type of error. In this case access is denied and the result of this function is the response.
   *
   * If you do not return a replacement response here, the default behaviour will always run and replace the response. It is not possible to use this hook to continue execution when access is denied.
   */
  onServerSidePageAuthUnknownError?: TelemetryHook<
    (
      context: ServerErrorContext,
    ) => Promise<TelemetryDefaultable<ReplacementResponse>>
  >;

  /**
   * Called when authentication policies run for an API route and throw an unknown type of error. In this case access is denied and the result of this function is the response.
   *
   * If you do not return a replacement response here, the default behaviour will always run and replace the response. It is not possible to use this hook to continue execution when access is denied.
   */
  onServerSideApiAuthUnknownError?: TelemetryHook<
    (context: ServerErrorContext) => Promise<TelemetryDefaultable<Response>>
  >;

  /**
   * Called when authentication policies run for a client asset and deny access to the resource, optionally with an error. In this case access is denied and the result of this function is the response.
   *
   * If you do not return a replacement response here, the default behaviour will always run and replace the response. It is not possible to use this hook to continue execution when access is denied.
   */
  onServerSideDeniedAccessToClientAsset?: TelemetryHook<
    (context: ServerErrorContext) => Promise<TelemetryDefaultable<Response>>
  >;

  /**
   * Called to get the additional <meta> headers that should be sent to the browser, so browser telemetry can be associated with the original request in distributed tracing.
   */
  getTraceMetaHeadersForBrowser?: TelemetryHook<
    (
      context: ServerTracingContext,
    ) => Promise<{ [name: string]: string } | undefined>
  >;

  /**
   * Called on the server right before error handling is registered in the request pipeline. If you are using distributed tracing, you can use this to run the request inside the context of the current trace.
   */
  continueTraceForRequest?: TelemetryHook<
    (request: Request, next: () => Promise<Response>) => Promise<Response>
  >;
}

/**
 * Configuration of telemetry on the client (browser and SSR).
 */
export interface ClientTelemetry {
  /**
   * Called when there is a recoverable error while rendering on the client or SSR.
   */
  onClientSideRenderError?: TelemetryHook<
    (context: ClientErrorContext) => TelemetryDefaultable<void>
  >;

  /**
   * Called when the client-side router handles navigation and navigates to a new page, goes back or refreshes the current page.
   */
  onClientSideNavigationBegin?: TelemetryHook<
    (context: ClientNavigationContext) => Promise<void>
  >;

  /**
   * Called to get the additional HTTP headers that should be sent when making requests to the server, so that server actions can be associated with the original request in distributed tracing.
   */
  getTraceHttpHeadersForServerAction?: TelemetryHook<
    (
      context: ClientTracingContext,
    ) => Promise<{ [name: string]: string } | undefined>
  >;

  /**
   * Called to get the additional HTTP headers that should be sent when making RSC page requests to the server, so that subsequent navigations can be associated with the original request in distributed tracing.
   */
  getTraceHttpHeadersForRscPageLoad?: TelemetryHook<
    (
      context: ClientTracingContext,
    ) => Promise<{ [name: string]: string } | undefined>
  >;
}

type RequireResult<T> = T extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<Exclude<R, { defaultBehaviour: true }>>
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Exclude<R, { defaultBehaviour: true }>
    : never;
export type RequireAllTelemetryHooks<T> = {
  [K in keyof T]-?: Exclude<RequireResult<T[K]>, undefined>;
};

export function defineServerTelemetry(hooks: ServerTelemetry): ServerTelemetry {
  return hooks;
}

export function defineClientTelemetry(hooks: ClientTelemetry): ClientTelemetry {
  return hooks;
}

export function defineServerTelemetry_requireAllHooks(
  hooks: RequireAllTelemetryHooks<ServerTelemetry>,
): RequireAllTelemetryHooks<ServerTelemetry> {
  return hooks;
}

export function defineClientTelemetry_requireAllHooks(
  hooks: RequireAllTelemetryHooks<ClientTelemetry>,
): RequireAllTelemetryHooks<ClientTelemetry> {
  return hooks;
}
