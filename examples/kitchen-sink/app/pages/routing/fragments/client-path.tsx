"use client";

import { useRouter } from "@redpointgames/framework/use-router";

export function ClientPath() {
  let { path } = useRouter();

  return <div>Client path: {path}</div>;
}
