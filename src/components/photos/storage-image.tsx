"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { photoUrl } from "@/lib/data/venues";
import { getFirebase } from "@/lib/firebase/client";
import type { StoredPhoto } from "@/lib/venues/model";

/** A Storage photo in a fixed-ratio frame (no layout shift while it loads). */
export function StorageImage({
  photo,
  alt,
  sizes = "(min-width: 48rem) 50vw, 100vw",
  aspect = "4 / 3",
  className,
}: {
  photo: StoredPhoto;
  alt: string;
  sizes?: string;
  aspect?: string;
  className?: string;
}) {
  const [state, setState] = useState<{ path: string; url: string | null; failed: boolean }>({ path: photo.path, url: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    photoUrl(photo.path).then(
      (url) => !cancelled && setState({ path: photo.path, url, failed: false }),
      () => !cancelled && setState({ path: photo.path, url: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [photo.path]);

  const current = state.path === photo.path ? state : { url: null, failed: false };
  // The emulator serves from 127.0.0.1, which the image optimiser won't fetch.
  const unoptimized = getFirebase().settings.useEmulators;

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-subtle", className)} style={{ aspectRatio: aspect }}>
      {current.url ? (
        <Image src={current.url} alt={alt} fill sizes={sizes} unoptimized={unoptimized} className="object-cover" />
      ) : current.failed ? (
        <div className="flex size-full items-center justify-center text-muted">
          <ImageOff aria-hidden className="size-6" />
          <span className="sr-only">Photo unavailable</span>
        </div>
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
    </div>
  );
}
