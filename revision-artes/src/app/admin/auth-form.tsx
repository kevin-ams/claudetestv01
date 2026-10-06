"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
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
        <TextField key={f.name} name={f.name} type={f.type} isRequired autoComplete={f.autoComplete}>
          <Label>{f.label}</Label>
          <Input />
        </TextField>
      ))}
      <FormMessage error={state.error} />
      <Button type="submit" isPending={pending} fullWidth className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
