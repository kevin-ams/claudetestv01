"use client";

import { ChevronDown, ChevronRight, FileText, Folder } from "@gravity-ui/icons";
import { type TreeFolder } from "@/lib/domain/vault-shared";


export function FolderNode({
  folder,
  depth,
  activeId,
  open,
  toggle,
  onOpen,
}: {
  folder: TreeFolder;
  depth: number;
  activeId: number | null;
  open: Set<string>;
  toggle: (path: string) => void;
  onOpen: (id: number) => void;
}) {
  return (
    <ul className="flex flex-col">
      {folder.folders.map((f) => {
        const isOpen = open.has(f.path);
        return (
          <li key={f.path}>
            <button
              type="button"
              onClick={() => toggle(f.path)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-muted hover:bg-default hover:text-foreground"
              style={{ paddingLeft: depth * 12 + 4 }}
            >
              {isOpen ? <ChevronDown width={12} aria-hidden /> : <ChevronRight width={12} aria-hidden />}
              <Folder width={14} aria-hidden />
              <span className="truncate">{f.name}</span>
            </button>
            {isOpen && <FolderNode folder={f} depth={depth + 1} activeId={activeId} open={open} toggle={toggle} onOpen={onOpen} />}
          </li>
        );
      })}
      {folder.notes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onOpen(n.id)}
            aria-current={n.id === activeId ? "page" : undefined}
            className={`flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm ${
              n.id === activeId ? "bg-primary/10 font-medium text-primary" : "hover:bg-default"
            }`}
            style={{ paddingLeft: depth * 12 + 20 }}
            title={n.path}
          >
            <FileText width={14} className="shrink-0 opacity-60" aria-hidden />
            <span className="truncate">{n.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
