import { redirect } from "@redpointgames/framework/redirect";

export default function Page() {
  redirect("/routing/redirects/this-page-doesnt-exist");
  return <div>You should not see this!</div>;
}
