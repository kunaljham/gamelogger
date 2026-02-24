"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import type { OpponentWithStats, Opponent } from "@/types/match";
import InviteModal from "@/components/invite-modal";
import InviteButton from "@/components/invite-button";
import NotesSection from "@/components/notes-section";

export default function OpponentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isDemoUser } = useUser();

  // Opponent data
  const [opponent, setOpponent] = useState<OpponentWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit name/email form
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // ── Fetch opponent on mount ────────────────────────────────────────
  useEffect(() => {
    const fetchOpponent = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`,
          { credentials: "include" }
        );
        if (res.status === 404) {
          setError("Opponent not found");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load opponent (${res.status})`);
        const data: OpponentWithStats = await res.json();
        setOpponent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    fetchOpponent();
  }, [id]);

  // ── Save name/email ────────────────────────────────────────────────
  const handleSave = async () => {
    setEditError("");
    const name = editName.trim();
    if (!name) {
      setEditError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const body: { name: string; email?: string } = { name };
      const email = editEmail.trim();
      if (email) body.email = email;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update opponent");
      }

      const updated: Opponent = await res.json();
      setOpponent((prev) =>
          prev ? { ...prev, ...updated, wins: prev.wins, losses: prev.losses } : prev
        );
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ── Save notes ─────────────────────────────────────────────────────
  const handleSaveNotes = async (notes: string | null) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}/notes`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
        credentials: "include",
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Failed to save notes");
    }

    // Response is a plain Opponent (not OpponentWithStats), and omitempty
    // omits notes/notes_updated_at when cleared — so avoid spreading updated
    // and explicitly set each field to preserve stats and handle clearing.
    const updated: Opponent = await res.json();
    setOpponent((prev) =>
      prev
        ? {
            ...prev,
            name: updated.name,
            email: updated.email,
            status: updated.status,
            notes: updated.notes,
            notes_updated_at: updated.notes_updated_at,
          }
        : prev
    );
  };

  // ── Invite success ─────────────────────────────────────────────────
  const handleInviteSuccess = async () => {
    setShowInviteModal(false);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data: OpponentWithStats = await res.json();
        setOpponent(data);
      }
    } catch {
      // Silent — invite was sent successfully
    }
  };

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-8 w-48 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded-lg bg-stone-200 dark:bg-stone-700" />
            <div className="h-8 w-20 rounded-lg bg-stone-200 dark:bg-stone-700" />
          </div>
        </div>
      </main>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error || !opponent) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error ?? "Opponent not found"}
        </div>
      </main>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="size-4"
        >
          <path
            fillRule="evenodd"
            d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back
      </button>

      {/* Header */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Email{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              disabled={saving}
              placeholder="opponent@example.com"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>
          {editError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setEditError("");
              }}
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
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
                {opponent.name}
              </h1>
              {opponent.email && (
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {opponent.email}
                </p>
              )}
            </div>
            {!isDemoUser && opponent.status !== "registered" && (
              <button
                onClick={() => {
                  setEditName(opponent.name);
                  setEditEmail(opponent.email ?? "");
                  setEditError("");
                  setEditing(true);
                }}
                className="mt-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Edit
              </button>
            )}
          </div>
          {opponent.status === "registered" ? (
            <div className="mt-3">
              <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                Registered
              </span>
            </div>
          ) : !isDemoUser && (
            <div className="mt-3">
              <InviteButton
                opponent={opponent}
                onClick={() => setShowInviteModal(true)}
              />
            </div>
          )}
        </>
      )}

      {/* Matches section */}
      <div className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
            Matches
          </h2>
          {!isDemoUser && (
            <button
              onClick={() =>
                router.push(
                  `/log-match?opponent=${opponent.id}&name=${encodeURIComponent(opponent.name)}`
                )
              }
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Log Match
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-4">
          <div className="flex w-24 flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {opponent.wins}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500">
              {opponent.wins === 1 ? "Win" : "Wins"}
            </span>
          </div>
          <div className="flex w-24 flex-col items-center rounded-lg border border-red-200 bg-red-50 py-3 dark:border-red-800 dark:bg-red-950/40">
            <span className="text-2xl font-bold text-red-700 dark:text-red-400">
              {opponent.losses}
            </span>
            <span className="text-xs text-red-600 dark:text-red-500">
              {opponent.losses === 1 ? "Loss" : "Losses"}
            </span>
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-800">
        <NotesSection
          notes={opponent.notes}
          updatedAt={opponent.notes_updated_at}
          readOnly={isDemoUser}
          placeholder="Strategy, play style, things to remember..."
          emptyMessage="Keep track of play style, strategy, strengths, or anything else you want to remember about this opponent. Notes are private to you."
          onSave={handleSaveNotes}
        />
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          opponent={opponent}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </main>
  );
}
