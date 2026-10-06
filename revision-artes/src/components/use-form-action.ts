"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

type State = { error: string | null; ok?: boolean; message?: string };

/**
 * Como useActionState, pero sin el reseteo automático de React 19 al enviar:
 * si la acción devuelve un error, lo escrito se conserva. Con `resetOnSuccess`
 * el formulario se limpia solo cuando la acción termina bien.
 */
export function useFormAction(
  action: (prev: State, formData: FormData) => Promise<State>,
  { resetOnSuccess = false } = {}
) {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formProps: { ref: formRef, onSubmit } };
}
