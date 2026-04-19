import { APIProps } from "@redpointgames/framework/types";

export function GET({ request }: APIProps) {
  let requestHeaders = Object.fromEntries(request.headers);

  return new Response(JSON.stringify(requestHeaders), {
    headers: {
      "content-type": "application/json",
    },
  });
}
