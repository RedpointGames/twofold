import { redirect } from "@redpointgames/framework/redirect";

export default async function Page() {
  redirect("/routing/redirects/ending");
  return <div>You should not see this!</div>;
}
