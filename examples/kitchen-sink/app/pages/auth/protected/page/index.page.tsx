import { behaveBasedOnQueryString } from "@/app/auth";
import { AuthPolicyArray } from "@redpointgames/framework/auth";
import headers from "@redpointgames/framework/headers";

export const auth: AuthPolicyArray = [behaveBasedOnQueryString];

export default async function Page() {
  return (
    <>
      <div>
        This message won't show unless the authentication policies allow it.
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
