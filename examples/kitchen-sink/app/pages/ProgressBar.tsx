"use client";

import { ProgressBarClientOnly } from "@redpointgames/framework/progress";

export function ProgressBar() {
  return (
    <ProgressBarClientOnly className="fixed top-0 h-1 bg-sky-500 shadow-lg shadow-sky-500/20" />
  );
}
