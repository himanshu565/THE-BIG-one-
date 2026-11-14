"use client";

import React, { useState } from "react";
import { Filter, Layers, Zap, FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { ActivityList } from "./ActivityList";
import { ActivityItem, View } from "./types";

const EXTENDED_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    title: "RAG Hybrid Retrieval Query",
    detail: "Query synthesized using BM25 + Semantic Cosine fusion (RRF k=60)",
    type: "query",
    status: "Completed",
    timestamp: "Just now",
  },
  {
    id: "act-2",
    title: "Document Ingestion & Indexing",
    detail: "Multi-paragraph chunking with sentence overlap completed",
    type: "document",
    status: "Ready",
    timestamp: "2m ago",
  },
  {
    id: "act-3",
    title: "JWT Token Verified",
    detail: "User authorization validated with HS256 cryptographic signature",
    type: "setting",
    status: "Active",
    timestamp: "5m ago",
  },
  {
    id: "act-4",
    title: "Defensive Security Headers Injected",
    detail: "Strict-Transport-Security, CSP, and X-Content-Type-Options active",
    type: "setting",
    status: "Active",
    timestamp: "12m ago",
  },
  {
    id: "act-5",
    title: "Project Workspace Context Switch",
    detail: "Active project context scoped to owner ID",
    type: "project",
    status: "Ready",
    timestamp: "18m ago",
  },
  {
    id: "act-6",
    title: "Rate Limiter Sliding Window Check",
    detail: "IP hit counter evaluated within rate limit budget",
    type: "setting",
    status: "Healthy",
    timestamp: "25m ago",
  },
];

export function ActivityView({ setView }: { setView?: (view: View) => void }) {
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = EXTENDED_ACTIVITIES.filter((item) => {
    if (filterType === "all") return true;
    return item.type === filterType;
  });

  return (
    <>
      <SectionHeading
        onBack={setView ? () => setView("Overview") : undefined}
        eyebrow="Audit Log"
        title="Activity"
        description="Comprehensive audit trail of retrieval queries, document uploads, and security events."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
            <Filter size={13} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-semibold text-zinc-900 outline-none"
            >
              <option value="all">All Events</option>
              <option value="query">Retrieval Queries</option>
              <option value="document">Document Operations</option>
              <option value="setting">Security & System</option>
            </select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <p className="text-xs font-medium text-zinc-500">Total Audited Events</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{EXTENDED_ACTIVITIES.length}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 size={11} /> 100% Verified
          </span>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <p className="text-xs font-medium text-zinc-500">Security Events</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
            {EXTENDED_ACTIVITIES.filter((a) => a.type === "setting").length}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
            Rate limiting & headers armed
          </span>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <p className="text-xs font-medium text-zinc-500">Retrieval Queries</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
            {EXTENDED_ACTIVITIES.filter((a) => a.type === "query").length}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
            Average latency: &lt;150ms
          </span>
        </div>
      </div>

      <ActivityList items={filtered} />
    </>
  );
}
