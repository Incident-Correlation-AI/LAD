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
    100: "#1A2E26",
    300: "#7A8B80",
    500: "#E8A65D",
    600: "#E8A65D",
    700: "#D9944B",
    800: "#0B0F0C",
    900: "#080B09",
  }),
  ceramicSand: buildShades({
    100: "#0B0F0C",
    200: "#111613",
    300: "#1A221D",
    500: "#7A8B80",
    600: "#A2B2A8",
    700: "#D7E0D9",
    900: "#FFFFFF",
  }),
  classroomSlate: buildShades({
    50: "#111613",
    100: "#18201A",
    200: "#222D25",
    300: "#44554A",
    400: "#7A8B80",
    500: "#7A8B80",
    600: "#98A89E",
    700: "#B5C2B9",
    800: "#D7E0D9",
    900: "#D7E0D9",
  }),
  campusGreen: buildShades({
    100: "#122619",
    300: "#22C55E",
    500: "#4ADE80",
    600: "#4ADE80",
    700: "#22C55E",
    900: "#14532D",
  }),
  brickTerracotta: buildShades({
    100: "#2A1815",
    300: "#FB923C",
    500: "#F97316",
    700: "#EA580C",
    900: "#7C2D12",
  }),
  errorRed: buildShades({
    100: "#2A1414",
    300: "#F87171",
    500: "#EF4444",
    700: "#DC2626",
    900: "#991B1B",
  }),
  torchGold: buildShades({
    100: "#2A2212",
    300: "#FCD34D",
    500: "#F59E0B",
    600: "#E8A65D",
    700: "#D9944B",
    900: "#78350F",
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