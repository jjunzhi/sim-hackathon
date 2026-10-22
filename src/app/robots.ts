import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Search engines may list the public pages only. Family links (/s/...) are
 * private by design and must never be indexed; signed-in areas have nothing
 * public to show.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/venues", "/privacy"], disallow: ["/s/", "/account", "/plans", "/guests", "/checklists", "/vendor", "/welcome", "/design", "/studio"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
