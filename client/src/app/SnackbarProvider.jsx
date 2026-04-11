import { createContext, useCallback, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export const SnackbarContext = createContext({
  showMessage: (_message, _severity) => {}
});

export function SnackbarProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    message: "",
    severity: "info"
  });

  const showMessage = useCallback((message, severity = "info") => {
    setState({ open: true, message, severity });
  }, []);

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo(() => ({ showMessage }), [showMessage]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={state.severity} onClose={handleClose} variant="filled">
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
