"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, Project, User } from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setLoading: (l: boolean) => void;
  backendOnline: boolean;
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
  refreshProjects: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => void;
  quickDemoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setLoading: () => {},
  backendOnline: false,
  projects: [],
  activeProject: null,
  setActiveProject: () => {},
  refreshProjects: async () => {},
  login: async () => {},
  register: async () => {},
  logout: () => {},
  quickDemoLogin: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Check backend liveness and current user with strict 1.2s safety timeout
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: NEVER let the UI hang on loading for more than 1.2 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1200);

    async function init() {
      // 1. Check health with 1s abort signal
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 1000);

      try {
        const res = await fetch("http://localhost:8000/health", {
          signal: healthController.signal,
          mode: "cors",
        });
        clearTimeout(healthTimeout);
        if (res.ok && isMounted) {
          setBackendOnline(true);
        }
      } catch {
        clearTimeout(healthTimeout);
        if (isMounted) setBackendOnline(false);
      }

      // 2. Check token if present
      const token = getToken();
      if (!token) {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await Promise.race([
          api.auth.getMe(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Token check timeout")), 1200)
          ),
        ]);

        if (profile && isMounted) {
          setUser(profile);
          try {
            const userProjects = await api.projects.list();
            if (isMounted) {
              setProjects(userProjects);
              if (userProjects.length > 0) {
                setActiveProject(userProjects[0]);
              }
            }
          } catch {
            // Keep empty projects on project load failure
          }
        }
      } catch {
        clearToken();
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  async function refreshProjects() {
    try {
      const userProjects = await api.projects.list();
      setProjects(userProjects);
      if (userProjects.length > 0) {
        setActiveProject((prev) => {
          if (!prev) return userProjects[0];
          const exists = userProjects.find((p) => p.id === prev.id);
          return exists || userProjects[0];
        });
      } else {
        setActiveProject(null);
      }
    } catch {
      // Fallback
    }
  }

  async function login(email: string, pass: string) {
    await api.auth.login(email, pass);
    const profile = await api.auth.getMe();
    setUser(profile);
    await refreshProjects();
  }

  async function register(email: string, pass: string, name?: string) {
    await api.auth.register(email, pass, name);
    await login(email, pass);
  }

  function logout() {
    api.auth.logout();
    setUser(null);
    setProjects([]);
    setActiveProject(null);
  }

  async function quickDemoLogin() {
    const demoEmail = "demo@vectorly.ai";
    const demoPass = "password123";
    try {
      await login(demoEmail, demoPass);
    } catch {
      // If demo user does not exist yet, register and login
      try {
        await register(demoEmail, demoPass, "Demo Engineer");
        // Create an initial starter project if none exists
        const newProj = await api.projects.create(
          "Platform docs",
          "Internal architecture and retrieval engineering documentation",
        );
        // Upload initial sample document
        await api.documents.create(
          newProj.id,
          "architecture-overview.md",
          "# Vectorly System Architecture\n\nVectorly is a retrieval-aware AI infrastructure platform.\n\nOur RAG latency budget is strictly 200 milliseconds.\nAnswer grounding threshold requires 95% faithfulness against source chunks.\nHybrid retrieval combines BM25 lexical search with dense vector similarity using Reciprocal Rank Fusion (RRF).\nAll embeddings are generated using local development models.",
          "md",
        );
        await refreshProjects();
      } catch (err: unknown) {
        throw err instanceof Error ? err : new Error("Failed to initialize demo account");
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setLoading,
        backendOnline,
        projects,
        activeProject,
        setActiveProject,
        refreshProjects,
        login,
        register,
        logout,
        quickDemoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
