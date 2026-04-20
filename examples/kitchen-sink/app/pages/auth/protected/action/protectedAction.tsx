"use server";

import { behaveBasedOnFormData } from "@/app/auth";
import { AuthPolicyArray } from "@redpointgames/framework/auth";
import headers from "@redpointgames/framework/headers";

export const auth: AuthPolicyArray = [behaveBasedOnFormData];

export default async function action(formData: FormData) {
  return (
    <>
      <div>
        This is a server component returned by a server action. It will only be
        returned if the authentication policies pass. The behaviour was '
        {formData.get("behaviour")?.toString()}'.
      </div>
      <div>
        {(await headers()).entries().map((kv) => (
          <div key={kv[0]}>
            <pre>
              {kv[0]}={kv[1]}
            </pre>
          </div>
        ))}
      </div>
    </>
  );
}
