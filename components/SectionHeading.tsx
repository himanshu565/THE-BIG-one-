"use client";

import React from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  onBack,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="mb-2.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-500 hover:text-black transition"
          >
            ← Back to Dashboard
          </button>
        )}
        <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {eyebrow}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
