import "server-only";
import { getStore } from "../../backend/stores/rsc-store";

export async function encrypt(value: string): Promise<string> {
  let store = getStore();
  return await store.encryption.encrypt(value);
}

export async function decrypt(value: string): Promise<string> {
  let store = getStore();
  return await store.encryption.decrypt(value);
}
