import { Button, Card, CardContent, Stack, Typography } from "@mui/material";

export default function HeroCard({ onRefresh, onGoToTasks, isLoading, status }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h4" component="h1" fontWeight={700}>
            React + MUI Starter
          </Typography>
          <Typography color="text.secondary">
            This frontend is structured for scalable delivery with clear feature,
            service, and test boundaries.
          </Typography>
          <Typography variant="body2">
            API health status: <strong>{status}</strong>
          </Typography>
          <Button
            variant="contained"
            onClick={onRefresh}
            disabled={isLoading}
            data-testid="refresh-health-btn"
          >
            {isLoading ? "Checking..." : "Check API Health"}
          </Button>
          <Button variant="outlined" onClick={onGoToTasks} data-testid="go-tasks-btn">
            Go to Tasks
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
