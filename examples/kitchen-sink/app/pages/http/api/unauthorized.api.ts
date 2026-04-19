import { unauthorized } from "@redpointgames/framework/unauthorized";

export function GET() {
  unauthorized();
}
