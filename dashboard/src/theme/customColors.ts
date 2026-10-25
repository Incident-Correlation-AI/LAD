export type ShadeKey =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

const SHADE_KEYS: ShadeKey[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

type ShadeMap = Partial<Record<ShadeKey, string>>;

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const value = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (channel: number) =>
    Math.round(Math.max(0, Math.min(255, channel)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  [ar, ag, ab]: [number, number, number],
  [br, bg, bb]: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpChannel(ar, br, t), lerpChannel(ag, bg, t), lerpChannel(ab, bb, t)];
}

function buildShades(anchors: ShadeMap): Record<ShadeKey, string> {
  const anchorKeys = SHADE_KEYS.filter((key) => anchors[key]);
  const result = {} as Record<ShadeKey, string>;

  for (const shade of SHADE_KEYS) {
    const exact = anchors[shade];
    if (exact) {
      result[shade] = exact;
      continue;
    }

    const lower = [...anchorKeys].reverse().find((key) => key < shade);
    const upper = anchorKeys.find((key) => key > shade);

    if (lower && upper) {
      const t = (shade - lower) / (upper - lower);
      result[shade] = rgbToHex(
        lerpRgb(hexToRgb(anchors[lower]!), hexToRgb(anchors[upper]!), t),
      );
      continue;
    }

    if (lower) {
      const t = shade / lower;
      result[shade] = rgbToHex(lerpRgb(WHITE, hexToRgb(anchors[lower]!), t));
      continue;
    }

    if (upper) {
      const t = (shade - upper) / (1000 - upper);
      result[shade] = rgbToHex(lerpRgb(hexToRgb(anchors[upper]!), BLACK, t));
      continue;
    }

    result[shade] = rgbToHex(WHITE);
  }

  return result;
}

const colorFamilies = {
  nileBlue: buildShades({
    100: "#EBF5FA",
    300: "#99CCE3",
    500: "#1D729B",
    700: "#124862",
    900: "#0A2735",
  }),
  ceramicSand: buildShades({
    100: "#FAF8F5",
    200: "#ECDEC6",
    300: "#F1EAD9",
    500: "#E3D7BC",
    600: "#E1CCA7",
    700: "#BCAB87",
    900: "#60543A",
  }),
  classroomSlate: buildShades({
    100: "#E2E8F0",
    300: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    900: "#0F172A",
  }),
  campusGreen: buildShades({
    100: "#E6F6ED",
    300: "#A3E0BA",
    500: "#16A34A",
    700: "#15803D",
    900: "#14532D",
  }),
  brickTerracotta: buildShades({
    100: "#FDF2F0",
    300: "#F1B1A1",
    500: "#D95338",
    700: "#A9361F",
    900: "#601A0E",
  }),
  errorRed: buildShades({
    100: "#FEF2F2",
    300: "#FCA5A5",
    500: "#DC2626",
    700: "#B91C1C",
    900: "#7F1D1D",
  }),
  torchGold: buildShades({
    100: "#FEFCE8",
    300: "#FDE047",
    500: "#EAB308",
    700: "#A16207",
    900: "#713F12",
  }),
};

export type ColorFamilyName = keyof typeof colorFamilies;
export type CustomColorName = `${ColorFamilyName}${ShadeKey}`;

function flattenFamilies(
  families: typeof colorFamilies,
): Record<CustomColorName, string> {
  return (Object.entries(families) as [
    ColorFamilyName,
    Record<ShadeKey, string>,
  ][]).reduce<Record<CustomColorName, string>>((acc, [name, shades]) => {
    for (const shade of SHADE_KEYS) {
      acc[`${name}${shade}` as CustomColorName] = shades[shade];
    }
    return acc;
  }, {} as Record<CustomColorName, string>);
}

export const customColors = flattenFamilies(colorFamilies);

export type CustomColors = typeof customColors;

declare module "@mui/material/styles" {
  interface Theme {
    custom: CustomColors;
  }
  interface ThemeOptions {
    custom?: CustomColors;
  }
}