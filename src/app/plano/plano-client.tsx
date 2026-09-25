"use client";

import dynamic from "next/dynamic";

// The editor reads plans from localStorage, so it only renders in the browser.
const Editor = dynamic(() => import("@/components/plano/editor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen place-items-center text-sm text-muted">Cargando editor…</div>
  ),
});

export function PlanoClient() {
  return <Editor />;
}
