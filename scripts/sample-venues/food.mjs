// Drawn, top-down pictures of how each kind of menu is served (800x600 SVG).
// They show the style of service, not a vendor's actual dishes, so each
// carries a small ILLUSTRATION mark.

const FOOD = {
  rice: "#f6f0e1",
  curry: "#c8662a",
  sambal: "#b3322a",
  greens: "#5f8f45",
  tofu: "#efe3c2",
  meat: "#8a4b2a",
  prawn: "#ec8a5a",
  egg: "#f2c14e",
  noodles: "#e8c77a",
  sauce: "#7a2f1f",
  dal: "#e2a23b",
  herb: "#7fae5a",
};
// Vegetarian and vegan menus never show meat or seafood shapes.
const VEG_SWAP = { meat: "tofu", prawn: "greens", sambal: "curry", sauce: "herb" };
const tone = (veg, key) => FOOD[veg && VEG_SWAP[key] ? VEG_SWAP[key] : key];

const mark =
  '<g><rect x="24" y="548" width="196" height="36" rx="18" fill="#ffffff" fill-opacity="0.9"/>' +
  '<text x="122" y="572" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" text-anchor="middle" fill="#2a2325">ILLUSTRATION</text></g>';
const frame = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">${bg}${body}${mark}</svg>`;
const wood = `<rect width="800" height="600" fill="#b98a5e"/>${Array.from({ length: 9 }, (_, i) => `<rect y="${i * 68}" width="800" height="3" fill="#a77a50" opacity="0.55"/>`).join("")}`;
const cloth = (c) => `<rect width="800" height="600" fill="${c}"/>`;

/** A plate seen from above, with a few food shapes on it. */
function plate(cx, cy, r, foods) {
  const one = foods.length === 1;
  const bits = foods
    .map((f, i) => {
      const a = (i / foods.length) * Math.PI * 2;
      const d = one ? 0 : r * 0.32;
      const x = (cx + Math.cos(a) * d).toFixed(1);
      const y = (cy + Math.sin(a) * d).toFixed(1);
      return `<ellipse cx="${x}" cy="${y}" rx="${(r * (one ? 0.55 : 0.34)).toFixed(1)}" ry="${(r * (one ? 0.48 : 0.28)).toFixed(1)}" fill="${f}"/>`;
    })
    .join("");
  return `<circle cx="${cx}" cy="${cy + 4}" r="${r}" fill="#00000022"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="#f4f1ec"/>${bits}`;
}

/** Round banquet table: a lazy Susan of shared dishes, with rice bowls around the edge. */
function banquet(veg, accent) {
  const dishes = [["meat", "greens"], ["prawn"], ["noodles", "egg"], ["tofu", "greens"], ["sauce", "meat"], ["curry"]];
  let out = `<circle cx="400" cy="300" r="290" fill="${accent}"/><circle cx="400" cy="300" r="282" fill="none" stroke="#ffffff66" stroke-width="6"/><circle cx="400" cy="300" r="175" fill="#efe6da"/>`;
  out += plate(400, 300, 62, [tone(veg, "sambal"), tone(veg, "meat")]);
  dishes.forEach((d, i) => {
    const a = (i / dishes.length) * Math.PI * 2 - Math.PI / 2;
    out += plate(Math.round(400 + Math.cos(a) * 118), Math.round(300 + Math.sin(a) * 118), 46, d.map((k) => tone(veg, k)));
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.round(400 + Math.cos(a) * 238);
    const y = Math.round(300 + Math.sin(a) * 238);
    out += `<circle cx="${x}" cy="${y}" r="24" fill="#ffffff"/><circle cx="${x}" cy="${y}" r="17" fill="${FOOD.rice}"/>`;
  }
  return frame(cloth("#7b2f2f"), out);
}

/** A buffet line: chafing dishes on a long table. */
function buffet(veg, accent) {
  const pans = [["rice"], ["curry", "meat"], ["greens", "tofu"], ["noodles", "egg"], ["sambal", "prawn"], ["dal"]];
  let out = `<rect x="30" y="120" width="740" height="360" rx="18" fill="#fbf7f1"/><rect x="30" y="120" width="740" height="24" rx="12" fill="${accent}"/>`;
  pans.forEach((p, i) => {
    const x = 60 + (i % 3) * 240;
    const y = 170 + Math.floor(i / 3) * 160;
    out += `<rect x="${x}" y="${y + 6}" width="200" height="130" rx="14" fill="#00000022"/><rect x="${x}" y="${y}" width="200" height="130" rx="14" fill="#c9ced3"/><rect x="${x + 12}" y="${y + 12}" width="176" height="106" rx="10" fill="${tone(veg, p[0])}"/>`;
    if (p[1]) out += Array.from({ length: 5 }, (_, j) => `<ellipse cx="${x + 40 + j * 30}" cy="${y + 50 + (j % 2) * 26}" rx="16" ry="12" fill="${tone(veg, p[1])}"/>`).join("");
    out += `<rect x="${x + 150}" y="${y + 20}" width="70" height="10" rx="5" fill="#8d959c" transform="rotate(-25 ${x + 150} ${y + 20})"/>`;
  });
  return frame(wood, out);
}

/** One plated course, with cutlery and a glass. */
function plated(veg, accent) {
  let out = `<rect x="70" y="40" width="660" height="520" rx="30" fill="#f7f3ee"/>`;
  out += `<circle cx="400" cy="304" r="196" fill="#00000018"/><circle cx="400" cy="300" r="196" fill="#ffffff"/><circle cx="400" cy="300" r="150" fill="#f5f1ea"/>`;
  out += `<path d="M300 360 Q400 300 500 360" stroke="${tone(veg, "sauce")}" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  out += `<rect x="330" y="230" width="140" height="80" rx="22" fill="${tone(veg, "meat")}"/>`;
  out += Array.from({ length: 6 }, (_, i) => `<ellipse cx="${330 + i * 28}" cy="${340 + (i % 2) * 14}" rx="16" ry="10" fill="${i % 2 ? FOOD.greens : accent}"/>`).join("");
  out += `<circle cx="420" cy="215" r="10" fill="${FOOD.herb}"/><circle cx="440" cy="225" r="7" fill="${FOOD.herb}"/>`;
  out += `<rect x="130" y="150" width="14" height="300" rx="7" fill="#b8bec4"/><rect x="118" y="150" width="38" height="70" rx="12" fill="#b8bec4"/>`;
  out += `<rect x="656" y="150" width="14" height="300" rx="7" fill="#b8bec4"/><path d="M656 150 Q690 200 670 290 L656 290 Z" fill="#c9ced3"/>`;
  out += `<circle cx="640" cy="100" r="44" fill="#ffffff" opacity="0.7"/><circle cx="640" cy="100" r="30" fill="#e9dcc8" opacity="0.8"/>`;
  return frame(cloth("#ece3d6"), out);
}

/** A slate board of canapés. */
function canapes(veg, accent) {
  let out = `<rect x="90" y="110" width="620" height="380" rx="26" fill="#3a3a3d"/>`;
  const tops = [accent, FOOD.greens, FOOD.prawn, FOOD.egg, FOOD.sambal, FOOD.herb];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 160 + c * 120;
      const y = 175 + r * 120;
      let top = tops[(r + c) % tops.length];
      if (veg && top === FOOD.prawn) top = FOOD.greens;
      out += `<circle cx="${x}" cy="${y}" r="38" fill="#e9d2a6"/><circle cx="${x}" cy="${y - 4}" r="26" fill="${top}"/><circle cx="${x + 8}" cy="${y - 12}" r="6" fill="#ffffff" opacity="0.8"/>`;
    }
  }
  return frame(wood, out);
}

/** A grill with skewers over the coals. */
function grill(veg) {
  let out = `<rect x="80" y="90" width="640" height="420" rx="30" fill="#2b2b2e"/><rect x="110" y="120" width="580" height="360" rx="18" fill="#3b2a24"/>`;
  out += Array.from({ length: 14 }, (_, i) => `<circle cx="${140 + (i % 7) * 85}" cy="${190 + Math.floor(i / 7) * 200}" r="${18 + (i % 3) * 6}" fill="#e2572b" opacity="0.55"/>`).join("");
  out += Array.from({ length: 10 }, (_, i) => `<rect x="110" y="${135 + i * 36}" width="580" height="6" fill="#77777b"/>`).join("");
  const pieces = veg ? ["greens", "tofu", "curry", "egg"] : ["prawn", "meat", "greens", "prawn"];
  for (let s = 0; s < 5; s++) {
    const y = 165 + s * 66;
    out += `<rect x="140" y="${y}" width="520" height="6" rx="3" fill="#cdb48e"/>`;
    for (let k = 0; k < 6; k++) {
      out += `<rect x="${190 + k * 76}" y="${y - 16}" width="50" height="38" rx="12" fill="${FOOD[pieces[(s + k) % 4]]}"/><rect x="${200 + k * 76}" y="${y - 12}" width="6" height="30" fill="#00000033"/>`;
    }
  }
  return frame(wood, out);
}

/** A thali: rice and bread in the centre, small bowls of curries around the edge. */
function thali(veg) {
  let out = `<circle cx="400" cy="306" r="268" fill="#00000022"/><circle cx="400" cy="300" r="268" fill="#c6cbd0"/><circle cx="400" cy="300" r="246" fill="#d9dde1"/>`;
  out += `<ellipse cx="400" cy="330" rx="96" ry="70" fill="${FOOD.rice}"/><circle cx="350" cy="250" r="54" fill="#d9a066"/><circle cx="350" cy="250" r="54" fill="none" stroke="#b77b45" stroke-width="4" stroke-dasharray="6 10"/>`;
  const bowls = ["dal", "curry", "greens", "sambal", "tofu", "egg"];
  bowls.forEach((b, i) => {
    const a = (i / bowls.length) * Math.PI * 2 - Math.PI / 2;
    const x = Math.round(400 + Math.cos(a) * 178);
    const y = Math.round(300 + Math.sin(a) * 178);
    out += `<circle cx="${x}" cy="${y}" r="52" fill="#aeb4ba"/><circle cx="${x}" cy="${y}" r="42" fill="${tone(veg, b)}"/>`;
  });
  return frame(cloth("#2f6b4f"), out);
}

/** A platter of kuih: kuih lapis, onde-onde and two-layer bars. */
function kuih() {
  let out = `<ellipse cx="400" cy="312" rx="330" ry="240" fill="#00000022"/><ellipse cx="400" cy="300" rx="330" ry="240" fill="#f8f4ee"/><ellipse cx="400" cy="300" rx="300" ry="212" fill="#e7f0e0"/>`;
  for (let k = 0; k < 4; k++) {
    const x = 170 + k * 70;
    for (let l = 0; l < 6; l++) out += `<rect x="${x}" y="${190 + l * 10}" width="58" height="10" fill="${l % 2 ? "#d94f78" : "#f7d6df"}"/>`;
  }
  for (let k = 0; k < 6; k++) {
    const x = 470 + (k % 3) * 62;
    const y = 210 + Math.floor(k / 3) * 62;
    out += `<circle cx="${x}" cy="${y}" r="26" fill="#4f9a4a"/><circle cx="${x - 7}" cy="${y - 8}" r="5" fill="#ffffff"/><circle cx="${x + 6}" cy="${y - 4}" r="4" fill="#ffffff"/>`;
  }
  for (let k = 0; k < 5; k++) {
    const x = 190 + k * 86;
    out += `<rect x="${x}" y="330" width="70" height="34" fill="#6fbf73"/><rect x="${x}" y="364" width="70" height="30" fill="#f4f1e6"/>`;
  }
  return frame(cloth("#f1e4d3"), out);
}

const STYLES = { banquet, buffet, plated, canapes, grill, thali, kuih };

/** How each demonstration menu is served, by item id. */
export const FOOD_STYLE = {
  "halal-banquet": "banquet",
  "veg-banquet": "banquet",
  "chinese-banquet": "banquet",
  "nyonya-menu": "banquet",
  "family-style": "banquet",
  "intl-buffet": "buffet",
  "veg-buffet": "buffet",
  "nasi-minyak": "buffet",
  "halal-buffet": "buffet",
  "set-dinner": "plated",
  "veg-set": "plated",
  "vegan-menu": "plated",
  canapes: "canapes",
  "bbq-halal": "grill",
  "veg-bbq": "grill",
  "veg-thali": "thali",
  "dessert-table": "kuih",
  "nasi-padang": "buffet",
  "biryani-buffet": "buffet",
  "mezze-grill": "grill",
  "cantonese-seafood": "banquet",
  "banana-leaf": "thali",
  "japanese-korean": "buffet",
  "western-plated": "plated",
  "tok-panjang": "banquet",
  "eurasian-feast": "banquet",
  "nyonya-kueh": "kuih",
  "indian-veg-buffet": "buffet",
  mediterranean: "banquet",
  "thai-vegan": "buffet",
  "indonesian-buffet": "buffet",
  "halal-western": "plated",
  "halal-mezze": "grill",
  "korean-bbq": "grill",
  "vietnamese-stations": "buffet",
  "vegan-mezze": "buffet",
  "eurasian-buffet": "buffet",
  "nasi-ambeng": "banquet",
  "mamak-biryani": "buffet",
  "satay-station": "grill",
  "briyani-gam": "buffet",
  "chinese-veg-buffet": "buffet",
  "cantonese-private": "banquet",
  "teochew-set": "plated",
  "japanese-kaiseki": "plated",
};

/** A drawn picture of a menu's style of service. */
export function foodSvg(style, { veg = false, accent = "#c98f4b" } = {}) {
  const draw = STYLES[style];
  if (!draw) throw new Error(`Unknown food style ${style}`);
  return draw(veg, accent);
}
