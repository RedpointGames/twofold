import { APIProps } from "@redpointgames/framework/types";

export function GET({ params }: APIProps<"id">) {
  let data = { ok: true, id: params.id };

  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
  });
}
