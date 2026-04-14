import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import {
  indexCodebase,
  streamAskCodebase
} from "../../services/assistantService";

const CONFIDENCE_COLORS = {
  High: "success",
  Medium: "warning",
  Low: "error"
};

export default function AIAssistantDrawer({ open, onClose, onDisableAssistant }) {
  const [question, setQuestion] = useState("");
  const [rawTokens, setRawTokens] = useState("");
  const [parsedAnswer, setParsedAnswer] = useState(null);
  const [indexMessage, setIndexMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  async function handleIndexCodebase() {
    try {
      setErrorMessage("");
      setIndexMessage("");
      setIsIndexing(true);
      const response = await indexCodebase();
      setIndexMessage(
        `Indexed successfully — ${response?.data?.fileCount ?? 0} files, ${response?.data?.chunkCount ?? 0} chunks`
      );
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
      setRawTokens("");
      setParsedAnswer(null);

      await streamAskCodebase({
        question: trimmedQuestion,
        onToken: (token) => {
          setRawTokens((prev) => prev + token);
        },
        onSources: () => {},
        onDone: () => {
          setRawTokens((accumulated) => {
            try {
              setParsedAnswer(JSON.parse(accumulated));
            } catch {
              setParsedAnswer({
                answer: [accumulated || "No answer generated."],
                codePointers: [],
                confidence: "Low",
                confidenceReason: "Could not parse structured response"
              });
            }
            return accumulated;
          });
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

          <Button
            variant="outlined"
            onClick={handleIndexCodebase}
            disabled={isIndexing}
          >
            {isIndexing ? "Indexing..." : "Index Codebase"}
          </Button>

          {indexMessage && (
            <Alert severity="success" sx={{ py: 0.5 }}>{indexMessage}</Alert>
          )}

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
            {isAsking ? "Asking..." : "Ask AI"}
          </Button>

          <Button color="error" variant="text" onClick={onDisableAssistant}>
            Disable AI Assistant
          </Button>

          {isAsking && (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Thinking...
              </Typography>
            </Box>
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          {parsedAnswer && (
            <Stack spacing={1.5}>
              {/* Answer bullets */}
              <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <Typography variant="subtitle2" mb={1}>Answer</Typography>
                <Stack spacing={0.5}>
                  {parsedAnswer.answer.map((point, i) => (
                    <Typography key={i} variant="body2">
                      • {point}
                    </Typography>
                  ))}
                </Stack>
              </Box>

              {/* Code pointers */}
              {parsedAnswer.codePointers.length > 0 && (
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                  <Typography variant="subtitle2" mb={1}>Code Pointers</Typography>
                  <Stack spacing={0.75}>
                    {parsedAnswer.codePointers.map((pointer, i) => (
                      <Box key={i}>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: "monospace", color: "primary.main" }}
                        >
                          {pointer.file}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {" "}— {pointer.reason}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Confidence badge */}
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={parsedAnswer.confidence}
                  color={CONFIDENCE_COLORS[parsedAnswer.confidence] || "default"}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  {parsedAnswer.confidenceReason}
                </Typography>
              </Box>
            </Stack>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
