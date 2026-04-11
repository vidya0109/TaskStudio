import { Container } from "@mui/material";

export default function PageContainer({ children }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      {children}
    </Container>
  );
}
