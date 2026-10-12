export class NoConnectionError extends Error {
  isTwofoldError = true;
  name = "TwofoldNoConnectionError";
  digest = "TwofoldNoConnectionError";

  constructor() {
    super("TwofoldNoConnectionError");
  }
}
