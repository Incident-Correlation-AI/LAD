import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { customColors } from "./customColors";
import { bodyFont, headingFont } from "./fonts";

/**
 * Light theme in the house palette (nile blue + ceramic sand).
 *
 * Surfaces are deliberately separated: an off-white canvas, pure-white cards,
 * and a single hairline colour. Cards sharing the canvas colour and heavy
 * 24px radii was what made the previous pass look soft and shapeless.
 */
const CANVAS = "#F4F1EC";
const SURFACE = "#FFFFFF";
const LINE = "#E6E0D4";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: customColors.nileBlue600, dark: customColors.nileBlue800 },
    secondary: { main: customColors.campusGreen600 },
    error: { main: customColors.errorRed500 },
    warning: { main: customColors.torchGold600 },
    success: { main: customColors.campusGreen600 },
    background: { default: CANVAS, paper: SURFACE },
    text: {
      primary: customColors.classroomSlate900,
      secondary: customColors.classroomSlate600,
    },
    divider: LINE,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: bodyFont,
    h1: { fontFamily: headingFont, fontWeight: 700 },
    h2: { fontFamily: headingFont, fontWeight: 700 },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 700 },
    h5: { fontFamily: headingFont, fontWeight: 600 },
    h6: { fontFamily: headingFont, fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: CANVAS, WebkitFontSmoothing: "antialiased" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${LINE}`,
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 18, fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: SURFACE,
          fontSize: "0.875rem",
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
          backgroundColor: "#FBFAF7",
          borderBottom: `1px solid ${LINE}`,
          paddingBlock: 12,
        },
        root: {
          borderBottom: `1px solid ${LINE}`,
          paddingBlock: 12,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-of-type td": { borderBottom: "none" },
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
