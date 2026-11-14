"use client";

import React, { useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, Project } from "@/lib/api";
import { SectionHeading } from "./SectionHeading";
import { View } from "./types";

export function ProjectsView({ setView }: { setView?: (view: View) => void }) {
  const { projects, refreshProjects, activeProject, setActiveProject } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = async (project: Project) => {
    setError(null);
    try {
      const fresh = await api.projects.get(project.id);
      setEditingProject(fresh);
      setEditName(fresh.name);
      setEditDesc(fresh.description || "");
    } catch {
      setEditingProject(project);
      setEditName(project.name);
      setEditDesc(project.description || "");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    setEditLoading(true);
    setError(null);
    try {
      const updated = await api.projects.update(editingProject.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditingProject(null);
      await refreshProjects();
      if (activeProject?.id === updated.id) {
        setActiveProject(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setEditLoading(false);
    }
  };

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
        onBack={setView ? () => setView("Overview") : undefined}
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

      {/* Edit Project Modal (PATCH /projects/{project_id} & GET /projects/{project_id}) */}
      {editingProject && (
        <form onSubmit={handleUpdate} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-elevated">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-bold text-zinc-900">Edit Project Workspace</h3>
            <span className="font-mono text-xs text-zinc-400">ID #{editingProject.id}</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600">Project Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Description (optional)</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={editLoading || !editName.trim()}
              className="rounded-lg bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditingProject(null)}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartEdit(project)}
                  title="Edit project"
                  className="text-zinc-400 hover:text-black transition"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  title="Delete project"
                  className="text-zinc-400 hover:text-red-500 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
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
