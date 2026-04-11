import { Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/common/PageContainer";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h4" fontWeight={700}>
          404 - Page not found
        </Typography>
        <Button variant="contained" onClick={() => navigate("/")}>
          Go home
        </Button>
      </Stack>
    </PageContainer>
  );
}
