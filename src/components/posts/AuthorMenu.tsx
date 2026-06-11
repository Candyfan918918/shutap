// AuthorMenu — three-dot menu visible only to the story author.
// Retract / Post update / Close case route into existing /me/posts pages.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  postId: string;
}

export function AuthorMenu({ postId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full border border-border bg-surface-elevated flex items-center justify-center text-sm hover:border-primary/50"
        aria-label="Author menu"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-lg z-20 overflow-hidden">
          <Link
            to="/me/posts/$postId"
            params={{ postId }}
            search={{ action: "retract" } as any}
            className="block px-3 py-2 text-xs hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            Retract
          </Link>
          <Link
            to="/me/posts/$postId"
            params={{ postId }}
            search={{ action: "update" } as any}
            className="block px-3 py-2 text-xs hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            Post update
          </Link>
          <Link
            to="/me/posts/$postId"
            params={{ postId }}
            search={{ action: "sequel" } as any}
            className="block px-3 py-2 text-xs hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            Post sequel
          </Link>
          <Link
            to="/me/posts/$postId"
            params={{ postId }}
            search={{ action: "close" } as any}
            className="block px-3 py-2 text-xs hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            Close case
          </Link>
        </div>
      )}
    </div>
  );
}
