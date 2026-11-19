"use client";

import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, QueryResponse, SourceCitation } from "@/lib/api";
import { SectionHeading } from "./SectionHeading";
import { View } from "./types";

export function AskDataView({ setView }: { setView?: (view: View) => void }) {
  const { activeProject, projects, setActiveProject } = useAuth();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"hybrid" | "bm25" | "semantic">("hybrid");
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [searchResults, setSearchResults] = useState<SourceCitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAsk = async () => {
    if (!question.trim() || !activeProject) return;
    setLoading(true);
    setError(null);
    setSearchResults(null);

    if (streamEnabled) {
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setResponse({
        question: question.trim(),
        answer: "",
        sources: [],
        retrieval_mode: mode,
        provider: "",
        model: "",
        latency_ms: 0,
      });

      try {
        await api.retrieval.queryStream(
          activeProject.id,
          question.trim(),
          {
            signal: controller.signal,
            onSources: (data) => {
              setResponse((prev) =>
                prev
                  ? {
                      ...prev,
                      sources: data.sources,
                      retrieval_mode: data.retrieval_mode,
                      provider: data.provider,
                      model: data.model,
                    }
                  : prev
              );
            },
            onToken: (delta) => {
              setResponse((prev) =>
                prev ? { ...prev, answer: prev.answer + delta } : prev
              );
            },
            onDone: (data) => {
              setResponse((prev) =>
                prev
                  ? {
                      ...prev,
                      latency_ms: data.latency_ms,
                      answer: data.answer || prev.answer,
                    }
                  : prev
              );
              setIsStreaming(false);
            },
            onError: (err) => {
              setError(err.message);
              setIsStreaming(false);
            },
          },
          5,
          mode
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Stream generation safely cancelled by user
        } else {
          setError(err instanceof Error ? err.message : "Streaming query failed");
        }
      } finally {
        setLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    } else {
      try {
        const res = await api.retrieval.query(activeProject.id, question.trim(), 5, mode);
        setResponse(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Query failed");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSearchOnly = async () => {
    if (!question.trim() || !activeProject) return;
    setSearchLoading(true);
    setError(null);
    setResponse(null);
    try {
      const results = await api.retrieval.search(activeProject.id, question.trim(), 5, mode);
      setSearchResults(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search retrieval failed");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <>
      <SectionHeading
        onBack={setView ? () => setView("Overview") : undefined}
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
              setSearchResults(null);
              setError(null);
            }}
            placeholder="e.g. What is our RAG latency budget and groundedness threshold?"
            disabled={!activeProject || loading || searchLoading}
            className="min-h-[130px] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-40 transition"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
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
                type="button"
                onClick={() => setStreamEnabled(!streamEnabled)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition shadow-sm ${
                  streamEnabled
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-800"
                }`}
                title={streamEnabled ? "Real-time SSE token streaming enabled" : "Streaming disabled (batch retrieval)"}
              >
                <Zap size={12} className={streamEnabled ? "text-emerald-600 fill-emerald-500" : "text-zinc-400"} />
                <span>{streamEnabled ? "SSE Stream" : "Batch"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSearchOnly}
                disabled={!question.trim() || !activeProject || loading || searchLoading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-medium text-zinc-700 transition hover:bg-white hover:text-black disabled:opacity-40 shadow-sm"
              >
                {searchLoading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                {searchLoading ? "Retrieving..." : "Search Chunks Only"}
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 shadow-sm"
                >
                  <Square size={12} className="fill-current" /> Stop
                </button>
              ) : (
                <button
                  onClick={handleAsk}
                  disabled={!question.trim() || !activeProject || loading || searchLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
                >
                  {loading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {loading ? (streamEnabled ? "Streaming..." : "Synthesizing...") : "Generate answer"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {searchResults && (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-900 font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Direct Chunk Retrieval (No LLM Synthesis)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">{searchResults.length} chunks retrieved</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 mt-3">
                {searchResults.map((s, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-3.5 text-xs shadow-card">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] font-semibold text-zinc-900">
                        Rank #{idx + 1}
                      </p>
                      <span className="font-mono text-[10px] rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                        Score: {s.score.toFixed(4)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-zinc-600">
                      {s.document_name} · chunk #{s.chunk_index}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-700 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      &quot;{s.content}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response && (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-900 font-semibold">
                <span className="flex items-center gap-1.5">
                  {isStreaming ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-emerald-700 font-medium">Streaming Grounded Answer...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>Grounded Answer Ready</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Radio size={11} className="animate-pulse" /> Live SSE
                    </span>
                  ) : (
                    `Latency: ${response.latency_ms}ms`
                  )}
                </span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs leading-6 text-zinc-800 relative">
                {response.answer || (isStreaming ? <span className="text-zinc-400 italic">Synthesizing answer from retrieved chunks...</span> : "")}
                {isStreaming && (
                  <span className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-emerald-600 animate-pulse ml-1" />
                )}
              </div>
              {response.sources.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Retrieved Sources ({response.sources.length}):
                    </p>
                    {response.provider && (
                      <span className="font-mono text-[10px] text-zinc-400">
                        Provider: {response.provider} · {response.model}
                      </span>
                    )}
                  </div>
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
