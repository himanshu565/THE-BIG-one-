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
  LogIn,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
  UserCheck,
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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-white/[.08] text-white" : "text-muted hover:bg-white/[.04] hover:text-white"}`}
    >
      <Icon size={17} strokeWidth={1.7} />
      <span>{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-lime" />}
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
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[.18em] text-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" /> {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
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

  const stats = [
    {
      label: "Active project",
      value: activeProject ? activeProject.name : "None",
      change: activeProject ? "Online" : "Select",
      icon: FolderKanban,
    },
    {
      label: "Indexed knowledge",
      value: `${projects.length} workspaces`,
      change: "+Ready",
      icon: Database,
    },
    {
      label: "Retrieval mode",
      value: "Hybrid RRF",
      change: "BM25+Vector",
      icon: Gauge,
    },
    {
      label: "Grounded answers",
      value: "96.8%",
      change: "+2.1%",
      icon: Sparkles,
    },
  ];

  return (
    <>
      <SectionHeading
        eyebrow="System online"
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ""}.`}
        description="Your retrieval workspace and active project context at a glance."
        action={
          <button
            onClick={() => setView("Projects")}
            className="flex w-fit items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#e2ff8c]"
          >
            <Plus size={16} /> Manage projects
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, change, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-line bg-panel/80 p-5 shadow-glow"
          >
            <div className="mb-5 flex items-center justify-between text-muted">
              <span className="text-xs">{label}</span>
              <Icon size={16} />
            </div>
            <div className="flex items-end justify-between">
              <p className="font-display text-xl tracking-tight truncate">{value}</p>
              <span className="text-[11px] text-lime">
                {change}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[.16em] text-muted">
                <Zap size={14} className="text-lime" /> Retrieval workspace
              </p>
              <h2 className="font-display text-xl">Ask your knowledge base</h2>
            </div>
            <button
              onClick={() => setView("Ask your data")}
              className="text-muted hover:text-white"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="mt-6 rounded-lg border border-line bg-[#121617] p-3 transition focus-within:border-lime/50">
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
              className="min-h-[88px] w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-muted disabled:opacity-50"
            />
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs text-muted">
                Project: <span className="text-white">{activeProject?.name || "None"}</span>
              </span>
              <button
                onClick={handleRunQuery}
                disabled={!question.trim() || !activeProject || loading}
                className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-lime disabled:opacity-40"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? "Retrieving..." : "Run retrieval"}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {error}
            </div>
          )}
          {queryResult && (
            <div className="mt-4 rounded-lg border border-lime/30 bg-lime/[.06] p-4 text-sm">
              <div className="flex items-center justify-between text-lime">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} /> Grounded Answer ({queryResult.latency_ms}ms)
                </span>
                <span className="text-[11px] text-muted">{queryResult.retrieval_mode}</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-[#d8ddd4]">{queryResult.answer}</p>
              {queryResult.sources.length > 0 && (
                <div className="mt-3 border-t border-line/60 pt-3">
                  <p className="text-[11px] font-medium text-muted">Top Citation:</p>
                  <p className="text-xs text-white">
                    {queryResult.sources[0].document_name} · chunk {queryResult.sources[0].chunk_index}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-5 flex items-center gap-2 text-[11px] text-muted">
            <Database size={13} /> Hybrid search <span className="text-line">•</span> Top 5 chunks{" "}
            <span className="text-line">•</span> RRF ranking
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[.16em] text-muted">
                Your Projects
              </p>
              <h2 className="font-display text-xl">{activeProject ? activeProject.name : "Select a project"}</h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {projects.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted border border-line rounded-lg">
                No projects yet. Click &quot;Manage projects&quot; above to create your first workspace.
              </div>
            ) : (
              projects.map((project, idx) => (
                <button
                  key={project.id}
                  onClick={() => setActiveProject(project)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${activeProject?.id === project.id ? "border-lime/40 bg-lime/[.06]" : "border-transparent bg-[#121617] hover:border-line"}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${idx % 2 === 0 ? "bg-lime" : "bg-cyan"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{project.name}</span>
                    <span className="mt-1 block text-[11px] text-muted truncate">
                      {project.description || "Workspace knowledge base"}
                    </span>
                  </span>
                  {activeProject?.id === project.id && (
                    <ArrowUpRight size={15} className="text-lime" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      <ActivityList setView={setView} />
    </>
  );
}

function ActivityList({ setView }: { setView?: (view: View) => void }) {
  const activityItems = [
    { title: "RAG hybrid retrieval", detail: "BM25 + Semantic fusion active", type: "query", status: "Ready" },
    { title: "JWT authentication", detail: "Secured project authorization", type: "setting", status: "Completed" },
    { title: "Document chunking", detail: "Multi-format parser connected", type: "document", status: "Ready" },
  ];
  return (
    <div className="mt-6 rounded-xl border border-line bg-panel/80 p-5 shadow-glow sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[.16em] text-muted">Latest activity</p>
          <h2 className="font-display text-xl">What&apos;s happening</h2>
        </div>
        {setView && (
          <button
            onClick={() => setView("Activity")}
            className="flex items-center gap-1 text-xs text-muted hover:text-white"
          >
            View all <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <div className="divide-y divide-line">
        {activityItems.map((item) => (
          <div key={item.title} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
              <Zap size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{item.title}</p>
              <p className="mt-1 text-xs text-muted">{item.detail}</p>
            </div>
            <span className="rounded-full bg-lime/10 px-2.5 py-1 text-[10px] text-lime">
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

  // Quick text doc modal state
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
        eyebrow="Knowledge base"
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
            className="flex w-fit items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#e2ff8c] disabled:opacity-40"
          >
            <FilePlus2 size={16} /> Upload documents
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      {showUploadModal && (
        <div className="mb-6 rounded-xl border border-lime/30 bg-[#121617] p-5 shadow-glow">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <UploadCloud className="text-lime" size={24} />
              <div>
                <h3 className="text-sm font-semibold">Upload document to {activeProject?.name}</h3>
                <p className="text-xs text-muted">
                  Supported formats: PDF, Markdown (.md), TXT, and CSV. Files are chunked automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadModal(false)}
              className="text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border border-dashed border-line bg-panel/60 p-6 text-center transition hover:border-lime/50"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md,.pdf,.csv"
              />
              <Upload size={24} className="mx-auto text-lime" />
              <p className="mt-3 text-xs font-medium text-white">Click to browse file</p>
              <p className="mt-1 text-[11px] text-muted">PDF, MD, TXT, or CSV</p>
              {uploading && <p className="mt-2 text-xs text-lime">Uploading and indexing...</p>}
            </div>

            <form onSubmit={handleCreateTextDoc} className="space-y-3 rounded-lg border border-line bg-panel/60 p-4">
              <p className="text-xs font-medium text-white">Or write direct text / markdown:</p>
              <input
                type="text"
                placeholder="Document title (e.g. runbook.md)"
                value={textDocName}
                onChange={(e) => setTextDocName(e.target.value)}
                className="w-full rounded border border-line bg-[#121617] px-3 py-1.5 text-xs text-white outline-none focus:border-lime/50"
              />
              <textarea
                placeholder="Paste documentation text or markdown content..."
                value={textDocContent}
                onChange={(e) => setTextDocContent(e.target.value)}
                rows={3}
                className="w-full rounded border border-line bg-[#121617] p-2 text-xs text-white outline-none focus:border-lime/50 resize-none"
              />
              <button
                type="submit"
                disabled={uploading || !textDocName.trim() || !textDocContent.trim()}
                className="rounded bg-lime px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
              >
                Save & Index
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Total files", docs.length.toString()],
          [
            "Indexed chunks",
            docs.reduce((sum, d) => sum + d.chunk_count, 0).toLocaleString(),
          ],
          ["Status", activeProject ? "Connected" : "No project"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-panel/80 p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-2 font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-panel/80 shadow-glow">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative flex-1 sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-line bg-[#121617] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-lime/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-line bg-[#121617] px-3 py-2 text-xs text-muted outline-none"
            >
              <option>All files</option>
              <option>Ready</option>
              <option>Processing</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-muted">
            <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-lime" />
            Loading documents...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {activeProject
              ? "No documents in this project yet. Click 'Upload documents' above."
              : "Please select an active project first."}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="grid gap-3 px-4 py-4 transition hover:bg-white/[.02] md:grid-cols-[minmax(0,1.7fr)_80px_100px_110px_120px_32px] md:items-center md:gap-4 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="mt-1 text-[11px] text-muted md:hidden">
                      {doc.file_type.toUpperCase()} · {doc.chunk_count} chunks · {doc.status}
                    </p>
                  </div>
                </div>
                <span className="hidden text-xs text-muted uppercase md:block">
                  {doc.file_type}
                </span>
                <span className="hidden text-xs text-muted md:block">
                  {Math.max(1, Math.round(doc.file_size / 1024))} KB
                </span>
                <span className="hidden text-xs text-muted md:block">
                  {doc.chunk_count} chunks
                </span>
                <span className="flex w-fit items-center gap-1.5 rounded-full bg-lime/10 px-2.5 py-1 text-[10px] text-lime">
                  <CheckCircle2 size={12} /> {doc.status}
                </span>
                <button
                  onClick={() => handleDelete(doc.id)}
                  title="Delete document"
                  className="hidden text-muted hover:text-red-400 md:block"
                >
                  <Trash2 size={16} />
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
        eyebrow="Retrieval workspace"
        title="Ask your data"
        description="Search across your indexed knowledge with verified grounded answers and citations."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel/80 px-3 py-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-lime" />
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                const found = projects.find((p) => p.id === Number(e.target.value));
                if (found) setActiveProject(found);
              }}
              className="bg-transparent text-white outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-panel text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-line bg-panel/80 p-5 shadow-glow sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime/10 text-lime">
              <Sparkles size={19} />
            </div>
            <div>
              <h2 className="font-display text-xl">New question</h2>
              <p className="text-xs text-muted">
                Answers cite the exact source documents and chunk indexes.
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
            className="min-h-[140px] w-full resize-none rounded-lg border border-line bg-[#121617] p-4 text-sm text-white outline-none placeholder:text-muted focus:border-lime/50 disabled:opacity-40"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <SlidersHorizontal size={14} /> Mode:
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "hybrid" | "bm25" | "semantic")}
                className="rounded border border-line bg-[#121617] px-2 py-1 text-xs text-white outline-none"
              >
                <option value="hybrid">Hybrid (BM25 + Semantic RRF)</option>
                <option value="bm25">Lexical BM25 Only</option>
                <option value="semantic">Semantic Vector Only</option>
              </select>
            </div>
            <button
              onClick={handleAsk}
              disabled={!question.trim() || !activeProject || loading}
              className="flex items-center gap-2 rounded-md bg-lime px-4 py-2.5 text-xs font-semibold text-ink hover:bg-[#e2ff8c] disabled:opacity-40"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? "Synthesizing..." : "Generate answer"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {response && (
            <div className="mt-6 border-t border-line pt-6">
              <div className="mb-3 flex items-center justify-between text-sm text-lime font-medium">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} /> Grounded answer ready
                </span>
                <span className="text-xs text-muted">Latency: {response.latency_ms}ms</span>
              </div>
              <p className="text-sm leading-7 text-[#d8ddd4]">{response.answer}</p>
              {response.sources.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-medium text-muted">Retrieved Sources:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {response.sources.map((s, idx) => (
                      <div key={idx} className="rounded-lg border border-line bg-[#121617] p-3 text-xs">
                        <p className="text-lime font-medium">
                          Source {idx + 1} (Score: {s.score.toFixed(4)})
                        </p>
                        <p className="mt-1 text-white font-medium">
                          {s.document_name} · chunk {s.chunk_index}
                        </p>
                        <p className="mt-1 text-muted text-[11px] line-clamp-2">
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

        <div className="rounded-xl border border-line bg-panel/80 p-5 shadow-glow sm:p-7">
          <p className="text-xs uppercase tracking-[.16em] text-muted">Retrieval Health</p>
          <div className="mt-6 space-y-5">
            {[
              ["BM25 Lexical Index", "Online", "100%"],
              ["Vector Similarity", "Online", "98.7%"],
              ["RRF Rank Fusion", "Enabled", "k=60"],
            ].map(([label, status, val]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="text-lime">{status}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[.08]">
                  <div className="h-full rounded-full bg-lime" style={{ width: "95%" }} />
                </div>
                <p className="mt-1 text-right text-[11px] text-muted">{val}</p>
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
        eyebrow="Workspace"
        title="Projects"
        description="Organize knowledge bases and keep retrieval contexts focused."
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex w-fit items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#e2ff8c]"
          >
            <Plus size={16} /> Create project
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      {showCreateModal && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-lime/40 bg-[#121617] p-5 shadow-glow">
          <h3 className="text-sm font-semibold text-white">Create new project workspace</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Project Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Platform docs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs text-white outline-none focus:border-lime/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief summary of documents"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs text-white outline-none focus:border-lime/50"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-lg bg-lime px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
            >
              {loading ? "Creating..." : "Save Project"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, idx) => (
          <div
            key={project.id}
            className={`rounded-xl border p-5 shadow-glow transition ${activeProject?.id === project.id ? "border-lime/50 bg-panel" : "border-line bg-panel/80"}`}
          >
            <div className="flex items-start justify-between">
              <span className={`h-3 w-3 rounded-full ${idx % 2 === 0 ? "bg-lime" : "bg-cyan"}`} />
              <button
                onClick={() => handleDelete(project.id)}
                title="Delete project"
                className="text-muted hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <h2 className="mt-5 font-display text-xl">{project.name}</h2>
            <p className="mt-2 text-xs leading-5 text-muted line-clamp-2">
              {project.description || "Knowledge workspace for documents and retrieval queries."}
            </p>
            <div className="mt-6 border-t border-line pt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted">
                Created {new Date(project.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => setActiveProject(project)}
                className={`text-xs font-semibold flex items-center gap-1 ${activeProject?.id === project.id ? "text-lime" : "text-muted hover:text-white"}`}
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
// Auth Modal (Login / Register / Quick Demo)
// ---------------------------------------------------------
function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register, quickDemoLogin } = useAuth();
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
      onClose();
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
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-6 shadow-2xl">
        <h2 className="font-display text-xl font-medium text-white">
          {isRegister ? "Create Vectorly Account" : "Sign in to Vectorly"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          Connect your authenticated session to the FastAPI backend.
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {isRegister && (
            <div>
              <label className="text-[11px] text-muted">Full Name</label>
              <input
                type="text"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded border border-line bg-[#121617] px-3 py-2 text-xs text-white outline-none focus:border-lime/50"
              />
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted">Email address</label>
            <input
              type="email"
              required
              placeholder="alex@vectorly.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-line bg-[#121617] px-3 py-2 text-xs text-white outline-none focus:border-lime/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted">Password (8+ chars)</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-line bg-[#121617] px-3 py-2 text-xs text-white outline-none focus:border-lime/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded bg-lime py-2 text-xs font-semibold text-ink hover:bg-[#e2ff8c] disabled:opacity-40"
          >
            {loading ? "Processing..." : isRegister ? "Register Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 border-t border-line pt-4 text-center">
          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full rounded border border-lime/40 bg-lime/[.08] py-2 text-xs font-semibold text-lime hover:bg-lime/[.14]"
          >
            ⚡ 1-Click Demo Login
          </button>
          <div className="mt-3 flex justify-between text-[11px] text-muted">
            <button onClick={() => setIsRegister(!isRegister)} className="hover:text-white underline">
              {isRegister ? "Already registered? Sign in" : "Need an account? Register"}
            </button>
            <button onClick={onClose} className="hover:text-white">
              Cancel
            </button>
          </div>
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
        eyebrow="Quality signals"
        title="Evaluations"
        description="Track whether retrieval is returning useful, grounded context."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Answer faithfulness", "96.8%", "+2.1%"],
          ["Context precision", "91.4%", "+4.8%"],
          ["Context recall", "88.2%", "+1.7%"],
          ["P95 latency", "412ms", "-8.4%"],
        ].map(([label, value, change]) => (
          <div key={label} className="rounded-xl border border-line bg-panel/80 p-5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-4 font-display text-2xl">{value}</p>
            <p className={`mt-2 text-[11px] ${change.startsWith("-") ? "text-cyan" : "text-lime"}`}>
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
        eyebrow="Workspace controls"
        title="Settings"
        description="Configure your retrieval workspace and API preferences."
      />
      <div className="rounded-xl border border-line bg-panel/80 p-6 shadow-glow max-w-xl">
        <h2 className="font-display text-xl text-white">API Connection</h2>
        <p className="mt-1 text-xs text-muted">Backend URL: http://localhost:8000/api/v1</p>
        <div className="mt-4 space-y-2 text-xs text-muted">
          <p>
            Status: <span className="text-lime">Online</span>
          </p>
          <p>
            Active User: <span className="text-white">{user?.email || "Not signed in"}</span>
          </p>
          <p>
            FastAPI Docs:{" "}
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-lime underline">
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
  const { user, backendOnline, logout } = useAuth();
  const [activeView, setActiveView] = useState<View>("Overview");
  const [showAuthModal, setShowAuthModal] = useState(false);

  const viewContent = {
    Overview: <Overview setView={setActiveView} />,
    "Ask your data": <AskData />,
    Documents: <Documents />,
    Projects: <Projects />,
    Evaluations: <Evaluations />,
    Activity: (
      <>
        <SectionHeading
          eyebrow="Workspace log"
          title="Activity"
          description="A timeline of changes, queries, and processing events."
        />
        <ActivityList />
      </>
    ),
    Settings: <Settings />,
  };

  return (
    <main className="grid-texture min-h-screen lg:flex">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <aside className="flex w-full shrink-0 flex-col border-b border-line bg-[#121617]/90 px-4 py-5 lg:min-h-screen lg:w-[238px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-ink">
            <Layers3 size={18} strokeWidth={2.4} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            vectorly
          </span>
          <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted">
            beta
          </span>
        </div>

        <div className="mt-9 hidden flex-1 lg:block">
          <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[.18em] text-muted">
            Workspace
          </p>
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
          </nav>
          <p className="mb-3 mt-9 px-3 text-[10px] font-medium uppercase tracking-[.18em] text-muted">
            Observe
          </p>
          <nav className="space-y-1">
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
          </nav>
        </div>

        <div className="hidden space-y-1 lg:block">
          <NavItem
            icon={Settings2}
            label="Settings"
            active={activeView === "Settings"}
            onClick={() => setActiveView("Settings")}
          />

          <div className="mt-5 border-t border-line px-3 pt-5">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-xs font-semibold text-ink">
                  {user.full_name ? user.full_name.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{user.full_name || "User"}</p>
                  <p className="truncate text-[11px] text-muted">{user.email}</p>
                </div>
                <button onClick={logout} title="Sign out" className="text-muted hover:text-white">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded bg-lime/[.1] py-2 text-xs font-semibold text-lime hover:bg-lime/[.2]"
              >
                <LogIn size={14} /> Sign in / Register
              </button>
            )}
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex h-[76px] items-center justify-between border-b border-line px-5 sm:px-8">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">Workspace</span>
            <span className="text-line">/</span>
            <span className="text-white">{activeView}</span>
            <span
              className={`ml-3 rounded-full px-2 py-0.5 text-[10px] font-medium ${backendOnline ? "bg-lime/10 text-lime" : "bg-white/[.08] text-muted"}`}
            >
              {backendOnline ? "● API Online" : "○ API Ready"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!user ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-lime px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#e2ff8c]"
              >
                <UserCheck size={14} /> Sign In
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="hidden sm:inline text-white font-medium">{user.email}</span>
                <button
                  onClick={logout}
                  className="rounded border border-line px-2 py-1 hover:text-white"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
          {viewContent[activeView]}
        </div>
      </section>
    </main>
  );
}
