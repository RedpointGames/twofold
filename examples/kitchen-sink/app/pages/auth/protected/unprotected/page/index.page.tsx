import { AuthPolicyArray, reset } from "@redpointgames/framework/auth";

export const auth: AuthPolicyArray = [reset];

export default function Page() {
  return (
    <div>
      This message should always show since this page resets the authentication
      policies of the parent routes.
    </div>
  );
}
