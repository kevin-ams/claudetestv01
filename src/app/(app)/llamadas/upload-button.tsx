"use client";

import { useRef, useState, useTransition } from "react";
import { uploadCallsAction } from "./actions";

export function UploadButton({ label = "↑ Subir archivo actualizado" }: { label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    setMessage(null);
    startTransition(async () => {
      const result = await uploadCallsAction(fd);
      setMessage(
        "error" in result
          ? { tone: "error", text: result.error }
          : { tone: "ok", text: `Listo: ${file.name} (${result.sheets} pestañas de contactos).` }
      );
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? "Subiendo…" : label}
      </button>
      {message && (
        <p className={`max-w-sm text-right text-xs ${message.tone === "error" ? "text-red" : "text-green"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
