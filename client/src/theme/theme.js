import { createTheme } from "@mui/material/styles";

export function createAppTheme(mode = "light") {
  const isDarkMode = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#1565c0"
      },
      background: {
        default: isDarkMode ? "#0f172a" : "#f7f9fc",
        paper: isDarkMode ? "#111827" : "#ffffff"
      }
    },
    shape: {
      borderRadius: 12
    },
    typography: {
      fontFamily: "Inter, Roboto, Arial, sans-serif"
    }
  });
}
