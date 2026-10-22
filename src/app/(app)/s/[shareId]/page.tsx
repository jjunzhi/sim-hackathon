"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { CircleCheck, Heart, Link2Off } from "lucide-react";
import { useEffect, useState } from "react";
import { StorageImage } from "@/components/photos/storage-image";
import { optionLetter } from "@/components/sharing/share-results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { castVote, ensureVisitorSession, getMyVote, getShare, type ShareLookup } from "@/lib/data/shares";
import { formatSGD } from "@/lib/money";
import { transition } from "@/lib/motion";
import { themeLabel } from "@/lib/render/themes";
import { SHARE_LIMITS, type Vote } from "@/lib/sharing/model";

/**
 * The family voting page. No account: an anonymous session lets each person
 * vote once. Votes are private to the couple; no IP addresses are stored.
 */
export default function FamilyVotePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [state, setState] = useState<{ uid: string; lookup: ShareLookup; vote: Vote | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = await ensureVisitorSession();
        const lookup = await getShare(shareId);
        const vote = lookup.kind === "active" ? await getMyVote(shareId, uid) : null;
        if (!cancelled) setState({ uid, lookup, vote });
      } catch {
        if (!cancelled) setError("We couldn't open this link. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!state || state.lookup.kind !== "active" || choice === null) return;
    setBusy(true);
    const vote: Vote = { optionIndex: choice, name: name.trim().slice(0, SHARE_LIMITS.nameMax), note: note.trim().slice(0, SHARE_LIMITS.noteMax) };
    try {
      await castVote(shareId, state.uid, vote);
      setState({ ...state, vote });
    } catch {
      // Most likely a vote already exists for this browser.
      const existing = await getMyVote(shareId, state.uid);
      if (existing) setState({ ...state, vote: existing });
      else setError("We couldn't send your vote. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex min-h-16 items-center">
          <span className="font-display text-h3">WeddingVista</span>
        </div>
      </header>
      <main className="container-page flex flex-col gap-6 py-8">
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        {!state && !error && <SkeletonList rows={2} label="Opening the link" />}
        {state?.lookup.kind === "removed" && (
          <Message icon={<Link2Off aria-hidden className="size-8" />} title="This project has been removed" body="The couple has deleted it. There's nothing to see here any more." />
        )}
        {state?.lookup.kind === "revoked" && (
          <Message icon={<Link2Off aria-hidden className="size-8" />} title="This link is no longer active" body="The couple has turned it off. Ask them for a new link if you'd like to vote." />
        )}
        {state?.lookup.kind === "active" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-small font-semibold uppercase tracking-widest text-accent-text">You&apos;re invited to help choose</p>
              <h1 className="text-h1">{state.lookup.share.title}</h1>
              <p className="max-w-2xl text-muted">Tap your favourite. Your vote goes only to the couple. No account needed.</p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-6">
              <fieldset disabled={!!state.vote}>
                <legend className="sr-only">Options</legend>
                <ul className={cn("grid gap-5", state.lookup.share.options.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
                  {state.lookup.share.options.map((o, i) => {
                    const selected = state.vote ? state.vote.optionIndex === i : choice === i;
                    return (
                      <li key={`${o.renderKey}-${i}`}>
                        <motion.label
                          animate={state.vote && selected ? { scale: [0.96, 1] } : { scale: 1 }}
                          transition={transition.bounce}
                          className={cn(
                            "flex h-full cursor-pointer flex-col overflow-hidden rounded-card border-2 bg-surface shadow-soft transition-colors",
                            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                            selected ? "border-accent" : "border-line",
                            state.vote && "cursor-default",
                          )}
                        >
                          <input type="radio" name="option" className="sr-only" checked={selected} onChange={() => setChoice(i)} />
                          <StorageImage
                            photo={{ path: o.renderPath, width: Number(o.aspect.split("/")[0]) || 4, height: Number(o.aspect.split("/")[1]) || 3, contentType: "image/jpeg" }}
                            alt={`Option ${optionLetter(i)}: AI illustration of ${o.venueName} in the ${themeLabel(o.themeId)} theme`}
                            aspect={o.aspect}
                            className="rounded-none"
                            sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
                          />
                          <span className="flex flex-1 flex-col gap-2 p-4">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-display text-h3">Option {optionLetter(i)}</span>
                              {selected && <Heart aria-hidden className="size-5 fill-accent text-accent" />}
                            </span>
                            <span>
                              {o.venueName} · {themeLabel(o.themeId)}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="num font-semibold">{formatSGD(o.estimateTotalCents)}</span>
                              <Badge tone="estimate">Estimate</Badge>
                            </span>
                            <span className="text-small text-muted">
                              AI illustration. Final decor may differ.{o.demo ? " DEMO image, not an AI render." : ""}
                            </span>
                          </span>
                        </motion.label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              {state.vote ? (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-success bg-surface p-4 font-semibold text-success">
                  <CircleCheck aria-hidden className="size-5" />
                  Thank you! You chose Option {optionLetter(state.vote.optionIndex)}. The couple will see your vote.
                </p>
              ) : (
                <div className="flex max-w-xl flex-col gap-4">
                  <Input label="Your name or relationship (optional)" placeholder="For example, Auntie Mei" maxLength={SHARE_LIMITS.nameMax} value={name} onChange={(e) => setName(e.target.value)} />
                  <Textarea label="A note for the couple (optional)" maxLength={SHARE_LIMITS.noteMax} value={note} onChange={(e) => setNote(e.target.value)} className="[&_textarea]:min-h-24" />
                  <Button type="submit" variant="primary" size="lg" disabled={choice === null} loading={busy} className="self-start">
                    {choice === null ? "Choose an option first" : `Vote for Option ${optionLetter(choice)}`}
                  </Button>
                  <p className="text-small text-muted">One vote per person. We don&apos;t ask for contact details or store your IP address.</p>
                </div>
              )}
            </form>
          </>
        )}
        <p className="text-small text-muted">
          Planning your own wedding?{" "}
          <Link href="/" className="font-semibold text-accent-text underline underline-offset-4">
            See how WeddingVista works
          </Link>
        </p>
      </main>
    </>
  );
}

function Message({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-12 text-center">
      <span className="text-gold">{icon}</span>
      <h1 className="text-h2">{title}</h1>
      <p className="max-w-md text-muted">{body}</p>
    </div>
  );
}
