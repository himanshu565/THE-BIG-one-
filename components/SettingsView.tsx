"use client";

import React, { useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, API_ROOT } from "@/lib/api";
import { SectionHeading } from "./SectionHeading";
import { View } from "./types";

export function SettingsView({ setView }: { setView?: (view: View) => void }) {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState<{ status: string; latency_ms: number } | null>(null);
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const handleTestHealth = async () => {
    setTestingHealth(true);
    setHealthError(null);
    const start = performance.now();
    try {
      const res = await api.health();
      const latency = Math.round(performance.now() - start);
      setHealthStatus({ status: res.status, latency_ms: latency });
    } catch (err: unknown) {
      setHealthError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setTestingHealth(false);
    }
  };

  return (
    <>
      <SectionHeading
        onBack={setView ? () => setView("Overview") : undefined}
        eyebrow="Workspace Controls"
        title="Settings"
        description="Configure your retrieval workspace and API preferences."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold tracking-tight text-zinc-900">API Connection & Health</h2>
            <button
              onClick={handleTestHealth}
              disabled={testingHealth}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-white hover:text-black transition shadow-sm"
            >
              <RefreshCw size={12} className={testingHealth ? "animate-spin" : ""} />
              {testingHealth ? "Testing..." : "Test API Health"}
            </button>
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">Endpoint: GET /health</p>
          <div className="mt-4 space-y-2 text-xs text-zinc-600">
            <p>
              Backend URL: <span className="font-mono text-zinc-800">{API_ROOT}</span>
            </p>
            {healthStatus ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Server Status: {healthStatus.status.toUpperCase()}
                </p>
                <p className="font-mono text-[11px] text-emerald-700 mt-0.5">Round-trip latency: {healthStatus.latency_ms}ms</p>
              </div>
            ) : healthError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {healthError}
              </div>
            ) : (
              <p>
                Click &quot;Test API Health&quot; above to probe server liveness.
              </p>
            )}
            <p className="pt-2">
              FastAPI Interactive Docs:{" "}
              <a href={`${API_ROOT}/docs`} target="_blank" rel="noreferrer" className="text-zinc-900 underline hover:text-black font-semibold">
                {API_ROOT}/docs
              </a>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card">
          <h2 className="text-base font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3">Authenticated Account</h2>
          <p className="mt-3 font-mono text-xs text-zinc-500">Endpoint: GET /api/v1/auth/me</p>
          <div className="mt-4 space-y-2.5 text-xs text-zinc-600">
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">Full Name</span>
              <span className="font-semibold text-zinc-900">{user?.full_name || "Demo Engineer"}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">Email Address</span>
              <span className="font-mono font-medium text-zinc-900">{user?.email || "demo@vectorly.ai"}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">User ID</span>
              <span className="font-mono text-zinc-700">#{user?.id || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Account Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Anti-Hack Defense Status */}
      <div className="mt-6 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">Security & Anti-Hack Shield</h2>
              <p className="text-xs text-zinc-500">Active real-world defensive engineering controls and OWASP protections</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All Defenses Armed
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
            <p className="font-mono text-[11px] font-bold text-zinc-900">Rate Limiter / Anti-DoS</p>
            <p className="mt-1 text-zinc-500 text-[11px]">Sliding-window IP throttles: 20/min Auth, 60/min Queries, 300/min Global.</p>
            <p className="mt-2 font-mono text-[10px] font-semibold text-emerald-600">✓ Throttles Brute-Force</p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
            <p className="font-mono text-[11px] font-bold text-zinc-900">OWASP Security Headers</p>
            <p className="mt-1 text-zinc-500 text-[11px]">HSTS preload, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff.</p>
            <p className="mt-2 font-mono text-[10px] font-semibold text-emerald-600">✓ Anti-Clickjacking & XSS</p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
            <p className="font-mono text-[11px] font-bold text-zinc-900">File Ingestion Guard</p>
            <p className="mt-1 text-zinc-500 text-[11px]">10 MB hard cap, extension whitelisting (.txt, .md, .pdf, .csv), magic header check.</p>
            <p className="mt-2 font-mono text-[10px] font-semibold text-emerald-600">✓ Anti-Traversal & Malware</p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
            <p className="font-mono text-[11px] font-bold text-zinc-900">Prompt Injection Guard</p>
            <p className="mt-1 text-zinc-500 text-[11px]">Adversarial delimiter neutralization (### System:, DAN, instruction bypass filters).</p>
            <p className="mt-2 font-mono text-[10px] font-semibold text-emerald-600">✓ Anti-Jailbreak Filter</p>
          </div>
        </div>
      </div>
    </>
  );
}
