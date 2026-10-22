"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ImagePrepError, prepareImage, type PreparedImage } from "@/lib/images/prepare-image";
import { ACCEPTED_INPUT } from "@/lib/images/sizing";
import type { StoredPhoto } from "@/lib/venues/model";
import { CameraModal } from "./camera-modal";
import { StorageImage } from "./storage-image";

type Status = { kind: "idle" } | { kind: "preparing" } | { kind: "uploading"; progress: number } | { kind: "error"; message: string };

export function PhotoPicker({
  label,
  photo,
  alt,
  upload,
}: {
  label: string;
  photo: StoredPhoto | null;
  alt: string;
  /** Uploads the prepared image; report progress 0..1. */
  upload: (image: PreparedImage, onProgress: (p: number) => void) => Promise<void>;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [cameraOpen, setCameraOpen] = useState(false);
  const toast = useToast();
  const busy = status.kind === "preparing" || status.kind === "uploading";

  async function handle(file: Blob & { name?: string }) {
    setStatus({ kind: "preparing" });
    try {
      const image = await prepareImage(file);
      setStatus({ kind: "uploading", progress: 0 });
      await upload(image, (progress) => setStatus({ kind: "uploading", progress }));
      setStatus({ kind: "idle" });
      toast({ title: "Photo saved", tone: "success" });
    } catch (err) {
      const message =
        err instanceof ImagePrepError ? err.message : "We couldn't upload that photo. Check your connection and try again.";
      setStatus({ kind: "error", message });
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handle(file);
  }

  function takePhoto() {
    // Phones: native camera via <input capture>. Elsewhere: live camera if available.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    // mediaDevices is missing on insecure origins and some older browsers.
    const hasLiveCamera = typeof navigator.mediaDevices?.getUserMedia === "function";
    if (!coarse && hasLiveCamera) setCameraOpen(true);
    else captureRef.current?.click();
  }

  const statusText =
    status.kind === "preparing"
      ? "Preparing photo..."
      : status.kind === "uploading"
        ? `Uploading ${Math.round(status.progress * 100)}%`
        : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small font-semibold text-ink">{label}</p>
      {photo ? (
        <StorageImage photo={photo} alt={alt} />
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-subtle p-6 text-center text-muted"
          style={{ aspectRatio: "4 / 3" }}
        >
          <ImagePlus aria-hidden className="size-7" />
          <span className="text-small">No photo yet. A wide shot of the empty room works best.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={takePhoto} disabled={busy} icon={<Camera aria-hidden className="size-4" />}>
          Take a photo
        </Button>
        <Button onClick={() => galleryRef.current?.click()} disabled={busy} icon={<ImagePlus aria-hidden className="size-4" />}>
          {photo ? "Replace photo" : "Choose a photo"}
        </Button>
      </div>
      <input ref={galleryRef} type="file" accept={ACCEPTED_INPUT} className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFile}
      />
      <p aria-live="polite" className="num min-h-6 text-small text-muted">
        {statusText}
      </p>
      {status.kind === "error" && (
        <p role="alert" className="text-small font-medium text-error">
          {status.message}
        </p>
      )}
      <CameraModal open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(blob) => void handle(blob)} />
    </div>
  );
}
