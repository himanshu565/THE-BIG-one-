"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Database,
  FileText,
  FolderKanban,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, Document as DocumentItem, QueryResponse } from "@/lib/api";
import { SectionHeading } from "./SectionHeading";
import { ActivityList } from "./ActivityList";
import { View } from "./types";

export function OverviewView({ setView }: { setView: (view: View) => void }) {
  const { projects, activeProject, setActiveProject } = useAuth();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (!activeProject) {
      setRecentDocs([]);
      return;
    }
    api.documents
      .list(activeProject.id)
      .then((docs) => setRecentDocs(docs))
      .catch(() => setRecentDocs([]));
  }, [activeProject]);

  const handleRunQuery = async () => {
    if (!question.trim() || !activeProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.retrieval.query(activeProject.id, question.trim(), 5, "hybrid");
      setQueryResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run retrieval query");
    } finally {
      setLoading(false);
    }
  };

  const totalChunks = recentDocs.reduce((acc, d) => acc + d.chunk_count, 0);
  const readyDocsCount = recentDocs.filter((d) => d.status === "ready").length;
  const healthPercent = recentDocs.length > 0
    ? Math.round((readyDocsCount / recentDocs.length) * 100)
    : 100;

  const stats = [
    {
      label: "Active Project",
      value: activeProject ? activeProject.name : "None",
      badge: activeProject ? "Online" : "Select",
      sub: activeProject ? "Ready" : "No project",
      icon: FolderKanban,
    },
    {
      label: "Total Documents",
      value: recentDocs.length.toString(),
      badge: `${recentDocs.length} files`,
      sub: "Indexed",
      icon: Database,
    },
    {
      label: "Active Chunks",
      value: totalChunks.toString(),
      badge: `${totalChunks} vectors`,
      sub: "Vectorized",
      icon: Layers3,
    },
    {
      label: "Data Health",
      value: `${healthPercent}%`,
      badge: healthPercent === 100 ? "Healthy" : "Attention",
      sub: "Verified",
      icon: ShieldCheck,
      isHealth: true,
    },
  ];

  return (
    <>
      <SectionHeading
        eyebrow="System Online"
        title="Dashboard"
        description="Real-time retrieval monitoring & knowledge data transmission"
        action={
          <button
            onClick={() => setView("Projects")}
            className="flex w-fit items-center gap-2 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 shadow-sm"
          >
            <Plus size={15} /> Manage projects
          </button>
        }
      />

      {/* 4 Top KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, badge, icon: Icon, isHealth }) => (
          <div
            key={label}
            className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card transition hover:border-zinc-300"
          >
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium text-zinc-500">{label}</span>
              {isHealth ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
                  <Icon size={15} />
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="truncate text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">
                {badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Projects Quick Switcher Row if multiple projects */}
      {projects.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Workspaces:
          </span>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActiveProject(project)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                activeProject?.id === project.id
                  ? "bg-black text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      {/* Middle Row: Retrieval Workspace (Left) + Donut Status Gauge (Right) */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Left: Ask Knowledge Base */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="mb-0.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Zap size={13} className="text-zinc-600" /> Retrieval Workspace
              </p>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">Ask your knowledge base</h2>
            </div>
            <button
              onClick={() => setView("Ask your data")}
              className="text-zinc-400 hover:text-black transition"
            >
              <ArrowUpRight size={18} />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 transition focus-within:border-zinc-400 focus-within:bg-white">
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setQueryResult(null);
                setError(null);
              }}
              placeholder={
                activeProject
                  ? `Ask a question about ${activeProject.name}...`
                  : "Create or select a project first to ask questions..."
              }
              disabled={!activeProject || loading}
              className="min-h-[86px] w-full resize-none bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-40"
            />
            <div className="flex items-center justify-between border-t border-zinc-200/70 pt-3">
              <span className="font-mono text-[11px] text-zinc-500">
                Project: <span className="font-semibold text-zinc-800">{activeProject?.name || "None"}</span>
              </span>
              <button
                onClick={handleRunQuery}
                disabled={!question.trim() || !activeProject || loading}
                className="flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loading ? "Retrieving..." : "Run retrieval"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {queryResult && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-zinc-900 font-medium">
                <span className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Grounded Answer ({queryResult.latency_ms}ms)
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{queryResult.retrieval_mode}</span>
              </div>
              <p className="mt-2.5 text-xs leading-6 text-zinc-700">{queryResult.answer}</p>
              {queryResult.sources.length > 0 && (
                <div className="mt-3 border-t border-zinc-200 pt-2.5">
                  <p className="font-mono text-[10px] font-semibold text-zinc-500 uppercase">Top Source Citation:</p>
                  <p className="mt-0.5 font-mono text-xs font-medium text-zinc-900">
                    {queryResult.sources[0].document_name} · chunk {queryResult.sources[0].chunk_index}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <Database size={12} /> Hybrid search · Top 5 chunks · RRF fusion (k=60)
          </div>
        </div>

        {/* Right: Donut Chart Status Gauge */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                System Status
              </p>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">Retrieval Status</h2>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            {/* Donut Gauge */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-zinc-900"
                  strokeDasharray={`${healthPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold tracking-tight text-zinc-900">{healthPercent}%</span>
                <span className="block text-[10px] font-medium text-zinc-500">
                  {healthPercent === 100 ? "Online" : "Degraded"}
                </span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="mt-6 w-full space-y-2 border-t border-zinc-100 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-full bg-zinc-900" /> Online (Hybrid RRF)
                </span>
                <span className="font-mono font-semibold text-zinc-900">{readyDocsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-full bg-zinc-400" /> Total Chunks
                </span>
                <span className="font-mono font-semibold text-zinc-900">{totalChunks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-500">
                  <span className="h-2 w-2 rounded-full border border-zinc-300 bg-transparent" /> Pending / Processing
                </span>
                <span className="font-mono font-semibold text-zinc-500">{recentDocs.length - readyDocsCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Live Data (Latest) Table */}
      <div className="mt-6 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-zinc-900">Live Documents (Latest)</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Real-time indexed knowledge in active workspace</p>
          </div>
          <button
            onClick={() => setView("Documents")}
            className="flex items-center gap-1 font-mono text-xs font-semibold text-zinc-900 hover:text-zinc-600 transition"
          >
            View All →
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500">
            No documents indexed in this project yet. Click &quot;View All →&quot; or upload your first file.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 font-mono text-[11px] font-semibold uppercase text-zinc-400">
                  <th className="pb-3 pr-4">Document Name</th>
                  <th className="pb-3 pr-4">Format</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Chunks</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {recentDocs.slice(0, 5).map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3 pr-4 font-medium text-zinc-900 flex items-center gap-2">
                      <FileText size={14} className="text-zinc-400" />
                      {doc.name}
                    </td>
                    <td className="py-3 pr-4 font-mono uppercase text-zinc-500">{doc.file_type}</td>
                    <td className="py-3 pr-4 font-mono text-zinc-600">
                      {Math.max(1, Math.round(doc.file_size / 1024))} KB
                    </td>
                    <td className="py-3 pr-4 font-mono text-zinc-700">{doc.chunk_count} chunks</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <ActivityList setView={setView} />
      </div>
    </>
  );
}
