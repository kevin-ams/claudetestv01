"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "./auth-actions";

type Field = { name: string; label: string; type: string; autoComplete?: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action);
  return (
    <form {...formProps} className="mt-6 flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>
            {f.label}
          </label>
          <input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete} required className="input" />
        </div>
      ))}
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary mt-2">
        {pending ? "Un momento..." : submitLabel}
      </button>
    </form>
  );
}
