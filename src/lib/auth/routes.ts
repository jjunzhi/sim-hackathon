import type { Role } from "@/lib/data/users";

export function homeFor(role: Role): string {
  return role === "vendor" ? "/vendor" : "/account";
}
