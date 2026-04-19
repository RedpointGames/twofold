import { unauthorized } from "@redpointgames/framework/unauthorized";

export function before() {
  unauthorized();
}

export default function Page() {
  return <div>You shouldn't see this</div>;
}
