import type { Metadata } from "next";

// Family links are private: keep them out of search results and link previews' indexes.
export const metadata: Metadata = {
  title: "Help choose",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
