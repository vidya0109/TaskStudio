import { useCallback, useContext, useEffect, useState } from "react";
import { Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../../components/common/PageContainer";
import HeroCard from "../components/HeroCard";
import useAsync from "../../../hooks/useAsync";
import { getApiHealth } from "../../../services/healthService";
import { SnackbarContext } from "../../../app/SnackbarProvider";

export default function HomePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("unknown");
  const { showMessage } = useContext(SnackbarContext);
  const { run, loading } = useAsync(getApiHealth);

  const loadHealth = useCallback(async () => {
    try {
      const response = await run();
      setStatus(response?.status || "ok");
      showMessage("API is reachable", "success");
    } catch (_error) {
      setStatus("unavailable");
      showMessage("Could not reach API", "error");
    }
  }, [run, showMessage]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Typography variant="overline" color="text.secondary">
          Client Dashboard
        </Typography>
        <HeroCard
          onRefresh={loadHealth}
          onGoToTasks={() => navigate("/tasks")}
          isLoading={loading}
          status={status}
        />
      </Stack>
    </PageContainer>
  );
}
