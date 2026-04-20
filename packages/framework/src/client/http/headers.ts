import { getStore } from "../../backend/stores/rsc-store";

export default async function headers() {
  const store = getStore();
  if (store.context) {
    return store.context.request.headers;
  } else {
    return new Headers();
  }
}
