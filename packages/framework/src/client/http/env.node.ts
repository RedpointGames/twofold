import { env as nodeEnv } from "node:process";
import type { Env } from "./env";

export const env = new Proxy(
  {},
  {
    get: function (_: any, name: string) {
      if (name === "keys") {
        return () => {
          const result: string[] = [];
          for (const key of Object.getOwnPropertyNames(nodeEnv)) {
            result.push(key);
          }
          return result;
        };
      } else {
        return nodeEnv[name];
      }
    },
  },
) as Env;
