"use client";

export function ProtectedClientComponent() {
  return (
    <div>This should not appear on the client unless the cookie was set!</div>
  );
}
