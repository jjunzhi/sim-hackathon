import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Venue photos from Cloud Storage for Firebase.
    remotePatterns: [{ protocol: "https", hostname: "firebasestorage.googleapis.com" }],
  },
};

export default nextConfig;
