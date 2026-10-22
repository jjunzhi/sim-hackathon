import type { NextConfig } from "next";

// Baseline security headers for every page. A full Content-Security-Policy is
// left out on purpose: Firebase, reCAPTCHA and Maps need a carefully tested
// allow-list, and a wrong one breaks sign-in. See README > Before launch.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Our pages may not be framed by other sites (clickjacking). We frame Google Maps, not the reverse.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Venue photos from Cloud Storage for Firebase.
    remotePatterns: [{ protocol: "https", hostname: "firebasestorage.googleapis.com" }],
  },
};

export default nextConfig;
