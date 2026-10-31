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
const CANVAS = "#0B0F0C";
const SURFACE = "#0B0F0C";
const LINE = "rgba(122, 139, 128, 0.35)";

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
    h1: { fontFamily: headingFont, fontWeight: 700 },
    h2: { fontFamily: headingFont, fontWeight: 700 },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 700 },
    h5: { fontFamily: headingFont, fontWeight: 600 },
    h6: { fontFamily: headingFont, fontWeight: 600 },
    subtitle1: { fontFamily: headingFont, fontWeight: 600 },
    subtitle2: { fontFamily: headingFont, fontWeight: 600 },
    body1: { fontFamily: bodyFont },
    body2: { fontFamily: bodyFont },
    button: { textTransform: "none", fontWeight: 600, fontFamily: bodyFont },
    caption: { fontFamily: bodyFont },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: CANVAS,
          color: customColors.classroomSlate900,
          fontFamily: bodyFont,
          WebkitFontSmoothing: "antialiased",
        },
        "*": {
          borderRadius: "0 !important",
        },
        "::selection": {
          backgroundColor: "rgba(232, 166, 93, 0.3)",
          color: "#D7E0D9",
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
          paddingInline: 16,
          fontWeight: 600,
          fontFamily: bodyFont,
          textTransform: "none",
          border: `1px solid ${LINE}`,
          "&:hover": {
            borderColor: customColors.torchGold600,
            backgroundColor: "rgba(232, 166, 93, 0.08)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: bodyFont,
          fontWeight: 600,
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
          fontSize: "0.875rem",
          fontFamily: bodyFont,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: LINE,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: customColors.classroomSlate500,
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
          fontSize: "0.72rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: customColors.classroomSlate500,
          backgroundColor: "#111613",
          borderBottom: `1px solid ${LINE}`,
          paddingBlock: 12,
          fontFamily: bodyFont,
        },
        root: {
          borderBottom: `1px solid rgba(122, 139, 128, 0.2)`,
          paddingBlock: 12,
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
