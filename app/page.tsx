"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Search,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_ROOT } from "@/lib/api";
import { View } from "@/components/types";
import { NavItem } from "@/components/NavItem";
import { OverviewView } from "@/components/OverviewView";
import { AskDataView } from "@/components/AskDataView";
import { DocumentsView } from "@/components/DocumentsView";
import { ProjectsView } from "@/components/ProjectsView";
import { EvaluationsView } from "@/components/EvaluationsView";
import { ActivityView } from "@/components/ActivityView";
import { SettingsView } from "@/components/SettingsView";
import { AuthScreen } from "@/components/AuthScreen";

export default function Home() {
  const { user, loading, setLoading, backendOnline, logout, quickDemoLogin } = useAuth();
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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] p-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200/90 bg-white p-7 text-center shadow-elevated">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-sm">
            <Layers3 size={20} className="animate-pulse" />
          </div>
          <h2 className="mt-4 text-base font-bold text-zinc-900">
            Initializing Vectorly workspace...
          </h2>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            Connecting to backend API ({API_ROOT})
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => setLoading(false)}
              className="w-full rounded-lg bg-black py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 transition"
            >
              Continue to Sign In / Register →
            </button>
            <button
              onClick={async () => {
                setLoading(false);
                try {
                  await quickDemoLogin();
                } catch {}
              }}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 transition"
            >
              ⚡ 1-Click Instant Demo Login
            </button>
          </div>
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
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "US";

  const viewContent: Record<View, React.ReactNode> = {
    "Overview": <OverviewView setView={setActiveView} />,
    "Ask your data": <AskDataView setView={setActiveView} />,
    "Documents": <DocumentsView setView={setActiveView} />,
    "Projects": <ProjectsView setView={setActiveView} />,
    "Evaluations": <EvaluationsView setView={setActiveView} />,
    "Activity": <ActivityView setView={setActiveView} />,
    "Settings": <SettingsView setView={setActiveView} />,
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
              <p className="truncate text-xs font-bold text-zinc-900">{user.full_name || user.email.split("@")[0] || "User"}</p>
              <p className="truncate font-mono text-[10px] text-zinc-500">{user.email || "Active User"}</p>
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
              <button
                onClick={() => setActiveView("Overview")}
                className="hover:text-black transition cursor-pointer"
              >
                Workspace
              </button>
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
