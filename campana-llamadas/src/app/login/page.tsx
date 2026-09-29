import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Campaña de llamadas" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Campaña de llamadas</h1>
        <p className="mt-1 text-sm text-muted">Ingresa para ver el dashboard.</p>
        <LoginForm />
      </div>
    </main>
  );
}
