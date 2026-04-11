import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { AppBar, Box, Button, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Tasks", path: "/tasks" }
];

export default function TopNavBar({ mode, onToggleTheme }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActivePath = (path) => pathname === path;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Toolbar sx={{ minHeight: 64 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ fontWeight: 700, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          Task Studio
        </Typography>

        <Box sx={{ ml: "auto", display: "flex", gap: 1, alignItems: "center" }}>
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton onClick={onToggleTheme} color="inherit" aria-label="toggle-color-mode">
              {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
          </Tooltip>
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.path}
              onClick={() => navigate(item.path)}
              variant={isActivePath(item.path) ? "contained" : "text"}
              color={isActivePath(item.path) ? "primary" : "inherit"}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
