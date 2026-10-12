import { NoConnectionError } from "../errors/no-connection-error";

export function noConnection(): never {
  throw new NoConnectionError();
}
