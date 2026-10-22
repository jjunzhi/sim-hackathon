import { ImageResponse } from "next/og";

// Share preview for links to the site (chat apps, social posts).
export const alt = "WeddingVista: see your Singapore venue decorated, with honest prices";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#FBF7F2", color: "#2A2325" }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: "#B84C60", letterSpacing: 2 }}>WEDDINGVISTA</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 24, maxWidth: 980 }}>See your venue decorated, with honest prices.</div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#6F6468" }}>Real Singapore rooms, decor vendors can deliver, itemised estimates.</div>
      </div>
    ),
    size,
  );
}
