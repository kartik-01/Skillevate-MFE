import * as React from "react";

const Recommendation = React.lazy(() => import("recommendation/Widget"));
const Gamify = React.lazy(() => import("gamify/Widget"));
const Analysis = React.lazy(() => import("analysis/Widget"));

export function Routes() {
  return (
    <React.Suspense fallback={<div className="p-6">Loading…</div>}>
      <div className="p-6 space-y-6">
        <Recommendation />
        <Gamify />
        <Analysis />
      </div>
    </React.Suspense>
  );
}
