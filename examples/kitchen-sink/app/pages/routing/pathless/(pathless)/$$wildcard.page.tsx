import { PageProps } from "@redpointgames/framework/types";

export default function Page({ params }: PageProps<"wildcard">) {
  return <div>Wildcard page: {params.wildcard}</div>;
}
