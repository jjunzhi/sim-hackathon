import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/lib/leads/model";

export function LeadStatusBadge({ status }: { status: Lead["status"] }) {
  if (status === "confirmed") return <Badge tone="confirmed">Confirmed</Badge>;
  if (status === "declined") return <Badge tone="neutral">Declined</Badge>;
  return <Badge tone="warning">New</Badge>;
}
