import { unauthorized } from "@redpointgames/framework/unauthorized";

export default function Page() {
  unauthorized();

  // return <div>You shouldn't see this</div>;
}
