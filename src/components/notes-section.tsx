"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { preserveNewlines } from "@/lib/markdown";
import { formatDateTime } from "@/lib/match";
import ExpandableTextarea from "@/components/expandable-textarea";

interface NotesSectionProps {
  notes?: string;
  updatedAt?: string;
  readOnly?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  title?: string;
  onSave?: (notes: string | null) => Promise<void>;
}

export default function NotesSection({
  notes,
  updatedAt,
  readOnly = false,
  placeholder = "How did the match go?",
  emptyMessage = "Add private notes that only you can see.",
  title = "Notes",
  onSave,
}: NotesSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleEdit = () => {
    setEditValue(notes ?? "");
    setError("");
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError("");
  };

  // Throws on error; callers should pass an onSave that throws with a user-facing message.
  const handleSave = async () => {
    if (!onSave) return;
    setError("");
    setSaving(true);
    try {
      await onSave(editValue.trim() || null);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h2>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Private to you.{" "}
          <a
            href="https://www.markdownguide.org/basic-syntax/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-stone-600 dark:hover:text-stone-300"
          >
            Markdown
          </a>{" "}
          supported.
        </p>
        <ExpandableTextarea
          value={editValue}
          onChange={setEditValue}
          disabled={saving}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded-lg border border-stone-300 bg-white pl-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h2>
        {!readOnly && (
          <button
            onClick={handleEdit}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {notes ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {notes ? (
        <>
          <div className="mt-2 border-l-2 border-purple-400 pl-4 dark:border-purple-600">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-purple-500 dark:text-purple-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="size-3"
              >
                <path
                  fillRule="evenodd"
                  d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v4A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                  clipRule="evenodd"
                />
              </svg>
              Private note — only visible to you
            </p>
            <div className="prose prose-sm prose-stone dark:prose-invert max-w-none text-stone-600 dark:text-stone-400">
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                {preserveNewlines(notes)}
              </ReactMarkdown>
            </div>
          </div>
          {updatedAt && (
            <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
              Last edited {formatDateTime(updatedAt)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {emptyMessage}
        </p>
      )}
    </>
  );
}
