import { PageProps } from "@redpointgames/framework/types";

export default function Page({ params }: PageProps<"dynamic">) {
  return <div>Subroute dynamic page: {params.dynamic}</div>;
}
