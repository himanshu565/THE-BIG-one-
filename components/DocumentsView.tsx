"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, Document as DocumentItem, DocumentDetail } from "@/lib/api";
import { SectionHeading } from "./SectionHeading";
import { View } from "./types";

export function DocumentsView({ setView }: { setView?: (view: View) => void }) {
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
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [inspectingDoc, setInspectingDoc] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!activeProject) {
      setDocs([]);
      return;
    }
    setLoading(true);
    try {
      const list = await api.documents.list(activeProject.id);
      setDocs(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  const handleInspectDoc = async (docId: number) => {
    if (!activeProject) return;
    setInspectingDoc(true);
    setError(null);
    try {
      const detail = await api.documents.get(activeProject.id, docId);
      setSelectedDoc(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load document details");
    } finally {
      setInspectingDoc(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

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
        onBack={setView ? () => setView("Overview") : undefined}
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
                className="grid gap-3 px-5 py-4 transition hover:bg-zinc-50/60 md:grid-cols-[minmax(0,1.7fr)_80px_100px_110px_120px_56px] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <button
                      onClick={() => handleInspectDoc(doc.id)}
                      className="truncate text-left text-xs font-semibold text-zinc-900 hover:underline block"
                    >
                      {doc.name}
                    </button>
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleInspectDoc(doc.id)}
                    disabled={inspectingDoc}
                    title="Inspect chunks"
                    className="text-zinc-400 hover:text-black disabled:opacity-40 transition"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                    className="text-zinc-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document & Chunks Inspector Modal (GET /projects/{project_id}/documents/{document_id}) */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">{selectedDoc.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">
                    ID #{selectedDoc.id} · {selectedDoc.file_type.toUpperCase()} · {Math.max(1, Math.round(selectedDoc.file_size / 1024))} KB · {selectedDoc.chunks?.length || 0} chunks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:text-black hover:border-zinc-300 transition"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Indexed Text Chunks ({selectedDoc.chunks?.length || 0})
              </p>
              {selectedDoc.chunks && selectedDoc.chunks.length > 0 ? (
                selectedDoc.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-zinc-600">
                      <span className="font-mono font-semibold text-zinc-900">
                        Chunk #{chunk.chunk_index}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {chunk.token_count} tokens · ID #{chunk.id}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] leading-5 text-zinc-700 whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-zinc-200/80">
                      {chunk.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500">No chunks indexed for this document.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
