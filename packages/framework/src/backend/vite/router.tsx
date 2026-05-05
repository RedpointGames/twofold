import "server-only";
import { type ComponentType, createElement, type ReactElement } from "react";
import { Layout } from "../build/rsc/layout.js";
import { partition } from "../utils/partition.js";
import { Page } from "../build/rsc/page.js";
import { API } from "../build/rsc/api.js";
import { applyPathParams, pathMatches } from "../runtime/helpers/routing.js";
import type { RscPayload } from "./entrypoint/payload.js";
import {
  renderToReadableStream,
  createTemporaryReferenceSet,
  decodeReply,
  loadServerAction,
  decodeAction,
  decodeFormState,
} from "@vitejs/plugin-rsc/rsc";
import xxhash from "xxhash-wasm";
import type { RouteStackEntry } from "../../client/apps/client/contexts/route-stack-context.js";
import { getStore, runStore, type Store } from "../stores/rsc-store.js";
import type { SerializeOptions } from "cookie";
import { createRouter, Router, RouterContext } from "@hattip/router";
import { cookie } from "@hattip/cookie";
import { decrypt, encrypt } from "../encryption.js";
import { randomBytes } from "node:crypto";
import type { AdapterRequestContext, HattipHandler } from "@hattip/core";
import { ErrorTemplate } from "../build/rsc/error-template.js";
import { CatchBoundary } from "../build/rsc/catch-boundary.js";
import { Generic } from "../build/rsc/generic.js";
import { Wrapper } from "../build/rsc/wrapper.js";
import { invariant } from "../utils/invariant.js";
import { parseHeaderValue } from "@hattip/headers";
import {
  contentType,
  headerAccept,
  headerContentType,
  headerLocation,
  isContentType,
} from "./content-types.js";
import catastrophicErrorHtml from "./catastrophic-internal-error.html?raw";
import type { NodePlatformInfo } from "@hattip/adapter-node/native-fetch";
import globalMiddleware from "virtual:twofold/server-global-middleware";
import { tfPaths } from "./special-pages.js";
import type { ReplacementResponse } from "./replacement-response.js";
import {
  type ModuleMap,
  type ActionResultData,
  MiddlewareMode,
  type ModuleSurface,
  ModuleSurfaceExportRewrite,
} from "./router-types.js";
import {
  lookupClientAssetMetadata,
  lookupServerActionMetadata,
} from "./router-lookup.js";
import {
  getPathForRouterFromRscUrl,
  getPathForRscRequest,
} from "./entrypoint/request.js";
import {
  parseRenderRequest,
  RenderRequest,
  RenderRequestActionType,
} from "./entrypoint/request.server.js";
import {
  evaluatePolicyArray,
  evaluatePolicyArrayToResponse,
} from "../runtime/helpers/auth.js";
import { UnauthorizedError } from "../../client/errors/unauthorized-error.js";
import { ProxyingRequest } from "../proxying-request.js";
import { serverTelemetry } from "./telemetry.server.js";
import { ServerErrorContextAuthExtendedInfo } from "./telemetry.js";
import kleur from "kleur";
import {
  APIProps,
  MetadataProps,
  PageProps,
  RewriteProps,
} from "../../types/importable.js";
import merge from "deepmerge";
import { isPlainObject } from "is-plain-object";
import { Rewrite } from "../build/rsc/rewrite.js";

let { h64Raw } = await xxhash();

function componentsToTree<T extends object>(
  list: {
    component: ComponentType<T>;
    props: T;
  }[],
): ReactElement {
  invariant(list[0], "Invalid component list");

  let { component, props } = list[0];
  if (list.length === 1) {
    return createElement<T>(component, props);
  } else {
    return createElement<T>(component, props, componentsToTree(list.slice(1)));
  }
}

const protectedAssetPathRegex =
  /^\/assets\/(p-[0-9a-f]{16})-[a-zA-Z0-9_-]{8}\.js$/;

export class ApplicationRuntime {
  #root: Layout;
  #apiEndpoints: API[];
  #rewrites: Rewrite[];
  #reqId: number;
  #handler: HattipHandler<unknown>;

  constructor(modules: ModuleMap) {
    this.#root = ApplicationRuntime.loadRoot(modules);
    this.#apiEndpoints = this.#root.tree.findAllOfType(API);
    this.#rewrites = this.#root.tree.findAllOfType(Rewrite);
    this.#reqId = 0;
    this.#handler = this.createHandler();
  }

  registerMiddlewareToRouter<T>(app: Router<T>) {
    // path normalization
    app.use(async (ctx) => {
      let url = new URL(ctx.request.url);
      if (url.pathname.endsWith("/") && url.pathname !== "/") {
        return new Response(null, {
          status: 307,
          headers: {
            [headerLocation]: url.pathname.slice(0, -1),
          },
        });
      }
    });

    // silence not found for external requests
    app.get("/**/*.js.map", async () => {
      return new Response(null, { status: 404 });
    });
    app.get("/.well-known/appspecific/com.chrome.devtools.json", async () => {
      return new Response(null, { status: 204 });
    });

    // cookies
    app.use(cookie());

    // continue trace
    app.use(async (ctx) => {
      return await serverTelemetry.continueTraceForRequest(ctx.request, () =>
        ctx.next(),
      );
    });

    // fallback error handling - only hit when something catastrophic happens
    app.use(async (ctx) => {
      ctx.handleError = async (e: unknown) => {
        let request = ctx.request;
        let accepts = parseHeaderValue(request.headers.get(headerAccept));
        let error = e instanceof Error ? e : new Error("Internal server error");

        await serverTelemetry.onServerSideCatastrophicError({
          applicationRuntime: this,
          url: new URL(request.url),
          renderRequest: await parseRenderRequest(request),
          error,
          willRecover: false,
          location: undefined,
        });

        let status = 500;
        if ("digest" in error && typeof error.digest === "string") {
          if (error.digest === "TwofoldNotFoundError") {
            status = 404;
          } else if (error.digest === "TwofoldUnauthorizedError") {
            status = 403;
          }
        }

        if (isContentType.rsc(accepts)) {
          // maybe let the runtime own this?
          let stream = renderToReadableStream<RscPayload>(
            {
              stack: [
                {
                  type: "error",
                  error: error,
                },
              ],
              path: getPathForRouterFromRscUrl(new URL(ctx.request.url)),
              action: undefined,
              formState: undefined,
            },
            {},
          );
          return new Response(stream, {
            status,
            headers: {
              [headerContentType]: contentType.rsc,
            },
          });
        } else if (isContentType.html(accepts)) {
          let html = catastrophicErrorHtml;
          return new Response(html, {
            status,
            headers: {
              [headerContentType]: contentType.html,
            },
          });
        } else {
          let text = `${error.message}\n\n${error.stack}`;
          return new Response(text, {
            status,
            headers: {
              [headerContentType]: contentType.plain,
            },
          });
        }
      };
    });

    // set up request store
    app.use(async (ctx) => {
      this.#reqId = this.#reqId + 1;

      let defaultCookieOptions: SerializeOptions = {
        path: "/",
      };

      let store: Store = {
        reqId: this.#reqId,
        build:
          process.env.NODE_ENV === "production" ? "production" : "development",
        canReload: process.env.NODE_ENV === "development",
        cookies: {
          all: () => {
            return ctx.cookie;
          },
          set: (name, value, options) => {
            let cookieOptions = {
              ...defaultCookieOptions,
              ...options,
            };

            ctx.setCookie(name, value, cookieOptions);
          },
          get: (name) => {
            return ctx.cookie[name];
          },
          destroy: (name, options) => {
            let cookieOptions = {
              ...defaultCookieOptions,
              ...options,
            };

            ctx.deleteCookie(name, cookieOptions);
          },
          outgoingCookies: () => ctx.outgoingCookies,
        },
        encryption: {
          encrypt: (value) => {
            let key = process.env.TWOFOLD_SECRET_KEY;
            if (typeof key !== "string") {
              throw new Error("TWOFOLD_SECRET_KEY is not set");
            }

            return encrypt(value, key);
          },
          decrypt: (value) => {
            let key = process.env.TWOFOLD_SECRET_KEY;
            if (typeof key !== "string") {
              throw new Error("TWOFOLD_SECRET_KEY is not set");
            }

            return decrypt(value, key);
          },
        },
        flash: {
          add(message) {
            let flashId = randomBytes(12).toString("hex");
            let data = JSON.stringify(message);
            ctx.setCookie(`_tf_flash_${flashId}`, data, {
              path: "/",
              secure: false,
              maxAge: 60 * 60 * 24,
            });
          },
        },
        request: ctx.request,
        context: null,
        assets: [],
        authCache: new Map<string, unknown>(),
        errorHandlingDepth: 0,
      };

      return runStore(store, () => ctx.next());
    });

    // if this is production, register the authentication guard for static assets
    if (process.env.NODE_ENV === "production") {
      app.use(async (ctx) => {
        const url = new URL(ctx.request.url);
        if (url.pathname.toLowerCase().startsWith("/assets/p-")) {
          const match = protectedAssetPathRegex.exec(url.pathname);
          if (!match || match[1] === undefined) {
            return new Response("access denied to protected asset (code 0x1)", {
              status: 403,
            });
          } else {
            return await this.runAuthForStaticAssetFromContext(ctx, match[1]);
          }
        }
      });
    }
  }

  private createHandler(): HattipHandler<unknown> {
    const app = createRouter();

    // When we're running in production, the server entrypoint
    // creates an outer router since it needs to also serve
    // static files. It will call registerMiddlewareToRouter in
    // that case.
    if (process.env.NODE_ENV !== "production") {
      this.registerMiddlewareToRouter(app);
    }

    // global middleware
    // @note: This used to be before errors and request store setup, but we want to be able to capture errors from global middleware.
    app.use(async (ctx) => {
      if (globalMiddleware) {
        return await globalMiddleware(ctx.request);
      }
    });

    // handle all requests here
    app.use(async (ctx) => {
      const renderRequest = await parseRenderRequest(ctx.request);
      const request = new ProxyingRequest(renderRequest.request);
      const url = new URL(request.url);

      // Perform rewrites.
      await this.runRewrites(renderRequest);

      // Attempt to discover a matching API request.
      if (!renderRequest.isRsc) {
        const api = this.findApi(renderRequest);
        if (api) {
          // We have an API request, but the URL might be overloaded with
          // a page request, and we need to determine whether the API should
          // actually run on this request.
          const potentialMatchingPage = this.#root.tree.findPageForPath(
            url.pathname,
          );

          const pageExists = potentialMatchingPage !== undefined;
          const accepts = parseHeaderValue(request.headers.get("accept"));
          const acceptsHTML = isContentType.html(accepts);
          const pageIsDynamic =
            potentialMatchingPage?.isDynamic ||
            potentialMatchingPage?.isCatchAll;
          const apiIsDynamic = api.isDynamic || api.isCatchAll;
          const apiTakesPrecedence = !apiIsDynamic && pageIsDynamic;

          const skipApi = pageExists && acceptsHTML && !apiTakesPrecedence;
          if (!skipApi) {
            // There is either no page, or the page does not take precedence
            // over the API, so run the API for this request.
            const apiResponse = await this.runApi(renderRequest, api);
            if (apiResponse) {
              return apiResponse;
            }
          }
        }
      }

      // Handle actions.
      let actionResult: ActionResultData | undefined = undefined;
      if (renderRequest.isAction) {
        actionResult = await this.runAction(
          request,
          renderRequest.actionId,
          renderRequest.actionType,
        );
      }

      // If the action result throws an error, and the error is a safe error, handle it here.
      let rscStreamOrResponse: ReplacementResponse = undefined;
      if (actionResult?.returnValue?.type === "throw") {
        rscStreamOrResponse = await serverTelemetry.onServerSideActionError({
          applicationRuntime: this,
          url: new URL(request.url),
          renderRequest: renderRequest,
          error: actionResult.returnValue.error,
          willRecover: false,
          location: "action-request",
        });
      }

      // Return response from action result if it's present and
      // we don't have an RSC stream or response already set via
      // error handling.
      if (actionResult?.response && !rscStreamOrResponse) {
        return actionResult.response;
      }

      // This is now a page request; set context appropriately.
      let store = getStore();
      if (store) {
        store.context = {
          type: "page",
          request: request,
          assets: [],
        };
      }

      // Handle page request if the action hasn't already given us
      // a response stream.
      if (!rscStreamOrResponse) {
        rscStreamOrResponse = await this.runPage(renderRequest, actionResult);
      }

      // If we have a direct response from the page (for a redirect),
      // return that immediately.
      if (rscStreamOrResponse instanceof Response) {
        return rscStreamOrResponse;
      }

      // Return stream directly if RSC stream requested.
      if (renderRequest.isRsc) {
        return new Response(rscStreamOrResponse?.stream, {
          status: actionResult?.actionStatus ?? rscStreamOrResponse?.status,
          headers: {
            [headerContentType]: contentType.rsc,
          },
        });
      }

      invariant(
        rscStreamOrResponse !== undefined,
        "must have a response or RSC stream by this point",
      );

      // Get the additional meta headers for distributed tracing.
      const telemetryTraceMetaHeaders =
        (await serverTelemetry.getTraceMetaHeadersForBrowser({
          applicationRuntime: this,
          url,
          request,
        })) ?? {};

      // Use SSR module to render RSC stream to HTML.
      const ssrEntryModule = await import.meta.viteRsc.loadModule<
        typeof import("./entrypoint/entry.ssr.js")
      >("ssr", "index");
      let ssrStream = await ssrEntryModule.renderHtml(
        rscStreamOrResponse.stream,
        {
          url: url,
          formState: actionResult?.formState,
          debugNojs: url.searchParams.has("__nojs"),
          telemetryTraceMetaHeaders,
        },
      );
      return new Response(ssrStream, {
        status: rscStreamOrResponse?.status,
        headers: {
          [headerContentType]: contentType.html,
        },
      });
    });

    // set handler
    return app.buildHandler();
  }

  async fetchFromContext(
    context: AdapterRequestContext<NodePlatformInfo>,
  ): Promise<Response> {
    return await this.#handler(context);
  }

  async fetch(request: Request): Promise<Response> {
    const context: AdapterRequestContext<unknown> = {
      request,
      ip: "",
      platform: null,
      env: (variable) => {
        return process.env[variable];
      },
      passThrough: () => {},
      waitUntil: () => {},
    };
    return await this.#handler(context);
  }

  private async runAuthForStaticAssetFromContext(
    ctx: RouterContext<unknown, unknown>,
    protectedIdPrefixOnly: string,
  ): Promise<Response | undefined> {
    const unauthorizedAsset = async (
      authExtendedInfo: ServerErrorContextAuthExtendedInfo,
      error?: Error,
    ): Promise<Response> => {
      return serverTelemetry.onServerSideDeniedAccessToClientAsset({
        applicationRuntime: this,
        url: new URL(ctx.request.url),
        renderRequest: await parseRenderRequest(ctx.request),
        error: error ?? new UnauthorizedError(),
        willRecover: false,
        location: "client-asset",
        authExtendedInfo,
      });
    };

    const clientAssetMetadata = await lookupClientAssetMetadata(
      protectedIdPrefixOnly,
    );
    if (clientAssetMetadata === undefined) {
      return await unauthorizedAsset({
        relatedId: protectedIdPrefixOnly,
        appPath: undefined,
        applicableAuthEntity: undefined,
      });
    }
    const applicableAuthEntity =
      this.#root.tree.findNearestParentAuthForPathlessPath(
        clientAssetMetadata.appPath,
      );
    if (applicableAuthEntity === undefined) {
      return await unauthorizedAsset({
        relatedId: protectedIdPrefixOnly,
        appPath: clientAssetMetadata.appPath,
        applicableAuthEntity: undefined,
      });
    }

    const request = new ProxyingRequest(ctx.request);
    const authResponse = await evaluatePolicyArray(applicableAuthEntity, {
      type: "client-asset",
      request,
      authCache: new Map<string, unknown>(),
    });
    if (!authResponse.__allow) {
      if (authResponse.__error) {
        return await unauthorizedAsset(
          {
            relatedId: protectedIdPrefixOnly,
            appPath: clientAssetMetadata.appPath,
            applicableAuthEntity: applicableAuthEntity,
          },
          authResponse.__error,
        );
      } else {
        return await unauthorizedAsset({
          relatedId: protectedIdPrefixOnly,
          appPath: clientAssetMetadata.appPath,
          applicableAuthEntity: applicableAuthEntity,
        });
      }
    }

    console.log(
      `${kleur["green"](`[Allowed]`)} [Client Asset] %s -> Governed by app path '%s', access permitted by '%s'`,
      request.url,
      clientAssetMetadata.appPath,
      `${applicableAuthEntity instanceof Page ? "page" : "layout"}: ${applicableAuthEntity?.path}`,
    );
    return undefined;
  }

  private async getMetadata(
    node: {
      getMetadata: (
        props: MetadataProps<string, string | undefined>,
      ) => Promise<object>;
      layouts: Layout[];
    },
    props: MetadataProps<string, string | undefined>,
  ) {
    const metadatas = await Promise.all([
      ...node.layouts.map((layout) => layout.getMetadata(props)),
      node.getMetadata(props),
    ]);
    let metadata = {};
    for (const incomingMetadata of metadatas) {
      metadata = merge(metadata, incomingMetadata ?? {}, {
        arrayMerge(target, source, _options) {
          if (
            source.length >= 1 &&
            typeof source[0] === "object" &&
            "__arrayMergeMode" in source[0] &&
            typeof source[0].__arrayMergeMode === "string" &&
            source[0].__arrayMergeMode === "replace"
          ) {
            // allow complete replacement by having the first element in the array be { __arrayMergeMode: "replace" }
            return source.slice(1);
          } else {
            // source first, because source will be higher-level layouts
            return [...source, ...target];
          }
        },
        isMergeableObject(value) {
          return isPlainObject(value) || value instanceof Array;
        },
      });
    }
    return metadata;
  }

  private findRewrite(url: URL): Rewrite | undefined {
    const realPath = url.pathname;

    const [staticAndDynamicRewrites, catchAllRewrites] = partition(
      this.#rewrites,
      (api) => !api.isCatchAll,
    );
    const [dynamicApis, staticApis] = partition(
      staticAndDynamicRewrites,
      (api) => api.isDynamic,
    );

    const dynamicApisInOrder = dynamicApis.toSorted(
      (a, b) => a.dynamicSegments.length - b.dynamicSegments.length,
    );

    const rewrite =
      staticApis.find((rewrite) => pathMatches(rewrite.path, realPath)) ??
      dynamicApisInOrder.find((rewrite) =>
        pathMatches(rewrite.path, realPath),
      ) ??
      catchAllRewrites.find((rewrite) => pathMatches(rewrite.path, realPath));

    return rewrite;
  }

  private readParamsIntoRenderRequest(
    renderRequest: RenderRequest,
    pattern: URLPattern,
  ) {
    const execPattern = pattern.exec(renderRequest.url);
    const params = execPattern?.pathname.groups ?? {};
    renderRequest.params = merge(renderRequest.params, params);
  }

  private async runRewrites(renderRequest: RenderRequest): Promise<void> {
    let rewrite = this.findRewrite(renderRequest.url);
    let rewriteCount = 0;
    while (rewrite && rewriteCount < 20) {
      rewriteCount++;

      this.readParamsIntoRenderRequest(renderRequest, rewrite.pattern);
      const props: RewriteProps = {
        params: renderRequest.params,
        searchParams: renderRequest.url.searchParams,
        url: renderRequest.url,
        request: renderRequest.request,
        rewrittenTo: {
          searchParams: renderRequest.url.searchParams,
          url: renderRequest.url,
        },
        original: {
          searchParams: renderRequest.originalUrl.searchParams,
          url: renderRequest.originalUrl,
        },
      };

      const newPath = await rewrite.rewrite(props);
      if (newPath === undefined) {
        // rewrite declined
        break;
      }

      console.log(
        `${kleur["cyan"](`[Rewrite]`)} %s -> %s`,
        renderRequest.url,
        new URL(newPath, renderRequest.url),
      );
      renderRequest.url = new URL(newPath, renderRequest.url);

      // get next rewrite
      rewrite = this.findRewrite(renderRequest.url);
    }
  }

  private findApi(renderRequest: RenderRequest): API | undefined {
    const url = renderRequest.url;
    const realPath = url.pathname;

    const [staticAndDynamicApis, catchAllApis] = partition(
      this.#apiEndpoints,
      (api) => !api.isCatchAll,
    );
    const [dynamicApis, staticApis] = partition(
      staticAndDynamicApis,
      (api) => api.isDynamic,
    );

    const dynamicApisInOrder = dynamicApis.toSorted(
      (a, b) => a.dynamicSegments.length - b.dynamicSegments.length,
    );

    const api =
      staticApis.find((api) => pathMatches(api.path, realPath)) ??
      dynamicApisInOrder.find((api) => pathMatches(api.path, realPath)) ??
      catchAllApis.find((api) => pathMatches(api.path, realPath));

    return api;
  }

  private async runApi(
    renderRequest: RenderRequest,
    api: API,
  ): Promise<Response | undefined> {
    const module = await api.loadModule();
    this.readParamsIntoRenderRequest(renderRequest, api.pattern);

    const authResponse = await evaluatePolicyArrayToResponse<Response>(
      api,
      {
        type: "api",
        request: renderRequest.request,
        routeParams: renderRequest.params,
        authCache: getStore().authCache,
      },
      async (error) => {
        const authFailedResponse =
          await serverTelemetry.onServerSideApiAuthUnknownError({
            applicationRuntime: this,
            url: renderRequest.originalUrl,
            renderRequest: renderRequest,
            error,
            willRecover: false,
            location: "api",
          });
        return (
          authFailedResponse ??
          new Response("Access denied due to an internal error", {
            status: 403,
          })
        );
      },
      async (message) =>
        new Response(message ?? "Unauthorized", { status: 401 }),
    );
    if (authResponse) {
      return authResponse;
    }

    const props: APIProps<never, object> = {
      params: renderRequest.params,
      searchParams: renderRequest.originalUrl.searchParams,
      url: renderRequest.originalUrl,
      request: renderRequest.request,
      metadata: {},
      rewrittenTo: {
        searchParams: renderRequest.url.searchParams,
        url: renderRequest.url,
      },
      original: {
        searchParams: renderRequest.originalUrl.searchParams,
        url: renderRequest.originalUrl,
      },
    };
    props.metadata = await this.getMetadata(api, props);

    try {
      const layouts = api.layouts;
      const promises = [
        (async (props) => {
          if (module.before) {
            await module.before(props);
          }
        })(),
        ...layouts.map((layout) => layout.runMiddleware(props)),
      ];
      await Promise.all(promises);
    } catch (error: unknown) {
      return await serverTelemetry.onServerSideApiError({
        applicationRuntime: this,
        url: renderRequest.originalUrl,
        renderRequest: renderRequest,
        error: error,
        willRecover: false,
        location: "api",
      });
    }

    const method = renderRequest.request.method.toUpperCase();
    let response: Response;

    if (
      Object.hasOwn(module, method) &&
      method in module &&
      typeof module[method] === "function"
    ) {
      try {
        response = await module[method](props);
      } catch (error: unknown) {
        response = await serverTelemetry.onServerSideApiError({
          applicationRuntime: this,
          url: renderRequest.originalUrl,
          renderRequest: renderRequest,
          error,
          willRecover: false,
          location: "api-middleware",
        });
      }
    } else {
      response = new Response("Method not exported", { status: 404 });
    }

    return response;
  }

  private async runAction(
    request: Request,
    actionId: string,
    actionType: RenderRequestActionType,
  ): Promise<ActionResultData> {
    const unauthorizedAction = (error?: Error): ActionResultData => {
      const errorToReturn = error ?? new UnauthorizedError();
      return {
        returnValue:
          actionType === RenderRequestActionType.Request
            ? {
                type: "throw",
                error: errorToReturn,
              }
            : undefined,
        actionStatus: undefined,
        formState: undefined,
        temporaryReferences: undefined,
        response:
          actionType === RenderRequestActionType.FormState
            ? new Response(
                "You do not have permission to perform this action",
                {
                  status: 403,
                },
              )
            : undefined,
        error: error,
      };
    };

    const serverActionMetadata = await lookupServerActionMetadata(actionId);
    if (serverActionMetadata === undefined) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Server action '${actionId}' is not located underneath '/app/pages', which is required for authentication on server actions to be enforced. Move your server action to a file underneath '/app/pages'.`,
        );
      }
      return unauthorizedAction();
    }
    const applicableAuthEntity =
      this.#root.tree.findNearestParentAuthForPathlessPath(
        serverActionMetadata.appPath,
      );
    if (applicableAuthEntity === undefined) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Unable to find page or layout to associate with server action '${actionId}' even though it is located underneath '/app/pages'. This is a bug - it is expected that the root layout will be returned if nothing else.`,
        );
      }
      return unauthorizedAction();
    }
    const serverActionAuth = (await serverActionMetadata.loadModule()).auth;

    const authResponse = await evaluatePolicyArray(
      applicableAuthEntity,
      {
        type: "action",
        request: request,
        authCache: getStore().authCache,
      },
      serverActionAuth,
    );
    if (!authResponse.__allow) {
      if (authResponse.__error) {
        return unauthorizedAction(authResponse.__error);
      } else {
        return unauthorizedAction();
      }
    }

    if (actionType === RenderRequestActionType.Request) {
      return await this.noAuthChecks_runActionViaRequest(request, actionId);
    } else {
      return await this.noAuthChecks_runActionViaFormState(request);
    }
  }

  private async noAuthChecks_runActionViaRequest(
    request: Request,
    actionId: string,
  ): Promise<ActionResultData> {
    const contentType = request.headers.get("content-type");
    const body = contentType?.startsWith("multipart/form-data")
      ? await request.formData()
      : await request.text();
    const temporaryReferences = createTemporaryReferenceSet();
    const args = await decodeReply(body, { temporaryReferences });
    const action = await loadServerAction(actionId);
    try {
      const data = await action(...args);
      return {
        returnValue: {
          type: "return",
          result: data,
        },
        actionStatus: undefined,
        formState: undefined,
        temporaryReferences,
        response: undefined,
        error: undefined,
      };
    } catch (e) {
      return {
        returnValue: {
          type: "throw",
          error:
            e instanceof Error
              ? e
              : new Error(e?.toString() ?? "unknown error"),
        },
        actionStatus: 500,
        formState: undefined,
        temporaryReferences,
        response: undefined,
        error: e,
      };
    }
  }

  private async noAuthChecks_runActionViaFormState(
    request: Request,
  ): Promise<ActionResultData> {
    const formData = await request.formData();
    const decodedAction = await decodeAction(formData);
    try {
      const result = await decodedAction();
      return {
        returnValue: undefined,
        actionStatus: undefined,
        formState: await decodeFormState(result, formData),
        temporaryReferences: undefined,
        response: undefined,
        error: undefined,
      };
    } catch (e) {
      return {
        returnValue: undefined,
        actionStatus: undefined,
        formState: undefined,
        temporaryReferences: undefined,
        response: new Response("Internal Server Error: server action failed", {
          status: 500,
        }),
        error: e,
      };
    }
  }

  private static hash(str: string) {
    let encoder = new TextEncoder();
    let data = encoder.encode(str);
    let hash = h64Raw(data);
    return hash.toString(16);
  }

  private async runPage(
    renderRequest: RenderRequest,
    actionResult: ActionResultData | undefined,
  ): Promise<ReplacementResponse> {
    let page = this.#root.tree.findPageForPath(renderRequest.url.pathname);
    if (!page) {
      return this.noAuthChecks_runSpecialPage(
        renderRequest,
        tfPaths.throwing.notFound,
      );
    }

    this.readParamsIntoRenderRequest(renderRequest, page.pattern);
    const authResponse =
      await evaluatePolicyArrayToResponse<ReplacementResponse>(
        page,
        {
          type: "page",
          request: renderRequest.request,
          routeParams: renderRequest.params,
          authCache: getStore().authCache,
        },
        async (error) => {
          const authFailedResponse =
            await serverTelemetry.onServerSidePageAuthUnknownError({
              applicationRuntime: this,
              url: renderRequest.originalUrl,
              renderRequest: renderRequest,
              error,
              willRecover: false,
              location: "page",
            });
          return (
            authFailedResponse ??
            new Response("Access denied due to an internal error", {
              status: 403,
            })
          );
        },
        async (_message) => {
          return await this.noAuthChecks_runSpecialPage(
            renderRequest,
            tfPaths.throwing.unauthorized,
          );
        },
      );
    if (authResponse) {
      return authResponse;
    }

    return this.noAuthChecks_runPageForInstance(
      page,
      actionResult,
      renderRequest,
      MiddlewareMode.Run,
    );
  }

  private async noAuthChecks_runPageForInstance(
    page: Page,
    actionResult: ActionResultData | undefined,
    renderRequest: RenderRequest,
    middleware: MiddlewareMode,
    overridePageProps?: { error: unknown },
    overrideStatus?: number,
  ): Promise<ReplacementResponse> {
    if (getStore().errorHandlingDepth >= 2) {
      // We have already run through this sequence:
      // count 0: noAuthChecks_runPageForInstance -> failed
      //          server-side telemetry called to handle error
      //          and it attempted to render an error page
      //          (move to count 1)
      // count 1: noAuthChecks_runPageForInstance for error -> failed
      //          server-side telemetry called again to handle
      //          error from error page, and it again attempted
      //          to render an error page (move to count 2)
      // count 2: now
      //
      // At this point it's clear we can't use telemetry to handle the
      // error and we can't render the error either. Replace the response
      // with a plain HTTP error so we don't loop forever.
      return new Response(
        "An error occurred during error handling, and it is not possible to render this page.",
        {
          status: 500,
          headers: {
            [headerContentType]: contentType.plain,
          },
        },
      );
    }

    // If page.segments() fails to load the module or any parent modules,
    // we want to report as an error rather than letting it propagate as
    // a catastrophic error.
    let segments;
    try {
      segments = await page.segments();
    } catch (error: unknown) {
      getStore().errorHandlingDepth++;
      return await serverTelemetry.onServerSidePageMiddlewareError({
        applicationRuntime: this,
        url: renderRequest.originalUrl,
        renderRequest: renderRequest,
        error: error,
        willRecover: false,
        location: "page-middleware",
      });
    }

    const props: PageProps<never, object> = {
      params: renderRequest.params,
      searchParams: renderRequest.originalUrl.searchParams,
      url: renderRequest.originalUrl,
      request: renderRequest.request,
      metadata: {},
      rewrittenTo: {
        searchParams: renderRequest.url.searchParams,
        url: renderRequest.url,
      },
      original: {
        searchParams: renderRequest.originalUrl.searchParams,
        url: renderRequest.originalUrl,
      },
    };
    props.metadata = await this.getMetadata(page, props);

    if (middleware === MiddlewareMode.Run) {
      try {
        const layouts = page.layouts;
        const promises = [
          page.runMiddleware(props),
          ...layouts.map((layout) => layout.runMiddleware(props)),
        ];
        await Promise.all(promises);
      } catch (error: unknown) {
        getStore().errorHandlingDepth++;
        return await serverTelemetry.onServerSidePageMiddlewareError({
          applicationRuntime: this,
          url: renderRequest.originalUrl,
          renderRequest: renderRequest,
          error: error,
          willRecover: false,
          location: "page-middleware",
        });
      }
    }

    const routeStack = segments.map((segment): RouteStackEntry => {
      const segmentKey = `${segment.path}:${applyPathParams(
        segment.path,
        renderRequest.params,
      )}`;

      // we hash the key because if they "look" like urls or paths
      // certain bots will try to crawl them
      const key = ApplicationRuntime.hash(segmentKey);

      const components = segment.components;
      const componentsWithProps = components.map((component, index) => {
        return {
          component: component.func,
          props: {
            ...((segment.path === tfPaths.throwing.internalServerError
              ? overridePageProps
              : undefined) ?? component.props),
            ...(component.requirements.includes("dynamicRequest") ? props : {}),
            ...(index === 0 ? { key } : {}),
          },
        };
      });

      return {
        type: "tree",
        key: key,
        tree: componentsToTree(componentsWithProps),
      };
    });

    const rscPayload: RscPayload = {
      stack: routeStack,
      path: getPathForRouterFromRscUrl(renderRequest.url),
      action: actionResult?.returnValue,
      formState: actionResult?.formState,
    };
    const rscOptions = {
      temporaryReferences: actionResult?.temporaryReferences,
      onError: (error: unknown) => {
        // If overridePageProps is set, we'll have an error that originated somewhere else and has already been reported.
        if (overridePageProps && overridePageProps.error === error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "digest" in error &&
            typeof error.digest === "string"
          ) {
            // Pass digest from server to client unmodified. This is what allows the client to recognise special errors such as "not found".
            return error.digest;
          } else {
            // No digest for this error.
            return undefined;
          }
        }

        // Otherwise forward error to error handling.
        return serverTelemetry.onServerSidePageRenderError({
          applicationRuntime: this,
          url: renderRequest.originalUrl,
          renderRequest: renderRequest,
          error: error,
          willRecover: true,
          location: "page",
        });
      },
    };
    return {
      status: overrideStatus,
      stream: renderToReadableStream<RscPayload>(rscPayload, rscOptions),
    };
  }

  noAuthChecks_runSpecialPage(
    renderRequest: RenderRequest,
    specialPage: string,
    error?: unknown,
  ): Promise<ReplacementResponse> {
    let page = this.#root.tree.findPageForPath(specialPage);
    invariant(page, `Could not find special page '${specialPage}'`);

    let overrideStatus;
    if (specialPage === tfPaths.throwing.notFound) {
      overrideStatus = 404;
    } else if (specialPage === tfPaths.throwing.unauthorized) {
      overrideStatus = 403;
    } else if (specialPage === tfPaths.throwing.internalServerError) {
      overrideStatus = 500;
    }

    return this.noAuthChecks_runPageForInstance(
      page,
      undefined,
      renderRequest,
      MiddlewareMode.Skip,
      error
        ? {
            error,
          }
        : undefined,
      overrideStatus,
    );
  }

  createRedirectResponse(
    renderRequest: RenderRequest,
    targetUrl: string,
    status?: number,
  ): Response {
    const redirectUrl = new URL(targetUrl, renderRequest.originalUrl);
    const isRelative =
      redirectUrl.origin === renderRequest.originalUrl.origin &&
      targetUrl.startsWith("/");

    if (renderRequest.isRsc && isRelative) {
      return new Response(null, {
        status: status ?? 303,
        headers: {
          [headerLocation]: getPathForRscRequest(redirectUrl),
        },
      });
    }

    if (!renderRequest.isRsc) {
      return new Response(null, {
        status: status ?? 303,
        headers: {
          [headerLocation]: targetUrl,
        },
      });
    } else {
      return new Response(
        JSON.stringify({
          type: "twofold-offsite-redirect",
          url: targetUrl,
          status: status,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }
  }

  private static loadRoot(modules: ModuleMap): Layout {
    let pages = ApplicationRuntime.loadPages(modules);
    let layouts = ApplicationRuntime.loadLayouts(modules);
    let apiEndpoints = ApplicationRuntime.loadApiEndpoints(modules);
    let rewrites = ApplicationRuntime.loadRewrites(modules);
    let errorTemplates = ApplicationRuntime.loadErrorTemplates(modules);
    let catchBoundaries =
      ApplicationRuntime.loadCatchBoundaries(errorTemplates);
    let outerRootWrapper = ApplicationRuntime.loadOuterRootWrapper();
    let specialPages = ApplicationRuntime.loadSpecialPages();
    let [rootLayout, otherLayouts] = partition(layouts, (x) => x.path === "/");

    if (rootLayout.length === 0) {
      throw new Error("No root layout");
    }

    let root = rootLayout[0]!;

    otherLayouts.forEach((layout) => root.addChild(layout));
    catchBoundaries.forEach((catchBoundary) => root.addChild(catchBoundary));
    pages.forEach((page) => root.addChild(page));
    apiEndpoints.forEach((apiEndpoint) => root.addChild(apiEndpoint));
    rewrites.forEach((rewrite) => root.addChild(rewrite));
    errorTemplates.forEach((errorTemplate) => root.addChild(errorTemplate));
    specialPages.forEach((page) => root.addChild(page));

    root.addWrapper(outerRootWrapper);

    return root;
  }

  private static hasSuffix(relativePath: string, suffix: string) {
    return (
      relativePath.endsWith(`${suffix}.tsx`) ||
      relativePath.endsWith(`${suffix}.ts`)
    );
  }

  private static snipSuffix(relativePath: string, suffix: string) {
    if (relativePath.endsWith(`.tsx`)) {
      return relativePath.slice(0, -`${suffix}.tsx`.length);
    } else if (relativePath.endsWith(`.ts`)) {
      return relativePath.slice(0, -`${suffix}.ts`.length);
    } else {
      throw new Error(
        `'${relativePath}' does not have '.tsx' or '.ts' as a suffix.`,
      );
    }
  }

  private static loadApiEndpoints(modules: ModuleMap): API[] {
    return Object.getOwnPropertyNames(modules)
      .filter((relativePath) =>
        ApplicationRuntime.hasSuffix(relativePath, ".api"),
      )
      .map((relativePath) => {
        let path = ApplicationRuntime.snipSuffix(relativePath.slice(2), ".api");
        if (path === "index" || path.endsWith("/index")) {
          path = path.slice(0, -6);
        }
        return new API({
          path: `/${path}`,
          loadModule: modules[relativePath]! as () => Promise<ModuleSurface>,
        });
      });
  }

  private static loadRewrites(modules: ModuleMap): Rewrite[] {
    return Object.getOwnPropertyNames(modules)
      .filter((relativePath) =>
        ApplicationRuntime.hasSuffix(relativePath, ".rewrite"),
      )
      .map((relativePath) => {
        let path = ApplicationRuntime.snipSuffix(
          relativePath.slice(2),
          ".rewrite",
        );
        if (path === "index" || path.endsWith("/index")) {
          path = path.slice(0, -6);
        }
        return new Rewrite({
          path: `/${path}`,
          loadModule: modules[relativePath]! as () => Promise<
            ModuleSurface<ModuleSurfaceExportRewrite>
          >,
        });
      });
  }

  private static loadPages(modules: ModuleMap): Page[] {
    return Object.getOwnPropertyNames(modules)
      .filter((relativePath) =>
        ApplicationRuntime.hasSuffix(relativePath, ".page"),
      )
      .map((relativePath) => {
        let path = ApplicationRuntime.snipSuffix(
          relativePath.slice(2),
          ".page",
        );
        if (path === "index" || path.endsWith("/index")) {
          path = path.slice(0, -6);
        }
        return new Page({
          path: `/${path}`,
          css: undefined,
          loadModule: modules[relativePath]! as () => Promise<ModuleSurface>,
        });
      });
  }

  private static loadLayouts(modules: ModuleMap): Layout[] {
    return Object.getOwnPropertyNames(modules)
      .filter((relativePath) =>
        ApplicationRuntime.hasSuffix(relativePath, "/layout"),
      )
      .map((relativePath) => {
        let path = ApplicationRuntime.snipSuffix(
          relativePath.slice(2),
          "/layout",
        );
        return new Layout({
          path: `/${path}`,
          css: undefined,
          loadModule: modules[relativePath]! as () => Promise<ModuleSurface>,
        });
      });
  }

  private static loadErrorTemplates(modules: ModuleMap): ErrorTemplate[] {
    let templates = Object.getOwnPropertyNames(modules)
      .filter((relativePath) =>
        ApplicationRuntime.hasSuffix(relativePath, ".error"),
      )
      .map((relativePath) => {
        let path = `/${ApplicationRuntime.snipSuffix(relativePath.slice(2), ".error")}`;
        let tag = path.split("/").at(-1) ?? "unknown";
        return new ErrorTemplate({
          tag,
          path,
          loadModule: modules[relativePath]! as () => Promise<ModuleSurface>,
        });
      });

    // if there is no root level unauthorized template we will add the default
    if (!templates.some((t) => t.tag === "unauthorized" && t.path === "/")) {
      templates.push(
        new ErrorTemplate({
          tag: "unauthorized",
          path: "/",
          loadModule: () =>
            import("../../client/components/error-templates/unauthorized.js") as unknown as Promise<ModuleSurface>,
        }),
      );
    }

    // if there is no root level not found template we will add the default
    if (!templates.some((t) => t.tag === "not-found" && t.path === "/")) {
      templates.push(
        new ErrorTemplate({
          tag: "not-found",
          path: "/",
          loadModule: () =>
            import("../../client/components/error-templates/not-found.js") as unknown as Promise<ModuleSurface>,
        }),
      );
    }

    return templates;
  }

  private static loadCatchBoundaries(
    errorTemplates: ErrorTemplate[],
  ): CatchBoundary[] {
    let routeStackPlaceholder = new Generic({
      loadModule: () =>
        import("../../client/components/route-stack/placeholder.js"),
    });
    let catchBoundaryLoadModule = () =>
      import("../../client/components/boundaries/catch-boundary.js");

    let catchBoundaryMap = new Map<string, CatchBoundary>();

    // always have a root level catch boundary
    catchBoundaryMap.set(
      "/",
      new CatchBoundary({
        path: "/",
        loadModule: catchBoundaryLoadModule,
        routeStackPlaceholder,
      }),
    );

    for (let errorTemplate of errorTemplates) {
      let path =
        errorTemplate.path === "/"
          ? "/"
          : "/" +
            errorTemplate.path
              .split("/")
              .filter(Boolean)
              .slice(0, -1)
              .join("/");

      let catchBoundary = catchBoundaryMap.get(path);

      if (!catchBoundary) {
        catchBoundary = new CatchBoundary({
          path,
          loadModule: catchBoundaryLoadModule,
          routeStackPlaceholder,
        });

        catchBoundaryMap.set(path, catchBoundary);
      }
    }

    return [...catchBoundaryMap.values()];
  }

  private static loadOuterRootWrapper(): Wrapper {
    return new Wrapper({
      path: "/",
      loadModule: () => import("../../client/components/outer-root-wrapper.js"),
    });
  }

  private static loadSpecialPages(): Page[] {
    const specialPages = {
      [tfPaths.throwing.notFound]: () =>
        import("../../client/pages/not-found.js"),
      [tfPaths.throwing.unauthorized]: () =>
        import("../../client/pages/unauthorized.js"),
      [tfPaths.throwing.internalServerError]: () =>
        import("../../client/pages/internal-server-error.js"),
    };
    const pages = [];
    for (const key of Object.getOwnPropertyNames(specialPages)) {
      pages.push(
        new Page({
          path: key,
          loadModule: specialPages[key] as () => Promise<ModuleSurface>,
        }),
      );
    }
    return pages;
  }
}
