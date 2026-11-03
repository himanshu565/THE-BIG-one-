"use client";

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  FileText,
  FilePlus2,
  Filter,
  FolderKanban,
  Gauge,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, DocumentItem, QueryResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type View =
  | "Overview"
  | "Ask your data"
  | "Documents"
  | "Projects"
  | "Evaluations"
  | "Activity"
  | "Settings";

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: View | "Help center";
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs transition duration-150 ${
        active
          ? "bg-black text-white font-medium shadow-sm"
          : "text-zinc-600 hover:text-black hover:bg-zinc-100/80 font-normal"
      }`}
    >
      <Icon size={16} strokeWidth={active ? 2 : 1.75} />
      <span>{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
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

// ---------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------
function Overview({ setView }: { setView: (view: View) => void }) {
  const { user, projects, activeProject, setActiveProject } = useAuth();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (activeProject) {
      api.documents
        .list(activeProject.id)
        .then((docs) => setRecentDocs(docs))
        .catch(() => setRecentDocs([]));
    }
  }, [activeProject?.id]);

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

  const stats = [
    {
      label: "Active Project",
      value: activeProject ? activeProject.name : "None",
      badge: "+8%",
      sub: activeProject ? "Online" : "Select",
      icon: FolderKanban,
    },
    {
      label: "Total Documents",
      value: recentDocs.length > 0 ? recentDocs.length.toString() : `${projects.length} sites`,
      badge: "+5%",
      sub: "Indexed",
      icon: Database,
    },
    {
      label: "Active Chunks",
      value: totalChunks > 0 ? totalChunks.toString() : "182",
      badge: "+12%",
      sub: "Vectorized",
      icon: Layers3,
    },
    {
      label: "Data Health",
      value: "99.4%",
      badge: "+1.2%",
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
                  strokeDasharray="92, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold tracking-tight text-zinc-900">92%</span>
                <span className="block text-[10px] font-medium text-zinc-500">Online</span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="mt-6 w-full space-y-2 border-t border-zinc-100 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-full bg-zinc-900" /> Online (Hybrid RRF)
                </span>
                <span className="font-mono font-semibold text-zinc-900">62</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-full bg-zinc-400" /> Fallback (BM25)
                </span>
                <span className="font-mono font-semibold text-zinc-900">5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-500">
                  <span className="h-2 w-2 rounded-full border border-zinc-300 bg-transparent" /> Maintenance
                </span>
                <span className="font-mono font-semibold text-zinc-500">0</span>
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

function ActivityList({ setView }: { setView?: (view: View) => void }) {
  const activityItems = [
    { title: "RAG Hybrid Retrieval", detail: "BM25 + Semantic fusion active", type: "query", status: "Ready" },
    { title: "JWT Authentication", detail: "Secured project authorization", type: "setting", status: "Active" },
    { title: "Document Chunking", detail: "Multi-format parser connected", type: "document", status: "Ready" },
  ];
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <p className="mb-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Workspace Log</p>
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
          <div key={item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
              <Zap size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{item.detail}</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Documents Tab
// ---------------------------------------------------------
function Documents() {
  const { activeProject } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All files");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [textDocName, setTextDocName] = useState("");
  const [textDocContent, setTextDocContent] = useState("");

  const fetchDocs = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const list = await api.documents.list(activeProject.id);
      setDocs(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [activeProject?.id]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeProject) return;
    setUploading(true);
    setError(null);
    try {
      await api.documents.upload(activeProject.id, file);
      setShowUploadModal(false);
      await fetchDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateTextDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textDocName.trim() || !textDocContent.trim() || !activeProject) return;
    setUploading(true);
    setError(null);
    try {
      await api.documents.create(activeProject.id, textDocName.trim(), textDocContent.trim());
      setTextDocName("");
      setTextDocContent("");
      setShowUploadModal(false);
      await fetchDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!activeProject) return;
    try {
      await api.documents.delete(activeProject.id, docId);
      await fetchDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const filtered = useMemo(
    () =>
      docs.filter(
        (doc) =>
          doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (filter === "All files" || doc.status.toLowerCase() === filter.toLowerCase()),
      ),
    [docs, searchTerm, filter],
  );

  return (
    <>
      <SectionHeading
        eyebrow="Knowledge Base"
        title="Documents"
        description={
          activeProject
            ? `Manage documents and indexed chunks in '${activeProject.name}'.`
            : "Select a project to view and upload documentation."
        }
        action={
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={!activeProject}
            className="flex w-fit items-center gap-2 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
          >
            <FilePlus2 size={15} /> Upload documents
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error}
        </div>
      )}

      {showUploadModal && (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-elevated">
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900">
                <UploadCloud size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Upload document to {activeProject?.name}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Supported formats: PDF, Markdown (.md), TXT, and CSV. Files are chunked automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadModal(false)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:text-black hover:border-zinc-300 transition"
            >
              Cancel
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-center transition hover:border-zinc-500 hover:bg-zinc-50"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md,.pdf,.csv"
              />
              <Upload size={22} className="mx-auto text-zinc-600" />
              <p className="mt-2.5 text-xs font-bold text-zinc-900">Click to browse file</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">PDF, MD, TXT, or CSV</p>
              {uploading && <p className="mt-2 font-mono text-xs text-zinc-900 font-semibold">Uploading and indexing...</p>}
            </div>

            <form onSubmit={handleCreateTextDoc} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
              <p className="text-xs font-bold text-zinc-900">Or write direct text / markdown:</p>
              <input
                type="text"
                placeholder="Document title (e.g. runbook.md)"
                value={textDocName}
                onChange={(e) => setTextDocName(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
              <textarea
                placeholder="Paste documentation text or markdown content..."
                value={textDocContent}
                onChange={(e) => setTextDocContent(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
              <button
                type="submit"
                disabled={uploading || !textDocName.trim() || !textDocContent.trim()}
                className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
              >
                Save & Index
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Total Files", docs.length.toString()],
          [
            "Indexed Chunks",
            docs.reduce((sum, d) => sum + d.chunk_count, 0).toLocaleString(),
          ],
          ["Status", activeProject ? "Connected" : "No project"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 py-1.5 pl-8 pr-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-zinc-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400"
            >
              <option>All files</option>
              <option>Ready</option>
              <option>Processing</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-zinc-500">
            <RefreshCw size={16} className="mx-auto mb-2 animate-spin text-zinc-400" />
            Loading documents...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500">
            {activeProject
              ? "No documents in this project yet. Click 'Upload documents' above."
              : "Please select an active project first."}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="grid gap-3 px-5 py-4 transition hover:bg-zinc-50/60 md:grid-cols-[minmax(0,1.7fr)_80px_100px_110px_120px_32px] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900">{doc.name}</p>
                    <p className="mt-0.5 text-[10px] font-mono text-zinc-500 md:hidden">
                      {doc.file_type.toUpperCase()} · {doc.chunk_count} chunks · {doc.status}
                    </p>
                  </div>
                </div>
                <span className="hidden font-mono text-[11px] uppercase text-zinc-500 md:block">
                  {doc.file_type}
                </span>
                <span className="hidden font-mono text-[11px] text-zinc-600 md:block">
                  {Math.max(1, Math.round(doc.file_size / 1024))} KB
                </span>
                <span className="hidden font-mono text-[11px] text-zinc-600 md:block">
                  {doc.chunk_count} chunks
                </span>
                <span className="flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 size={11} className="text-emerald-600" /> {doc.status}
                </span>
                <button
                  onClick={() => handleDelete(doc.id)}
                  title="Delete document"
                  className="text-zinc-400 hover:text-red-500 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------
// Ask your data Tab
// ---------------------------------------------------------
function AskData() {
  const { activeProject, projects, setActiveProject } = useAuth();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"hybrid" | "bm25" | "semantic">("hybrid");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim() || !activeProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.retrieval.query(activeProject.id, question.trim(), 5, mode);
      setResponse(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SectionHeading
        eyebrow="Retrieval Engine"
        title="Ask your data"
        description="Search across your indexed knowledge with verified grounded answers and citations."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                const found = projects.find((p) => p.id === Number(e.target.value));
                if (found) setActiveProject(found);
              }}
              className="cursor-pointer bg-transparent text-xs font-semibold text-zinc-900 outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-white text-zinc-900">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">New Question</h2>
              <p className="text-xs text-zinc-500">
                Answers cite exact source documents and chunk indexes.
              </p>
            </div>
          </div>
          <textarea
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setResponse(null);
              setError(null);
            }}
            placeholder="e.g. What is our RAG latency budget and groundedness threshold?"
            disabled={!activeProject || loading}
            className="min-h-[130px] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-40 transition"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <SlidersHorizontal size={13} /> Mode:
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "hybrid" | "bm25" | "semantic")}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="hybrid">Hybrid (BM25 + Semantic RRF)</option>
                <option value="bm25">Lexical BM25 Only</option>
                <option value="semantic">Semantic Vector Only</option>
              </select>
            </div>
            <button
              onClick={handleAsk}
              disabled={!question.trim() || !activeProject || loading}
              className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
            >
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {loading ? "Synthesizing..." : "Generate answer"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {response && (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-900 font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Grounded Answer Ready
                </span>
                <span className="font-mono text-[11px] text-zinc-500">Latency: {response.latency_ms}ms</span>
              </div>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs leading-6 text-zinc-800">{response.answer}</p>
              {response.sources.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Retrieved Sources:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {response.sources.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-card">
                        <p className="font-mono text-[11px] font-semibold text-zinc-900">
                          Source {idx + 1} · score: {s.score.toFixed(4)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-zinc-600">
                          {s.document_name} · chunk {s.chunk_index}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                          &quot;{s.content}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card transition hover:border-zinc-300">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Retrieval Health</p>
          <div className="mt-5 space-y-4">
            {[
              ["BM25 Lexical Index", "Online", "100%"],
              ["Vector Similarity", "Online", "98.7%"],
              ["RRF Rank Fusion", "Enabled", "k=60"],
            ].map(([label, status, val]) => (
              <div key={label} className="border-b border-zinc-100 pb-3 last:border-b-0">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-medium text-zinc-800">{label}</span>
                  <span className="font-mono font-semibold text-zinc-600">{status}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-900" style={{ width: "95%" }} />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] text-zinc-500">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------
// Projects Tab
// ---------------------------------------------------------
function Projects() {
  const { projects, refreshProjects, activeProject, setActiveProject } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.projects.create(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      setShowCreateModal(false);
      await refreshProjects();
      setActiveProject(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.projects.delete(id);
      await refreshProjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <>
      <SectionHeading
        eyebrow="Workspaces"
        title="Projects"
        description="Organize knowledge bases and keep retrieval contexts focused."
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex w-fit items-center gap-2 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 shadow-sm"
          >
            <Plus size={15} /> Create project
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error}
        </div>
      )}

      {showCreateModal && (
        <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-elevated">
          <h3 className="text-sm font-bold text-zinc-900">Create new project workspace</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600">Project Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Platform docs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief summary of documents"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-lg bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
            >
              {loading ? "Creating..." : "Save Project"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:text-black hover:border-zinc-300 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`rounded-2xl border p-5 transition shadow-card ${
              activeProject?.id === project.id
                ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                : "border-zinc-200/90 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  activeProject?.id === project.id ? "bg-black" : "bg-zinc-300"
                }`}
              />
              <button
                onClick={() => handleDelete(project.id)}
                title="Delete project"
                className="text-zinc-400 hover:text-red-500 transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <h2 className="mt-4 text-base font-bold tracking-tight text-zinc-900">{project.name}</h2>
            <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
              {project.description || "Knowledge workspace for documents and retrieval queries."}
            </p>
            <div className="mt-5 border-t border-zinc-100 pt-3.5 flex items-center justify-between">
              <span className="font-mono text-[10px] text-zinc-400">
                {new Date(project.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => setActiveProject(project)}
                className={`text-xs font-semibold flex items-center gap-1 transition ${
                  activeProject?.id === project.id
                    ? "text-black"
                    : "text-zinc-500 hover:text-black"
                }`}
              >
                {activeProject?.id === project.id ? "Active Workspace ✓" : "Set Active →"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------
// Auth Screen (Shown when user is not authenticated)
// ---------------------------------------------------------
function AuthScreen() {
  const { login, register, quickDemoLogin, backendOnline } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await quickDemoLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/90 bg-white p-7 shadow-elevated">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white shadow-sm">
            <Layers3 size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-zinc-900">
                vectorly
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                v0.1
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-medium text-zinc-700"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
              {backendOnline ? "API Online" : "API Offline"}
            </span>
          </div>
        </div>

        <div className="mt-6 border-b border-zinc-100 pb-4">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            {isRegister ? "Create an account" : "Sign in to workspace"}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {isRegister
              ? "Register to start indexing documents and running hybrid RAG queries."
              : "Enter your credentials to access your workspaces and knowledge bases."}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-1">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              !isRegister ? "bg-black text-white shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              isRegister ? "bg-black text-white shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {isRegister && (
            <div>
              <label className="text-xs font-medium text-zinc-600">Full Name</label>
              <input
                type="text"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-zinc-600">Email address</label>
            <input
              type="email"
              required
              placeholder="alex@vectorly.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Password (8+ chars)</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-2.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
          >
            {loading ? "Authenticating..." : isRegister ? "Create Account" : "Sign In to Workspace"}
          </button>
        </form>

        <div className="relative mt-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <span className="relative bg-white px-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            or quick start
          </span>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-40"
          >
            <Zap size={14} className="text-zinc-600" /> 1-Click Instant Demo Login
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-zinc-400">
            Auto-provisions demo session with starter knowledge base.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Other Tab Views
// ---------------------------------------------------------
function Evaluations() {
  return (
    <>
      <SectionHeading
        eyebrow="Quality Signals"
        title="Evaluations"
        description="Track whether retrieval is returning useful, grounded context."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Answer Faithfulness", "96.8%", "+2.1%"],
          ["Context Precision", "91.4%", "+4.8%"],
          ["Context Recall", "88.2%", "+1.7%"],
          ["P95 Latency", "412ms", "-8.4%"],
        ].map(([label, value, change]) => (
          <div key={label} className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-card">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
            <p className="mt-1 font-mono text-[11px] font-semibold text-zinc-600">
              {change} vs. last run
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function Settings() {
  const { user } = useAuth();
  return (
    <>
      <SectionHeading
        eyebrow="Workspace Controls"
        title="Settings"
        description="Configure your retrieval workspace and API preferences."
      />
      <div className="max-w-xl rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card">
        <h2 className="text-base font-bold tracking-tight text-zinc-900">API Connection</h2>
        <p className="mt-1 font-mono text-xs text-zinc-500">Backend URL: http://localhost:8000/api/v1</p>
        <div className="mt-4 space-y-2 text-xs text-zinc-600">
          <p>
            Status: <span className="font-semibold text-emerald-600">● Online</span>
          </p>
          <p>
            Active User: <span className="font-semibold text-zinc-900">{user?.email || "Not signed in"}</span>
          </p>
          <p>
            FastAPI Docs:{" "}
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-zinc-900 underline hover:text-black">
              http://localhost:8000/docs
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------
// Root Layout / Main Component
// ---------------------------------------------------------
export default function Home() {
  const { user, loading, backendOnline, logout } = useAuth();
  const [activeView, setActiveView] = useState<View>("Overview");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard shortcut: ⌘ K / Ctrl+K and ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowSearchModal(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white animate-pulse">
            <Layers3 size={20} />
          </div>
          <p className="font-mono text-xs text-zinc-500 tracking-wider">
            Initializing Vectorly workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const userInitials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "HB";

  const viewContent = {
    Overview: <Overview setView={setActiveView} />,
    "Ask your data": <AskData />,
    Documents: <Documents />,
    Projects: <Projects />,
    Evaluations: <Evaluations />,
    Activity: (
      <>
        <SectionHeading
          eyebrow="Workspace Log"
          title="Activity"
          description="A timeline of changes, queries, and processing events."
        />
        <ActivityList />
      </>
    ),
    Settings: <Settings />,
  };

  return (
    <main className="min-h-screen bg-[#f4f5f7] lg:flex">
      {/* Sidebar - Matching Reference Screenshot */}
      <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200/90 bg-white px-4 py-5 lg:min-h-screen lg:w-[224px] lg:border-b-0 lg:border-r">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white shadow-sm">
            <Layers3 size={18} strokeWidth={2.2} />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900">
            vectorly
          </span>
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[9px] font-semibold text-zinc-500">
            v0.1
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 hidden flex-1 lg:block">
          <nav className="space-y-1">
            <NavItem
              icon={LayoutDashboard}
              label="Overview"
              active={activeView === "Overview"}
              onClick={() => setActiveView("Overview")}
            />
            <NavItem
              icon={MessageSquareText}
              label="Ask your data"
              active={activeView === "Ask your data"}
              onClick={() => setActiveView("Ask your data")}
            />
            <NavItem
              icon={FileText}
              label="Documents"
              active={activeView === "Documents"}
              onClick={() => setActiveView("Documents")}
            />
            <NavItem
              icon={FolderKanban}
              label="Projects"
              active={activeView === "Projects"}
              onClick={() => setActiveView("Projects")}
            />
            <NavItem
              icon={BarChart3}
              label="Evaluations"
              active={activeView === "Evaluations"}
              onClick={() => setActiveView("Evaluations")}
            />
            <NavItem
              icon={Activity}
              label="Activity"
              active={activeView === "Activity"}
              onClick={() => setActiveView("Activity")}
            />
            <NavItem
              icon={Settings2}
              label="Settings"
              active={activeView === "Settings"}
              onClick={() => setActiveView("Settings")}
            />
          </nav>
        </div>

        {/* Sidebar Footer User Profile - Matches Screenshot */}
        <div className="hidden border-t border-zinc-100 px-2 pt-4 lg:block">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-zinc-900">{user.full_name || "Himanshu Bisht"}</p>
              <p className="truncate font-mono text-[10px] text-zinc-500">{user.email || "Admin"}</p>
            </div>
            <button onClick={logout} title="Sign out" className="text-zinc-400 hover:text-black transition">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Section */}
      <section className="min-w-0 flex-1">
        {/* Top Header - Matches Screenshot */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-200/90 bg-white/90 px-5 sm:px-8 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
              <span>Workspace</span>
              <span>/</span>
              <span className="font-semibold text-zinc-900">{activeView}</span>
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-medium text-zinc-700">
                <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                {backendOnline ? "API Online" : "API Offline"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input Button with ⌘ K shortcut */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:bg-white transition shadow-sm"
            >
              <Search size={14} className="text-zinc-400" />
              <span>Search knowledge...</span>
              <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500">
                ⌘ K
              </kbd>
            </button>

            {/* Notification Bell Circle */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-sm relative"
              >
                <Bell size={14} />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-elevated z-50">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                    <span className="text-xs font-bold text-zinc-900">Notifications</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-[10px] font-medium text-zinc-400 hover:text-zinc-800"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                      <p className="font-semibold text-zinc-900">Hybrid RRF Engine Online</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">BM25 + Semantic fusion ready for retrieval queries.</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                      <p className="font-semibold text-zinc-900">Workspace Connected</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Active session scoped to {user.email}.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar Circle -> Opens Settings */}
            <button
              onClick={() => setActiveView("Settings")}
              title="User Settings"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white shadow-sm hover:ring-2 hover:ring-zinc-400 transition"
            >
              {userInitials}
            </button>

            {/* Header Sign Out Button */}
            <button
              onClick={logout}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-black transition shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Mobile Navigation Strip */}
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 lg:hidden scrollbar-none">
          {[
            { id: "Overview", icon: LayoutDashboard },
            { id: "Ask your data", icon: MessageSquareText },
            { id: "Documents", icon: FileText },
            { id: "Projects", icon: FolderKanban },
            { id: "Evaluations", icon: BarChart3 },
            { id: "Activity", icon: Activity },
            { id: "Settings", icon: Settings2 },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as View)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                activeView === id
                  ? "bg-black text-white font-medium shadow-sm"
                  : "text-zinc-600 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <Icon size={14} />
              <span>{id}</span>
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-[1240px] px-5 py-6 sm:px-8 sm:py-8">
          {viewContent[activeView]}
        </div>
      </section>

      {/* Quick Search / Command Palette Modal (⌘ K) */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-sm"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-3">
              <Search size={16} className="text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search workspaces, documents, or jump to tabs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                ESC
              </kbd>
            </div>

            <div className="mt-3 space-y-1">
              <p className="px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Navigation Shortcuts
              </p>
              {[
                { label: "Dashboard / Overview", view: "Overview" as View, icon: LayoutDashboard },
                { label: "Ask your data (RAG Query)", view: "Ask your data" as View, icon: MessageSquareText },
                { label: "Documents & Files", view: "Documents" as View, icon: FileText },
                { label: "Project Workspaces", view: "Projects" as View, icon: FolderKanban },
                { label: "Evaluations & Benchmarks", view: "Evaluations" as View, icon: BarChart3 },
                { label: "Activity Timeline", view: "Activity" as View, icon: Activity },
                { label: "Settings & API Config", view: "Settings" as View, icon: Settings2 },
              ]
                .filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveView(item.view);
                      setShowSearchModal(false);
                      setSearchQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-black transition"
                  >
                    <item.icon size={15} className="text-zinc-400" />
                    <span>{item.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-400">Jump →</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
