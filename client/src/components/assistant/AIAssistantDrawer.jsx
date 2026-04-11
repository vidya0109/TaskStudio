import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import {
  indexCodebase,
  streamAskCodebase
} from "../../services/assistantService";

export default function AIAssistantDrawer({ open, onClose, onDisableAssistant }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [askMode, setAskMode] = useState("rag");

  async function handleIndexCodebase() {
    try {
      setErrorMessage("");
      setIsIndexing(true);
      const response = await indexCodebase();
      setAnswer(
        `Indexed successfully. Files: ${response?.data?.fileCount ?? 0}, Chunks: ${
          response?.data?.chunkCount ?? 0
        }`
      );
      setSources([]);
    } catch (error) {
      setErrorMessage(error.message || "Failed to index codebase");
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleAsk() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setErrorMessage("Please enter a question");
      return;
    }

    try {
      setErrorMessage("");
      setIsAsking(true);
      setAnswer("");
      setSources([]);

      await streamAskCodebase({
        question: trimmedQuestion,
        mode: askMode,
        onToken: (token) => {
          setAnswer((prev) => prev + token);
        },
        onSources: (nextSources) => {
          setSources(nextSources);
        },
        onDone: (finalAnswer) => {
          if (!finalAnswer) {
            return;
          }
          setAnswer((prev) => (prev.trim() ? prev : finalAnswer));
        },
        onError: (message) => {
          setErrorMessage(message || "Failed to stream AI answer");
        }
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to get AI answer");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={700}>
            AI Code Assistant
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ask questions about your codebase using indexed project context.
          </Typography>

          <ToggleButtonGroup
            size="small"
            value={askMode}
            exclusive
            onChange={(_event, value) => {
              if (value) {
                setAskMode(value);
              }
            }}
            aria-label="assistant-mode"
          >
            <ToggleButton value="rag">RAG</ToggleButton>
            <ToggleButton value="agent">Agent</ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            onClick={handleIndexCodebase}
            disabled={isIndexing}
          >
            {isIndexing ? "Indexing..." : "Index Codebase"}
          </Button>

          <Divider />

          <TextField
            label="Ask a question"
            placeholder="Where are task routes defined?"
            multiline
            minRows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />

          <Button
            variant="contained"
            onClick={handleAsk}
            disabled={isAsking}
          >
            {isAsking
              ? "Asking..."
              : `Ask AI (${askMode === "agent" ? "Agent" : "RAG"})`}
          </Button>

          <Button color="error" variant="text" onClick={onDisableAssistant}>
            Disable AI Assistant
          </Button>

          {(isIndexing || isAsking) && (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography variant="body2">Processing...</Typography>
            </Box>
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          {answer && (
            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Typography variant="subtitle2" mb={1}>
                Answer
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {answer}
              </Typography>
            </Box>
          )}

          {sources.length > 0 && (
            <Box>
              <Typography variant="subtitle2" mb={1}>
                Sources
              </Typography>
              <Stack spacing={0.75}>
                {sources.map((source, index) => (
                  <Typography key={`${source.filePath}-${index}`} variant="caption" color="text.secondary">
                    {source.filePath} (chunk {source.chunkIndex})
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}