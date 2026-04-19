import { notFound } from "@redpointgames/framework/not-found";

export async function before() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  notFound();
}

export default function Page() {
  return <div>You should not see this!</div>;
}
