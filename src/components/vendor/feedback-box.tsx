"use client";

import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { sendFeedback } from "@/lib/data/billing";

const MAX = 1000;

/** Pilot feedback: free text and the page it was sent from. Nothing else is collected. */
export function FeedbackBox({ uid }: { uid: string }) {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim()) return setError("Write a few words first.");
    setBusy(true);
    setError(null);
    try {
      await sendFeedback(uid, text, pathname);
      toast({ title: "Thank you. We read every message.", tone: "success" });
      setText("");
      setOpen(false);
    } catch {
      setError("We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<MessageSquare aria-hidden className="size-4" />}>
        Send feedback
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Send feedback"
        description="Stuck, confused, or missing something? Tell us in your own words. Please don't include couples' details."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={send}>
              Send
            </Button>
          </>
        }
      >
        <Textarea label="Your feedback" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} className="[&_textarea]:min-h-32" />
      </Modal>
    </>
  );
}
