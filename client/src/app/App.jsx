import { useState } from "react";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Fab, Tooltip } from "@mui/material";
import { SnackbarProvider } from "./SnackbarProvider";
import AppRoutes from "./AppRoutes";
import TopNavBar from "../components/common/TopNavBar";
import AIAssistantDrawer from "../components/assistant/AIAssistantDrawer";

export default function App({ mode, onToggleTheme }) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantEnabled, setIsAssistantEnabled] = useState(() => {
    return localStorage.getItem("assistantEnabled") !== "false";
  });

  function disableAssistant() {
    localStorage.setItem("assistantEnabled", "false");
    setIsAssistantEnabled(false);
    setIsAssistantOpen(false);
  }

  function enableAssistant() {
    localStorage.setItem("assistantEnabled", "true");
    setIsAssistantEnabled(true);
  }

  return (
    <SnackbarProvider>
      <TopNavBar mode={mode} onToggleTheme={onToggleTheme} />
      <AppRoutes />

      {isAssistantEnabled ? (
        <Tooltip title="Open AI Assistant">
          <Fab
            color="primary"
            aria-label="open-ai-assistant"
            onClick={() => setIsAssistantOpen(true)}
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: (theme) => theme.zIndex.drawer + 1
            }}
          >
            <SmartToyOutlinedIcon />
          </Fab>
        </Tooltip>
      ) : (
        <Tooltip title="Enable AI Assistant">
          <Fab
            size="small"
            color="default"
            aria-label="enable-ai-assistant"
            onClick={enableAssistant}
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: (theme) => theme.zIndex.drawer + 1
            }}
          >
            <SmartToyOutlinedIcon />
          </Fab>
        </Tooltip>
      )}

      <AIAssistantDrawer
        open={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onDisableAssistant={disableAssistant}
      />
    </SnackbarProvider>
  );
}