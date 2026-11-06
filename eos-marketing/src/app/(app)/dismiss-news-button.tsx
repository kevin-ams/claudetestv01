"use client";

import { Xmark } from "@gravity-ui/icons";
import { useTransition } from "react";
import { dismissNewsAction } from "./news-actions";

export function DismissNewsButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => dismissNewsAction(id))}
      aria-label="Quitar esta noticia de mi inicio"
      title="Quitar de mi inicio"
      className="rounded-md p-1 text-muted hover:bg-default hover:text-foreground disabled:opacity-50"
    >
      <Xmark width={14} height={14} aria-hidden />
    </button>
  );
}
