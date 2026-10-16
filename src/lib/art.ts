/**
 * Built-in product illustrations.
 *
 * Every image is an SVG drawn in code and returned as a data URI, so it loads
 * instantly with no network request and never breaks. Products use these until
 * the Pexels script has downloaded real photos (see image-manifest.json).
 * Colours follow the product's colour variants, so swatches still swap the image.
 */

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
/** Mix a colour towards black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  return rgbToHex([r + (t - r) * a, g + (t - g) * a, b + (t - b) * a]);
}
const isLight = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
};

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const toDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s{2,}/g, " "))}`;

/* ------------------------------ Backdrop ------------------------------ */

const WALL = "#F4F0E9";
const TABLE = "#E7DFD2";

function backdrop(w: number, h: number, horizon = 0.66) {
  const y = Math.round(h * horizon);
  return `<rect width="${w}" height="${h}" fill="${WALL}"/>
    <rect y="${y}" width="${w}" height="${h - y}" fill="${TABLE}"/>
    <rect y="${y}" width="${w}" height="3" fill="#000" opacity=".035"/>`;
}

const shadow = (cx: number, cy: number, rx: number, ry = rx * 0.09) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2b2118" opacity=".13"/>`;

/* ---------------------------- Towel pieces ---------------------------- */

type Design = "Plain" | "Textured" | "Patterned";

/** One folded towel seen from the front: soft rounded block, fold shadow, woven border. */
function foldedTowel(x: number, y: number, w: number, h: number, color: string, design: Design, id: string) {
  const dark = shade(color, -0.16);
  const darker = shade(color, -0.28);
  const light = shade(color, 0.22);
  const stripe = isLight(color) ? shade(color, -0.35) : shade(color, 0.45);
  const r = Math.min(h * 0.32, 28);
  let detail = "";
  if (design === "Textured") {
    // waffle / ribbed texture
    detail = `<pattern id="t${id}" width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7H14M7 0V14" stroke="${dark}" stroke-width="1.4" opacity=".55"/></pattern>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#t${id})"/>`;
  } else if (design === "Patterned") {
    // hammam-style stripes near both ends
    const sx = [0.12, 0.17, 0.79, 0.84].map((f) => x + w * f);
    detail = sx.map((sxi, i) => `<rect x="${sxi}" y="${y}" width="${i % 2 ? 6 : 14}" height="${h}" fill="${stripe}" opacity=".85"/>`).join("");
  }
  // woven dobby border line
  const border = `<rect x="${x + w * 0.06}" y="${y + h * 0.22}" width="${w * 0.88}" height="4" rx="2" fill="${light}" opacity=".7"/>
    <rect x="${x + w * 0.06}" y="${y + h * 0.22 + 8}" width="${w * 0.88}" height="2" rx="1" fill="${light}" opacity=".5"/>`;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/>
    ${detail}
    ${border}
    <rect x="${x}" y="${y + h * 0.72}" width="${w}" height="${h * 0.28}" rx="${r * 0.8}" fill="${dark}" opacity=".55"/>
    <path d="M${x + r * 0.6} ${y + 3} H${x + w - r * 0.6}" stroke="${light}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${darker}" stroke-opacity=".18" stroke-width="2"/>
  </g>`;
}

/** Rolled towel seen end-on: spiral rings. */
function rolledTowel(cx: number, cy: number, rad: number, color: string, design: Design) {
  const dark = shade(color, -0.18);
  const stripe = isLight(color) ? shade(color, -0.35) : shade(color, 0.45);
  const rings = [0.78, 0.56, 0.34]
    .map((f) => `<circle cx="${cx}" cy="${cy}" r="${rad * f}" fill="none" stroke="${dark}" stroke-width="${rad * 0.05}" opacity=".55"/>`)
    .join("");
  const band = design === "Patterned" ? `<circle cx="${cx}" cy="${cy}" r="${rad * 0.67}" fill="none" stroke="${stripe}" stroke-width="${rad * 0.08}" opacity=".8"/>` : "";
  return `<g>${shadow(cx, cy + rad * 0.98, rad * 0.95, rad * 0.12)}
    <circle cx="${cx}" cy="${cy}" r="${rad}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${shade(color, -0.3)}" stroke-opacity=".2" stroke-width="2"/>
    ${band}${rings}
    <circle cx="${cx}" cy="${cy}" r="${rad * 0.12}" fill="${dark}" opacity=".6"/></g>`;
}

/** Towel hanging over a rail (kitchen towels, hand towels). */
function hangingTowel(x: number, y: number, w: number, h: number, color: string, design: Design, id: string) {
  const dark = shade(color, -0.18);
  const stripe = isLight(color) ? shade(color, -0.38) : shade(color, 0.45);
  const stripes =
    design !== "Plain"
      ? [0.7, 0.76, 0.82].map((f, i) => `<rect x="${x}" y="${y + h * f}" width="${w}" height="${i === 1 ? 14 : 6}" fill="${stripe}" opacity=".85"/>`).join("")
      : `<rect x="${x}" y="${y + h * 0.8}" width="${w}" height="5" fill="${shade(color, 0.25)}" opacity=".8"/>`;
  const texture =
    design === "Textured"
      ? `<pattern id="h${id}" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6H12M6 0V12" stroke="${dark}" stroke-width="1.2" opacity=".5"/></pattern><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#h${id})"/>`
      : "";
  return `<g>
    <path d="M${x} ${y} H${x + w} V${y + h - 10} Q${x + w} ${y + h} ${x + w - 10} ${y + h} H${x + 10} Q${x} ${y + h} ${x} ${y + h - 10} Z" fill="${color}"/>
    ${texture}${stripes}
    <rect x="${x}" y="${y}" width="${w}" height="${h * 0.12}" fill="${dark}" opacity=".35"/>
    <path d="M${x + w * 0.35} ${y} V${y + h}" stroke="${dark}" stroke-width="2" opacity=".25"/>
  </g>`;
}

/* ------------------------------ Scenes -------------------------------- */

function stackScene(colors: string[], design: Design, w: number, h: number, id: string, layers = 3, scale = 1) {
  const baseY = h * 0.78;
  const tw = w * 0.8 * scale;
  const th = Math.max(56, h * (layers > 3 ? 0.11 : 0.145) * scale);
  const cx = w / 2;
  let out = shadow(cx, baseY + 4, tw * 0.56);
  for (let i = 0; i < layers; i++) {
    const shrink = i * (layers > 3 ? 0.08 : 0.03);
    const ww = tw * (1 - shrink);
    const jitter = ((i % 2 ? 1 : -1) * w * 0.012);
    out += foldedTowel(cx - ww / 2 + jitter, baseY - th * (i + 1), ww, th, colors[i % colors.length], design, `${id}${i}`);
  }
  return out;
}

function closeUpScene(color: string, design: Design, w: number, h: number, id: string) {
  // two oversized towels cropped by the frame — shows the texture
  const th = h * 0.26;
  return `${shadow(w / 2, h * 0.86, w * 0.6)}
    ${foldedTowel(-w * 0.12, h * 0.58, w * 1.2, th, shade(color, -0.04), design, `${id}a`)}
    ${foldedTowel(-w * 0.06, h * 0.58 - th, w * 1.16, th, color, design, `${id}b`)}`;
}

function rolledScene(color: string, design: Design, w: number, h: number) {
  const r = w * 0.19;
  const y = h * 0.7;
  return `${rolledTowel(w * 0.3, y, r, shade(color, -0.06), design)}
    ${rolledTowel(w * 0.7, y, r, color, design)}
    ${rolledTowel(w * 0.5, y - r * 1.62, r, shade(color, 0.1), design)}`;
}

function railScene(colors: string[], design: Design, w: number, h: number, id: string) {
  const railY = h * 0.2;
  const tw = w * 0.32;
  const th = h * 0.5;
  return `<rect x="${w * 0.1}" y="${railY - 6}" width="${w * 0.8}" height="12" rx="6" fill="#b9ad9b"/>
    <circle cx="${w * 0.1}" cy="${railY}" r="12" fill="#a99c88"/><circle cx="${w * 0.9}" cy="${railY}" r="12" fill="#a99c88"/>
    ${hangingTowel(w * 0.16, railY + 4, tw, th, colors[0], design, `${id}a`)}
    ${hangingTowel(w * 0.52, railY + 4, tw, th * 0.86, colors[1 % colors.length], design, `${id}b`)}`;
}

function robeScene(color: string, design: Design, w: number, h: number, id: string) {
  const dark = shade(color, -0.18);
  const cx = w / 2;
  const top = h * 0.18;
  const texture =
    design === "Textured"
      ? `<pattern id="r${id}" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14M7 0V14" stroke="${dark}" stroke-width="1.3" opacity=".45"/></pattern>`
      : "";
  const robe = `M${cx - 70} ${top + 30} Q${cx} ${top} ${cx + 70} ${top + 30} L${cx + 190} ${top + 120} L${cx + 230} ${top + 330} L${cx + 160} ${top + 345} L${cx + 140} ${top + 220} L${cx + 150} ${h * 0.86} L${cx - 150} ${h * 0.86} L${cx - 140} ${top + 220} L${cx - 160} ${top + 345} L${cx - 230} ${top + 330} L${cx - 190} ${top + 120} Z`;
  return `<defs>${texture}</defs>
    <path d="M${cx} ${h * 0.1} V${top + 14}" stroke="#a99c88" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${h * 0.1}" r="16" fill="#b9ad9b"/>
    ${shadow(cx, h * 0.9, 200)}
    <path d="${robe}" fill="${color}" stroke="${shade(color, -0.3)}" stroke-opacity=".2" stroke-width="2" stroke-linejoin="round"/>
    ${texture ? `<path d="${robe}" fill="url(#r${id})"/>` : ""}
    <path d="M${cx - 70} ${top + 30} L${cx + 40} ${top + 300} L${cx + 40} ${h * 0.86}" fill="none" stroke="${dark}" stroke-width="5" opacity=".5"/>
    <path d="M${cx + 70} ${top + 30} L${cx - 10} ${top + 230}" fill="none" stroke="${dark}" stroke-width="5" opacity=".5"/>
    <rect x="${cx - 150}" y="${top + 290}" width="300" height="22" rx="10" fill="${dark}"/>
    <path d="M${cx + 60} ${top + 310} q 18 60 -6 110 M${cx + 90} ${top + 310} q 24 55 6 100" stroke="${dark}" stroke-width="16" stroke-linecap="round" fill="none"/>`;
}

function matScene(color: string, design: Design, w: number, h: number) {
  const dark = shade(color, -0.18);
  const y = h * 0.6;
  const stripe = shade(color, isLight(color) ? -0.3 : 0.4);
  const tufts =
    design === "Patterned"
      ? [0.28, 0.44, 0.6, 0.76].map((f) => `<path d="M${w * f} ${y + 8} L${w * (f - 0.07)} ${y + h * 0.3 - 8}" stroke="${stripe}" stroke-width="18" opacity=".8"/>`).join("")
      : Array.from({ length: 7 }, (_, i) =>
          Array.from({ length: 18 }, (_, j) => `<circle cx="${w * (0.12 + j * 0.045) - i * 6}" cy="${y + 16 + i * 30}" r="5" fill="${dark}" opacity=".4"/>`).join(""),
        ).join("");
  return `${shadow(w * 0.5, y + h * 0.315, w * 0.46, 16)}
    <path d="M${w * 0.14} ${y} H${w * 0.94} L${w * 0.86} ${y + h * 0.3} H${w * 0.06} Z" fill="${color}" stroke="${shade(color, -0.3)}" stroke-opacity=".2" stroke-width="2" stroke-linejoin="round"/>
    ${tufts}
    <path d="M${w * 0.06} ${y + h * 0.3} H${w * 0.86} V${y + h * 0.3 + 16} H${w * 0.06} Z" fill="${dark}"/>`;
}

function babyScene(color: string, design: Design, w: number, h: number, id: string) {
  const stack = stackScene([color, shade(color, 0.08)], design, w, h, id, 2, 0.8);
  const cx = w / 2;
  const baseY = h * 0.72 - Math.max(70, h * 0.115 * 0.8) * 2;
  const dark = shade(color, -0.14);
  return `${stack}
    <path d="M${cx - 110} ${baseY + 4} Q${cx} ${baseY - 150} ${cx + 110} ${baseY + 4} Z" fill="${shade(color, 0.05)}" stroke="${dark}" stroke-opacity=".3" stroke-width="2"/>
    <path d="M${cx - 70} ${baseY} Q${cx} ${baseY - 95} ${cx + 70} ${baseY}" fill="none" stroke="${dark}" stroke-width="3" opacity=".45"/>
    <circle cx="${cx - 40}" cy="${baseY - 92}" r="16" fill="${shade(color, 0.05)}" stroke="${dark}" stroke-opacity=".3" stroke-width="2"/>
    <circle cx="${cx + 40}" cy="${baseY - 92}" r="16" fill="${shade(color, 0.05)}" stroke="${dark}" stroke-opacity=".3" stroke-width="2"/>`;
}

/** Neutral still life for non-towel products: an object on a plinth. */
function plinthScene(color: string, w: number, h: number, seed: number) {
  const cx = w / 2;
  const top = h * 0.62;
  const shapes = [
    `<circle cx="${cx}" cy="${top - 120}" r="120" fill="${color}"/>`,
    `<rect x="${cx - 90}" y="${top - 300}" width="180" height="300" rx="40" fill="${color}"/>`,
    `<path d="M${cx - 130} ${top} Q${cx - 130} ${top - 260} ${cx} ${top - 260} Q${cx + 130} ${top - 260} ${cx + 130} ${top} Z" fill="${color}"/>`,
  ];
  return `${shadow(cx, top + 150, 230, 18)}
    <rect x="${cx - 200}" y="${top}" width="400" height="150" rx="6" fill="#e2d8c9"/>
    <rect x="${cx - 200}" y="${top}" width="400" height="16" fill="#efe7dc"/>
    ${shapes[seed % shapes.length]}
    <ellipse cx="${cx - 40}" cy="${top - 180}" rx="26" ry="60" fill="#fff" opacity=".18"/>`;
}

/* ------------------------------ Public API ---------------------------- */

export type ArtInput = {
  /** product type, e.g. "Bath Towels" */
  type: string;
  design: Design;
  /** main colour (hex) */
  color: string;
  /** other colours for mixed stacks */
  palette?: string[];
  /** 0 = main, 1 = close-up, 2 = alternate arrangement */
  view?: number;
  seed?: string;
  width?: number;
  height?: number;
};

const TOWEL_TYPES = new Set(["Bath Towels", "Towels", "Beach Towels", "Baby Towels", "Kitchen Towels", "Bath Mats", "Bathrobes", "Towel Bundles"]);

export function productArt({ type, design, color, palette = [], view = 0, seed = type, width = 800, height = 1000 }: ArtInput) {
  const w = width;
  const h = height;
  const id = (hash(`${seed}${color}${view}`) % 1e6).toString(36);
  const colors = [color, ...palette.filter((c) => c !== color)];
  let scene: string;

  if (!TOWEL_TYPES.has(type)) {
    scene = plinthScene(color, w, h, hash(seed) + view);
  } else if (type === "Bathrobes") {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? stackScene([color], design, w, h, id) : robeScene(color, design, w, h, id);
  } else if (type === "Bath Mats") {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? stackScene([color, shade(color, 0.06)], design, w, h, id, 2) : matScene(color, design, w, h);
  } else if (type === "Kitchen Towels") {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? stackScene(colors, design, w, h, id) : railScene(colors.length > 1 ? colors : [color, shade(color, 0.1)], design, w, h, id);
  } else if (type === "Beach Towels") {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? stackScene([color, shade(color, 0.08)], design, w, h, id) : rolledScene(color, design, w, h);
  } else if (type === "Baby Towels") {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? rolledScene(color, design, w, h) : babyScene(color, design, w, h, id);
  } else if (type === "Towel Bundles") {
    scene = view === 1 ? rolledScene(color, design, w, h) : view === 2 ? closeUpScene(color, design, w, h, id) : stackScene(colors.length > 2 ? colors.slice(0, 3) : [color, shade(color, 0.08), shade(color, -0.05)], design, w, h, id, 5);
  } else {
    scene = view === 1 ? closeUpScene(color, design, w, h, id) : view === 2 ? rolledScene(color, design, w, h) : stackScene([color, shade(color, 0.06), shade(color, -0.04)], design, w, h, id);
  }

  return toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${backdrop(w, h)}${scene}</svg>`);
}

/** Calm palettes for editorial scenes (hero, categories, banners). */
const SCENE_PALETTES = [
  ["#f1ede4", "#d9cdb8", "#a3b19a"],
  ["#b7c6cf", "#f1ede4", "#2b3a55"],
  ["#e3c1b8", "#f1ede4", "#b06a4f"],
  ["#d9cdb8", "#a9a196", "#3a3836"],
  ["#a3b19a", "#c8b18e", "#f1ede4"],
  ["#2f6e66", "#f1ede4", "#d9cdb8"],
];

/** Editorial scene: one or more towel stacks, sized to any frame. Deterministic per seed. */
export function sceneArt(seed: string, width: number, height: number) {
  const s = hash(seed);
  const palette = SCENE_PALETTES[s % SCENE_PALETTES.length];
  const wide = width / height > 1.25;
  const id = (s % 1e6).toString(36);
  let scene: string;
  if (wide) {
    // three stacks side by side
    scene = [0.2, 0.5, 0.8]
      .map((cx, i) => {
        const cols = [palette[i], shade(palette[i], 0.07), shade(palette[i], -0.05)];
        const dx = width * cx - width / 2;
        return `<g transform="translate(${dx} 0)">${stackScene(cols, i === 1 ? "Textured" : "Plain", width, height, `${id}${i}`, 3 + (i % 2), 0.3)}</g>`;
      })
      .join("");
  } else {
    const designs: Design[] = ["Plain", "Textured", "Patterned"];
    scene = stackScene(palette, designs[s % 3], width, height, id, 4);
  }
  return toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${backdrop(width, height, wide ? 0.7 : 0.66)}${scene}</svg>`);
}
