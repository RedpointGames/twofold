import { redirect } from "@redpointgames/framework/redirect";

export default function Page() {
  redirect("https://github.com/");
  return <div>You should not see this!</div>;
}
