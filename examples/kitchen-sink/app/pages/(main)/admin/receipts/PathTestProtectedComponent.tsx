"use client";

export function PathTestProtectedComponent() {
  return <div>This should never be delivered to the client.</div>;
}
