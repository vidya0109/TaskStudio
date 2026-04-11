import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import App from "./app/App";
import { createAppTheme } from "./theme/theme";

function RootApp() {
  const [mode, setMode] = useState(() => {
    const storedMode = localStorage.getItem("app-theme-mode");
    return storedMode === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("app-theme-mode", mode);
  }, [mode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App mode={mode} onToggleTheme={toggleTheme} />
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
