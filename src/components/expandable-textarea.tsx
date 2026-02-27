"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import FullscreenEditor from "@/components/fullscreen-editor";

interface ExpandableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  /** Passed through to the underlying <textarea>. The component adds pr-9
   *  for the expand button, so use pl-* instead of px-* for left padding. */
  className?: string;
}

/**
 * A textarea with a small expand button in the top-right corner.
 * Clicking expand opens a fullscreen editor modal via a portal.
 */
export default function ExpandableTextarea({
  value,
  onChange,
  disabled = false,
  placeholder = "How did the match go?",
  rows = 3,
  className = "",
}: ExpandableTextareaProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={`pr-9 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShowFullscreen(true)}
        disabled={disabled}
        title="Expand"
        className="absolute right-1 top-1 rounded p-1.5 text-stone-400 transition-colors hover:text-stone-600 disabled:opacity-50 dark:text-stone-500 dark:hover:text-stone-300"
        aria-label="Expand editor"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
          <path d="M3.75 2a1.75 1.75 0 0 0-1.75 1.75v2a.75.75 0 0 1-1.5 0v-2A3.25 3.25 0 0 1 3.75.5h2a.75.75 0 0 1 0 1.5h-2ZM10.25.5a.75.75 0 0 1 .75.75v.001a.75.75 0 0 1-.75.749h.001A1.75 1.75 0 0 1 12 3.75v2a.75.75 0 0 0 1.5 0v-2A3.25 3.25 0 0 0 10.25.5ZM2 10.25a.75.75 0 0 0-1.5 0v2A3.25 3.25 0 0 0 3.75 15.5h2a.75.75 0 0 0 0-1.5h-2A1.75 1.75 0 0 1 2 12.25v-2ZM13.5 10.25a.75.75 0 0 0-1.5 0v2A1.75 1.75 0 0 1 10.25 14h-2a.75.75 0 0 0 0 1.5h2A3.25 3.25 0 0 0 13.5 12.25v-2Z" />
        </svg>
      </button>
      {showFullscreen &&
        createPortal(
          <FullscreenEditor
            value={value}
            placeholder={placeholder}
            onDone={(val) => {
              onChange(val);
              setShowFullscreen(false);
            }}
            onCancel={() => setShowFullscreen(false)}
          />,
          document.body
        )}
    </div>
  );
}
