import { type AdapterRequestContext } from "@hattip/core";
import { Router } from "@hattip/router";
import routerProxy from "virtual:twofold/server-application-router";

export default {
  registerMiddlewareToRouter: <T>(app: Router<T>): void => {
    routerProxy.registerMiddlewareToRouter<T>(app);
  },
  fetchFromContext: (
    context: AdapterRequestContext<unknown>,
  ): Promise<Response> => {
    return routerProxy.fetchFromContext(context);
  },
  fetch: (req: Request): Promise<Response> => {
    return routerProxy.fetch(req);
  },
};
