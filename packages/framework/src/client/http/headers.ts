import { getStore } from "../../backend/stores/rsc-store";

export default async function headers() {
  const store = getStore();
  if (store.request) {
    return store.request.headers;
  } else {
    return new Headers();
  }
}
