import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./register-form";

export default function RegistroPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
