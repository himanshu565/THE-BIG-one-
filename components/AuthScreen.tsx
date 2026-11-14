"use client";

import React, { useState } from "react";
import { Layers3, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function AuthScreen() {
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
