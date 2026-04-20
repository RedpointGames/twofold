"use server";

import { redirect } from "@redpointgames/framework/redirect";
import { MyValue } from "./server-action-redirect-form";

export async function action(shouldRedirect: boolean): Promise<MyValue> {
  "use server";
  if (shouldRedirect) {
    redirect("/routing/redirects/server-action-redirect");
  } else {
    return { value: "another-value" };
  }
}
