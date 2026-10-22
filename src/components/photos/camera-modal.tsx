"use client";

import { Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Live camera (getUserMedia) for laptops and tablets. Phones use the native
 * camera through <input capture>, which is faster and familiar.
 */
export function CameraModal({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError(null);
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setError(
          err.name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser settings, or choose a photo from your files instead."
            : "We couldn't start the camera. Choose a photo from your files instead.",
        );
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onOpenChange(false);
        onCapture(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Take a photo"
      description="Stand back to fit the whole room in the frame."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={capture} disabled={!ready || !!error} icon={<Camera aria-hidden className="size-5" />}>
            Take photo
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-small font-medium text-error">
          {error}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-subtle" style={{ aspectRatio: "4 / 3" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="size-full object-cover"
            aria-label="Camera preview"
          />
        </div>
      )}
    </Modal>
  );
}
