"use client";

/** Botón de envío que pide confirmación antes de una acción destructiva. */
export function ConfirmButton({
  message,
  className = "btn btn-danger",
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
