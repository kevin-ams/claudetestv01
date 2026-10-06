import { Alert } from "@heroui/react";

export function FormMessage({ error, success }: { error: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <Alert status={error ? "danger" : "success"}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{error ?? success}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
