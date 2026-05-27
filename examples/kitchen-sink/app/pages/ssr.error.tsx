"use client";

import { SsrErrorProps } from "@twofold/framework/types";
import globalCssPath from "./global.css?url";

export default function SsrFailedPage(props: SsrErrorProps) {
  return (
    <html className="bg-white">
      {props.metaHeaders}
      <link rel="stylesheet" href={globalCssPath} />
      <body>
        <main className="mx-auto max-w-7xl px-4 py-8">
          {props.withNoScriptTag(() => {
            return (
              <div className="mx-auto max-w-[65ch] rounded border border-red-500 bg-red-50 p-6">
                <h1 className="text-3xl font-extrabold tracking-tighter text-red-500">
                  SSR rendering failed
                </h1>
                <p className="mt-4 text-sm font-semibold text-gray-600">
                  This is a custom "SSR failed / client needs to recover" page
                  at <span className="font-mono">ssr.error.tsx</span>. For users
                  that don't have JavaScript enabled, this can be used to at
                  least render an error page in the style of the app, rather
                  than using the framework's "SSR failed" page.
                </p>
              </div>
            );
          })}
        </main>
      </body>
    </html>
  );
}
