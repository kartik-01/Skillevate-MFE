import React from "react";

export default function Widget() {
  return (
    <div className="p-6 bg-green-50 rounded-2xl shadow-md border border-green-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-green-800">My Analysis</h2>
          <p className="text-green-600 mt-2">
            Your skill insights will appear here once you start.
          </p>
        </div>
        <button className="px-5 py-2.5 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition">
          Start analysis
        </button>
      </div>
    </div>
  );
}
