import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages only. Venue pages are found from the catalog, which loads in the browser. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/venues", "/rose-garden", "/sign-up", "/privacy"].map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: path === "/venues" ? "daily" : "monthly" }));
}
