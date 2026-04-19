import { notFound } from "@redpointgames/framework/not-found";

export default function Page() {
  notFound();
  return <div>You should not see this!</div>;
}
