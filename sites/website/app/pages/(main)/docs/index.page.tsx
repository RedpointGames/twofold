import { redirect } from "@redpointgames/framework/redirect";

export function before() {
  return redirect("/docs/guides/getting-started");
}

export default function DocsIndex() {
  return null;
}
