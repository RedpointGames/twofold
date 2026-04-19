import { PageProps } from "@redpointgames/framework/types";

export default function Page({ params }: PageProps<"dynamic">) {
  return <div>Dynamic page: {params.dynamic}</div>;
}
