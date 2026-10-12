"use client";

import Link from "@twofold/framework/link";

export default function CustomNoConnectionError() {
  return (
    <div>
      <div>This is a custom no connection error</div>
      <div className="mt-4">
        <Link href="/routing/not-found" className="text-blue-500 underline">
          Go back to not found index
        </Link>
      </div>
    </div>
  );
}
