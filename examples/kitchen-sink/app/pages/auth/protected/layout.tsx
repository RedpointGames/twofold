import { allowIfCookieSet } from "@/app/auth";
import { AuthPolicyArray } from "@redpointgames/framework/auth";

export const auth: AuthPolicyArray = [allowIfCookieSet];
