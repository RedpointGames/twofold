// @ts-expect-error We can't add '@cloudflare/workers-types' to tsconfig.json without causing type check failures elsewhere.
import { env as cloudflareEnv } from "cloudflare:workers";
import type { Env } from "./env";

export const env = new Proxy(
  {},
  {
    get: function (_: any, name: string) {
      if (name === "keys") {
        return () => {
          const result: string[] = [];
          for (const key of Object.getOwnPropertyNames(cloudflareEnv as any)) {
            const value = (cloudflareEnv as any)[name];
            if (
              value !== null &&
              value !== undefined &&
              typeof value === "string"
            ) {
              result.push(key);
            }
          }
          return result;
        };
      } else {
        const value = (cloudflareEnv as any)[name];
        if (
          value !== null &&
          value !== undefined &&
          typeof value === "string"
        ) {
          return value;
        } else {
          return undefined;
        }
      }
    },
  },
) as Env;
