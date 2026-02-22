"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/match";
import type { Opponent } from "@/types/match";

interface InviteModalProps {
  opponent: Pick<Opponent, "id" | "name" | "email" | "status" | "invited_at">;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteModal({
  opponent,
  onClose,
  onSuccess,
}: InviteModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    setInviteError("");

    const needsEmail = !opponent.email;
    if (needsEmail) {
      const trimmed = inviteEmail.trim();
      if (!trimmed) {
        setInviteError("Email is required to send an invite.");
        return;
      }
      setInviting(true);
      const updateRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: opponent.name, email: trimmed }),
          credentials: "include",
        }
      );
      if (!updateRes.ok) {
        const data = await updateRes.json();
        setInviteError(data.error || "Failed to save email.");
        setInviting(false);
        return;
      }
    } else {
      setInviting(true);
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}/invite`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invite.");
        return;
      }
      onSuccess();
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => !inviting && onClose()}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          {opponent.status === "invited"
            ? `Re-invite ${opponent.name}?`
            : `Invite ${opponent.name}?`}
        </h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {opponent.status === "invited"
            ? `This will send another invitation email to ${opponent.email}. They\u2019ll get a link to join GameLogger.`
            : opponent.email
              ? `This will send an email to ${opponent.email} inviting them to join GameLogger so they can track matches too.`
              : "This will send them an email inviting them to join GameLogger so they can track matches too."}
        </p>

        {opponent.status === "invited" && opponent.invited_at && (
          <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
            Last invited {formatDateTime(opponent.invited_at)}
          </p>
        )}

        {!opponent.email && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Their email address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError("");
              }}
              disabled={inviting}
              placeholder="opponent@example.com"
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>
        )}

        {inviteError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {inviteError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={inviting}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="flex-1 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
          >
            {inviting ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
