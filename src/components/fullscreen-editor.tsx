"use client";

import { useEffect, useRef, useState } from "react";

interface FullscreenEditorProps {
  value: string;
  placeholder?: string;
  onDone: (value: string) => void;
  onCancel: () => void;
}

/**
 * A fullscreen modal with a large textarea for comfortable note editing,
 * especially on mobile. Opens over the entire viewport with Done/Cancel controls.
 */
export default function FullscreenEditor({
  value,
  placeholder = "How did the match go?",
  onDone,
  onCancel,
}: FullscreenEditorProps) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Auto-focus the textarea and place cursor at end
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, []);

  // Close on Escape — uses a ref so the listener never re-registers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent background scrolling while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit notes"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50 dark:bg-stone-900"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          Cancel
        </button>
        <span className="text-sm font-semibold text-stone-900 dark:text-stone-50">
          Notes
        </span>
        <button
          type="button"
          onClick={() => onDone(draft)}
          className="text-sm font-semibold text-purple-700 transition-colors hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
        >
          Done
        </button>
      </div>

      {/* Helper text */}
      <div className="px-4 pt-3 pb-1">
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
      </div>

      {/* Textarea fills remaining space */}
      <div className="flex-1 px-4 pb-4">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full resize-none bg-transparent text-base text-stone-900 placeholder-stone-400 focus:outline-none dark:text-stone-50 dark:placeholder-stone-500"
        />
      </div>
    </div>
  );
}
