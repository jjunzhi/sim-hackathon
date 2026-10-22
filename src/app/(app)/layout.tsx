import { ClientAuthShell } from "@/components/auth/client-auth-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ClientAuthShell>{children}</ClientAuthShell>;
}
