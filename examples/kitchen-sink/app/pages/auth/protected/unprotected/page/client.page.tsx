import { AuthPolicyArray, reset } from "@twofold/framework/auth";
import { ProtectedClientComponent } from "../../client/ProtectedClientComponent";
import { ProtectedComponentErrorBoundary } from "../../../ProtectedComponentErrorBoundary";
import { PathTestProtectedComponent } from "@/app/pages/(main)/admin/receipts/PathTestProtectedComponent";

export const auth: AuthPolicyArray = [reset];

export default function Page() {
  return (
    <>
      <div>
        This page allows you to test loading a protected client component when
        you don't have access.
      </div>
      <br />
      <ProtectedComponentErrorBoundary>
        <ProtectedClientComponent />
      </ProtectedComponentErrorBoundary>
      <br />
      <ProtectedComponentErrorBoundary>
        <PathTestProtectedComponent />
      </ProtectedComponentErrorBoundary>
    </>
  );
}
