import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { customColors } from "./customColors";
import { bodyFont, headingFont } from "./fonts";

/**
 * Terminal UI Dark theme matching the landing-page design system.
 * JetBrains Mono monospace typography, sharp 1px borders, #0B0F0C canvas,
 * #D7E0D9 primary text, #7A8B80 dim accents, and #E8A65D amber highlight.
 */
const CANVAS = "#050806";
const SURFACE = "#0B0F0C";
const LINE = "rgba(162, 181, 168, 0.4)";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: customColors.torchGold600, dark: customColors.torchGold700 },
    secondary: { main: customColors.campusGreen600 },
    error: { main: customColors.errorRed500 },
    warning: { main: customColors.torchGold600 },
    success: { main: customColors.campusGreen600 },
    background: { default: CANVAS, paper: SURFACE },
    text: {
      primary: customColors.classroomSlate900,
      secondary: customColors.classroomSlate500,
    },
    divider: LINE,
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: bodyFont,
    fontSize: 14,
    h1: { fontFamily: headingFont, fontWeight: 700 },
    h2: { fontFamily: headingFont, fontWeight: 700 },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 700 },
    h5: { fontFamily: headingFont, fontWeight: 700, fontSize: "1.5rem" },
    h6: { fontFamily: headingFont, fontWeight: 700, fontSize: "1.25rem" },
    subtitle1: { fontFamily: headingFont, fontWeight: 600, fontSize: "1.05rem" },
    subtitle2: { fontFamily: headingFont, fontWeight: 600, fontSize: "0.95rem" },
    body1: { fontFamily: bodyFont, fontSize: "0.95rem", lineHeight: 1.6 },
    body2: { fontFamily: bodyFont, fontSize: "0.9rem", lineHeight: 1.55 },
    button: { textTransform: "none", fontWeight: 600, fontFamily: bodyFont, fontSize: "0.88rem" },
    caption: { fontFamily: bodyFont, fontSize: "0.82rem", lineHeight: 1.45 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: CANVAS,
          color: customColors.classroomSlate900,
          fontFamily: bodyFont,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        "*": {
          borderRadius: "0 !important",
        },
        "::selection": {
          backgroundColor: "rgba(232, 166, 93, 0.3)",
          color: "#FFFFFF",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: SURFACE,
          border: `1px solid ${LINE}`,
          borderRadius: 0,
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 0,
          paddingInline: 18,
          paddingBlock: 8,
          fontSize: "0.88rem",
          fontWeight: 700,
          fontFamily: bodyFont,
          textTransform: "none",
          border: `1px solid ${LINE}`,
          color: customColors.classroomSlate900,
          "&:hover": {
            borderColor: customColors.torchGold600,
            backgroundColor: "rgba(232, 166, 93, 0.12)",
            color: "#FFFFFF",
          },
          "&:active": {
            backgroundColor: "rgba(232, 166, 93, 0.18)",
          },
          "&.Mui-disabled": {
            borderColor: "rgba(162, 181, 168, 0.25)",
            color: "rgba(186, 203, 193, 0.55)",
          },
        },
        outlined: {
          borderColor: "rgba(162, 181, 168, 0.5)",
        },
        contained: {
          backgroundColor: "rgba(232, 166, 93, 0.16)",
          border: `1px solid ${customColors.torchGold600}`,
          color: "#FFFFFF",
          "&:hover": {
            backgroundColor: "rgba(232, 166, 93, 0.24)",
            borderColor: "#f0b46e",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: "0.8rem",
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: SURFACE,
          color: customColors.classroomSlate900,
          fontSize: "0.92rem",
          fontFamily: bodyFont,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: LINE,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: customColors.torchGold600,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: customColors.torchGold600,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: "0.82rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 800,
          color: "#DCE5E0",
          backgroundColor: "#0F1512",
          borderBottom: `1px solid ${LINE}`,
          paddingBlock: 14,
          paddingInline: 22,
          fontFamily: bodyFont,
        },
        root: {
          borderBottom: `1px solid rgba(162, 181, 168, 0.2)`,
          paddingBlock: 14,
          paddingInline: 22,
          fontSize: "0.92rem",
          color: customColors.classroomSlate900,
          fontFamily: bodyFont,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-of-type td": { borderBottom: "none" },
          "&:hover": {
            backgroundColor: "rgba(232, 166, 93, 0.04) !important",
          },
        },
      },
    },
  },
  custom: customColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
