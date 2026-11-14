"use client";

import React from "react";
import { ArrowUpRight, CheckCircle2, Clock, FileText, Layers, ShieldCheck, Zap } from "lucide-react";
import { ActivityItem, View } from "./types";

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    title: "RAG Hybrid Retrieval",
    detail: "BM25 + Semantic fusion active (RRF k=60)",
    type: "query",
    status: "Ready",
    timestamp: "Just now",
  },
  {
    id: "act-2",
    title: "Document Ingestion Engine",
    detail: "Multi-format parser & paragraph overlap active",
    type: "document",
    status: "Ready",
    timestamp: "2m ago",
  },
  {
    id: "act-3",
    title: "JWT Authentication",
    detail: "Secured project authorization & rate limiting enabled",
    type: "setting",
    status: "Active",
    timestamp: "5m ago",
  },
  {
    id: "act-4",
    title: "Defensive Security Headers",
    detail: "OWASP Top 10 headers applied to all responses",
    type: "setting",
    status: "Active",
    timestamp: "10m ago",
  },
];

export function ActivityList({
  setView,
  items,
}: {
  setView?: (view: View) => void;
  items?: ActivityItem[];
}) {
  const activityItems = items && items.length > 0 ? items : DEFAULT_ACTIVITIES;

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "query":
        return <Zap size={14} />;
      case "document":
        return <FileText size={14} />;
      case "project":
        return <Layers size={14} />;
      case "setting":
      default:
        return <ShieldCheck size={14} />;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <p className="mb-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Workspace Log
          </p>
          <h2 className="text-base font-bold tracking-tight text-zinc-900">Recent Activity</h2>
        </div>
        {setView && (
          <button
            onClick={() => setView("Activity")}
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-black transition"
          >
            View all <ArrowUpRight size={13} />
          </button>
        )}
      </div>
      <div className="divide-y divide-zinc-100">
        {activityItems.map((item) => (
          <div key={item.id || item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
              {getActivityIcon(item.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{item.detail}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.timestamp && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400">
                  <Clock size={10} /> {item.timestamp}
                </span>
              )}
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-600" />
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
