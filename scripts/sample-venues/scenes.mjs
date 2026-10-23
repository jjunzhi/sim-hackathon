// Illustrated room scenes (2048x1536 SVG), one per room type. Drawn in code
// so there are no licensing questions; each carries an "ILLUSTRATION" mark so
// it is never taken for a photo. Replaced by approved stock photos where we have them.

const W = 2048;
const H = 1536;
const mark = `<g><rect x="56" y="${H - 116}" width="400" height="64" rx="32" fill="#ffffff" fill-opacity="0.88"/><text x="256" y="${H - 73}" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="4" text-anchor="middle" fill="#2a2325">ILLUSTRATION</text></g>`;
const svg = (body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}${mark}</svg>`;

// Round banquet tables in perspective: rows get smaller towards the back.
function tables({ rows = 3, perRow = 5, top = 980, cloth = "#f7f2ea", leg = "#cdbfae", shadow = "#00000018" } = {}) {
  let out = "";
  for (let r = 0; r < rows; r++) {
    const scale = 0.55 + r * 0.25;
    const y = top + r * 150 * scale;
    const n = perRow + (rows - 1 - r);
    for (let i = 0; i < n; i++) {
      const x = W / 2 + (i - (n - 1) / 2) * 360 * scale;
      const rx = 130 * scale;
      const ry = 34 * scale;
      out += `<ellipse cx="${x}" cy="${y + 70 * scale}" rx="${rx * 1.05}" ry="${ry * 0.9}" fill="${shadow}"/>`;
      out += `<path d="M${x - rx} ${y} L${x - rx * 0.92} ${y + 62 * scale} Q${x} ${y + 82 * scale} ${x + rx * 0.92} ${y + 62 * scale} L${x + rx} ${y} Z" fill="${leg}"/>`;
      out += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${cloth}"/>`;
    }
  }
  return out;
}

function chandeliers(n, y, color = "#f6d98b") {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = ((i + 1) * W) / (n + 1);
    out += `<line x1="${x}" y1="0" x2="${x}" y2="${y - 40}" stroke="#b9a27a" stroke-width="3"/>`;
    out += `<circle cx="${x}" cy="${y}" r="120" fill="url(#glow)"/>`;
    for (let k = -3; k <= 3; k++) out += `<path d="M${x + k * 22} ${y - 30} q${k * 6} 50 ${k * 2} 90" stroke="${color}" stroke-width="5" fill="none" opacity="0.9"/>`;
    out += `<ellipse cx="${x}" cy="${y - 34}" rx="70" ry="14" fill="${color}"/>`;
  }
  return out;
}

const glow = `<radialGradient id="glow"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.85"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>`;

export const SCENES = {
  ballroom: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#wall)"/>
       ${[...Array(9)].map((_, i) => `<rect x="${60 + i * 222}" y="160" width="150" height="560" rx="75" fill="#efe3cf" stroke="#d9c39b" stroke-width="6"/>`).join("")}
       <rect y="760" width="${W}" height="${H - 760}" fill="url(#carpet)"/>
       <rect y="740" width="${W}" height="24" fill="#c9a96b"/>
       ${chandeliers(3, 230)}
       ${tables({ rows: 3, perRow: 4, top: 960 })}`,
      `${glow}<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ecdc"/><stop offset="1" stop-color="#e6d5b8"/></linearGradient>
       <linearGradient id="carpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8c2f3c"/><stop offset="1" stop-color="#5f1e28"/></linearGradient>`,
    ),
  glasshouse: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
       ${[...Array(12)].map((_, i) => `<line x1="${i * 186}" y1="0" x2="${i * 186}" y2="820" stroke="#ffffff" stroke-width="10" opacity="0.8"/>`).join("")}
       <path d="M0 260 Q${W / 2} -80 ${W} 260" stroke="#ffffff" stroke-width="14" fill="none" opacity="0.85"/>
       <ellipse cx="300" cy="760" rx="380" ry="200" fill="#5f8f5a"/><ellipse cx="1760" cy="740" rx="420" ry="220" fill="#577f52"/>
       <rect y="800" width="${W}" height="${H - 800}" fill="#d9cdb8"/>
       ${tables({ rows: 3, perRow: 4, top: 980, cloth: "#fbfaf6" })}`,
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6e4"/><stop offset="1" stop-color="#eef4ea"/></linearGradient>`,
    ),
  garden: () =>
    svg(
      `<rect width="${W}" height="900" fill="url(#sky)"/>
       ${[...Array(7)].map((_, i) => `<circle cx="${i * 340 + 60}" cy="${620 + (i % 2) * 40}" r="${200 + (i % 3) * 40}" fill="${["#6a9b5d", "#5b8a51", "#76a868"][i % 3]}"/>`).join("")}
       <rect y="760" width="${W}" height="${H - 760}" fill="url(#lawn)"/>
       ${[...Array(12)].map((_, i) => `<circle cx="${80 + i * 170}" cy="${330 + Math.sin(i) * 30}" r="10" fill="#fff4c8"/>`).join("")}
       <path d="M0 330 ${[...Array(12)].map((_, i) => `Q${80 + i * 170 - 85} ${380} ${80 + i * 170} ${330 + Math.sin(i) * 30}`).join(" ")}" stroke="#7b6a52" stroke-width="3" fill="none"/>
       ${tables({ rows: 3, perRow: 4, top: 980, shadow: "#00000020" })}`,
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0f2"/><stop offset="1" stop-color="#f4f1df"/></linearGradient>
       <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbf73"/><stop offset="1" stop-color="#5d8f49"/></linearGradient>`,
    ),
  rooftop: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#dusk)"/>
       ${[...Array(18)].map((_, i) => {
         const h = 220 + ((i * 97) % 380);
         const w = 70 + ((i * 53) % 90);
         return `<rect x="${i * 118}" y="${820 - h}" width="${w}" height="${h}" fill="#2e3550"/>${[...Array(Math.floor(h / 60))].map((__, k) => `<rect x="${i * 118 + 12}" y="${820 - h + 20 + k * 60}" width="${w - 24}" height="12" fill="#f7d58a" opacity="${(i + k) % 3 ? 0.75 : 0.25}"/>`).join("")}`;
       }).join("")}
       <rect y="820" width="${W}" height="${H - 820}" fill="#5c4a40"/>
       <rect y="800" width="${W}" height="40" fill="#8a7466"/>
       ${[...Array(14)].map((_, i) => `<circle cx="${70 + i * 150}" cy="${560 + Math.sin(i * 0.8) * 40}" r="12" fill="#ffe7a6"/>`).join("")}
       ${tables({ rows: 2, perRow: 5, top: 1060, cloth: "#efe6da", leg: "#b8a48f" })}`,
      `<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f6b"/><stop offset="0.55" stop-color="#d9787a"/><stop offset="1" stop-color="#f5b97a"/></linearGradient>`,
    ),
  courtyard: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="#f2e6d3"/>
       ${[...Array(5)].map((_, i) => `<rect x="${120 + i * 380}" y="140" width="260" height="520" fill="#2f6f6a"/><rect x="${150 + i * 380}" y="170" width="200" height="460" fill="#9cc7c1"/><path d="M${120 + i * 380} 140 h260 v-40 q-130 -80 -260 0 Z" fill="#c45c4a"/>`).join("")}
       <rect y="700" width="${W}" height="${H - 700}" fill="url(#tiles)"/>
       ${[...Array(6)].map((_, i) => `<circle cx="${200 + i * 330}" cy="120" r="40" fill="#d8443a"/><rect x="${196 + i * 330}" y="80" width="8" height="20" fill="#7a3a2a"/>`).join("")}
       ${tables({ rows: 2, perRow: 4, top: 1000, cloth: "#fff8ee" })}`,
      `<pattern id="tiles" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="#e8d6bd"/><path d="M60 0 L120 60 L60 120 L0 60 Z" fill="#cf8f6b" opacity="0.55"/><circle cx="60" cy="60" r="14" fill="#2f6f6a" opacity="0.7"/></pattern>`,
    ),
  warehouse: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#brick)"/>
       ${[...Array(4)].map((_, i) => `<rect x="${220 + i * 440}" y="180" width="300" height="420" fill="#cfd8dc" stroke="#33302e" stroke-width="16"/><line x1="${370 + i * 440}" y1="180" x2="${370 + i * 440}" y2="600" stroke="#33302e" stroke-width="10"/><line x1="${220 + i * 440}" y1="390" x2="${520 + i * 440}" y2="390" stroke="#33302e" stroke-width="10"/>`).join("")}
       ${[...Array(6)].map((_, i) => `<line x1="0" y1="${60 + i * 20}" x2="${W}" y2="${60 + i * 20}" stroke="#2b2a29" stroke-width="6" opacity="0.6"/>`).join("")}
       ${[...Array(8)].map((_, i) => `<line x1="${130 + i * 250}" y1="0" x2="${130 + i * 250}" y2="300" stroke="#2b2a29" stroke-width="2"/><circle cx="${130 + i * 250}" cy="305" r="16" fill="#ffd27a"/>`).join("")}
       <rect y="760" width="${W}" height="${H - 760}" fill="#8f8a84"/>
       ${tables({ rows: 3, perRow: 4, top: 980, cloth: "#f4efe7", leg: "#2f2b28" })}`,
      `<pattern id="brick" width="160" height="80" patternUnits="userSpaceOnUse"><rect width="160" height="80" fill="#9a4d3a"/><rect x="2" y="2" width="76" height="36" fill="#a8583f"/><rect x="82" y="2" width="76" height="36" fill="#96493a"/><rect x="-38" y="42" width="76" height="36" fill="#a1533e"/><rect x="42" y="42" width="76" height="36" fill="#a8583f"/><rect x="122" y="42" width="76" height="36" fill="#93473a"/></pattern>`,
    ),
  deck: () =>
    svg(
      `<rect width="${W}" height="620" fill="url(#sky)"/>
       <rect y="560" width="${W}" height="260" fill="url(#sea)"/>
       <circle cx="1600" cy="420" r="110" fill="#ffe2a8" opacity="0.9"/>
       ${[...Array(3)].map((_, i) => `<path d="M${120 + i * 760} 560 q40 -260 10 -420 M${130 + i * 760} 160 q-120 20 -180 90 M${130 + i * 760} 160 q120 0 190 70 M${130 + i * 760} 160 q-40 -60 -150 -40 M${130 + i * 760} 160 q60 -70 160 -30" stroke="#3f5a3a" stroke-width="18" fill="none"/>`).join("")}
       <rect y="800" width="${W}" height="${H - 800}" fill="url(#deck)"/>
       ${tables({ rows: 2, perRow: 5, top: 1060, cloth: "#ffffff", leg: "#c9b49a" })}`,
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc9e8"/><stop offset="1" stop-color="#fbe3c4"/></linearGradient>
       <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8fb0"/><stop offset="1" stop-color="#2c6c8c"/></linearGradient>
       <pattern id="deck" width="2048" height="60" patternUnits="userSpaceOnUse"><rect width="2048" height="60" fill="#b78b5e"/><rect y="56" width="2048" height="4" fill="#8c6744"/></pattern>`,
    ),
  hall: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="#eef0ec"/>
       ${[...Array(7)].map((_, i) => `<rect x="${80 + i * 290}" y="200" width="180" height="380" fill="#cfe3ea" stroke="#9aa5a8" stroke-width="8"/>`).join("")}
       ${[...Array(5)].map((_, i) => `<rect x="${200 + i * 380}" y="40" width="200" height="22" rx="11" fill="#ffffff"/><rect x="${200 + i * 380}" y="62" width="200" height="8" fill="#f6f2cf" opacity="0.6"/>`).join("")}
       <rect x="760" y="620" width="528" height="120" fill="#c9a24b"/><rect x="760" y="600" width="528" height="20" fill="#b18a38"/>
       <rect y="740" width="${W}" height="${H - 740}" fill="url(#floor)"/>
       ${tables({ rows: 3, perRow: 5, top: 960 })}`,
      `<pattern id="floor" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" fill="#d8d2c4"/><rect width="100" height="100" fill="#cfc8b8"/><rect x="100" y="100" width="100" height="100" fill="#cfc8b8"/></pattern>`,
    ),
  dining: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#wood)"/>
       ${[...Array(4)].map((_, i) => `<rect x="${200 + i * 440}" y="200" width="320" height="400" fill="#2b1f1a"/><rect x="${222 + i * 440}" y="222" width="276" height="356" fill="#d9a65b" opacity="0.35"/>`).join("")}
       ${[...Array(3)].map((_, i) => `<line x1="${520 + i * 500}" y1="0" x2="${520 + i * 500}" y2="300" stroke="#1d1512" stroke-width="3"/><path d="M${470 + i * 500} 300 h100 l-20 50 h-60 Z" fill="#c98f3e"/><circle cx="${520 + i * 500}" cy="380" r="140" fill="url(#glow)"/>`).join("")}
       <rect y="760" width="${W}" height="${H - 760}" fill="#5a3b2b"/>
       <rect x="380" y="900" width="1288" height="200" rx="40" fill="#f3ece2"/>
       <rect x="420" y="1100" width="40" height="200" fill="#3b2a21"/><rect x="1588" y="1100" width="40" height="200" fill="#3b2a21"/>
       ${[...Array(6)].map((_, i) => `<circle cx="${520 + i * 200}" cy="1000" r="40" fill="#ffffff" stroke="#d6c8b6" stroke-width="6"/>`).join("")}`,
      `${glow}<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4632"/><stop offset="1" stop-color="#4a2f22"/></linearGradient>`,
    ),
};

/** A small product swatch for decor and catering items. */
export function swatchSvg(hex, label) {
  const safe = label.replace(/[<&>]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f4ece6"/><circle cx="400" cy="260" r="180" fill="${hex}"/><text x="400" y="545" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle" fill="#2a2325">${safe}</text></svg>`;
}
