const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  project_id: number;
  name: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

export interface SourceCitation {
  document_id: number;
  document_name: string;
  chunk_id: number;
  chunk_index: number;
  content: string;
  score: number;
}

export interface QueryResponse {
  question: string;
  answer: string;
  sources: SourceCitation[];
  retrieval_mode: string;
  provider: string;
  model: string;
  latency_ms: number;
}

const TOKEN_KEY = "vectorly_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error("Unauthorized. Please log in.");
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      data?.detail && typeof data.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  auth: {
    async register(email: string, password: string, fullName?: string): Promise<User> {
      return request<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
    },
    async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
      const data = await request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      return data;
    },
    async getMe(): Promise<User> {
      return request<User>("/auth/me");
    },
    logout(): void {
      clearToken();
    },
  },

  projects: {
    async list(): Promise<Project[]> {
      return request<Project[]>("/projects");
    },
    async create(name: string, description?: string): Promise<Project> {
      return request<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
    },
    async delete(id: number): Promise<void> {
      return request<void>(`/projects/${id}`, {
        method: "DELETE",
      });
    },
  },

  documents: {
    async list(projectId: number, status?: string): Promise<DocumentItem[]> {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return request<DocumentItem[]>(`/projects/${projectId}/documents${query}`);
    },
    async upload(projectId: number, file: File): Promise<DocumentItem> {
      const formData = new FormData();
      formData.append("file", file);
      return request<DocumentItem>(`/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
    },
    async create(projectId: number, name: string, content: string, fileType: string = "txt"): Promise<DocumentItem> {
      return request<DocumentItem>(`/projects/${projectId}/documents`, {
        method: "POST",
        body: JSON.stringify({ name, content, file_type: fileType }),
      });
    },
    async delete(projectId: number, documentId: number): Promise<void> {
      return request<void>(`/projects/${projectId}/documents/${documentId}`, {
        method: "DELETE",
      });
    },
  },

  retrieval: {
    async query(projectId: number, question: string, topK: number = 5, mode: string = "hybrid"): Promise<QueryResponse> {
      return request<QueryResponse>(`/projects/${projectId}/query`, {
        method: "POST",
        body: JSON.stringify({ question, top_k: topK, mode }),
      });
    },
    async search(projectId: number, question: string, topK: number = 5, mode: string = "hybrid"): Promise<SourceCitation[]> {
      return request<SourceCitation[]>(`/projects/${projectId}/search`, {
        method: "POST",
        body: JSON.stringify({ question, top_k: topK, mode }),
      });
    },
  },
};

