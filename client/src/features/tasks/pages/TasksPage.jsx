// client/src/features/tasks/pages/TasksPage.jsx
import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Checkbox,
  IconButton,
  Tooltip
} from "@mui/material";
import PageContainer from "../../../components/common/PageContainer";
import { createTask, getTasks, updateTask, deleteTask } from "../../../services/taskService";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    async function loadTasks() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getTasks();
        setTasks(response?.data || []);
      } catch (error) {
        setErrorMessage(error.message || "Failed to load tasks");
      } finally {
        setIsLoading(false);
      }
    }

    void loadTasks();
  }, []);

  async function handleCreateTask(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Title is required");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      const response = await createTask({ title: trimmedTitle });
      const createdTask = response?.data;

      if (createdTask) {
        setTasks((prev) => [createdTask, ...prev]);
      }

      setTitle("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to create task");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleTask(task) {

    try {
      setErrorMessage("");
      const response = await updateTask(task.id, { completed: !task.completed });
      const updatedTask = response?.data;

      if (updatedTask) {
        setTasks((prev) => prev.map((t) => t.id === updatedTask.id ? updatedTask : t));
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to toggle task");
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      setErrorMessage("");
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete task");
    }
  }

  function handleStartEdit(task) {

    setErrorMessage("");
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
    setEditingTitle("");
  }

  async function handleSaveEdit(taskId) {
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) {
      setErrorMessage("Title is required");
      return;
    }
    try {
      setIsSavingEdit(true);
      setErrorMessage("");
      const response = await updateTask(taskId, { title: trimmedTitle });
      const updatedTask = response?.data;

      if (updatedTask) {
        setTasks((prev) => prev.map((t) => t.id === updatedTask.id ? updatedTask : t));
      }

      handleCancelEdit();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save task");
    } finally {
      setIsSavingEdit(false);
    }
  }
  return (
    <PageContainer>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>
          Tasks
        </Typography>
        <Box
          component="form"
          onSubmit={handleCreateTask}
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            backgroundColor: "background.paper"
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Task title"
              placeholder="Enter a task name"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isCreating}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={isCreating}
              startIcon={<AddIcon />}
              sx={{ minWidth: { xs: "100%", sm: 150 }, height: 40 }}
            >
              {isCreating ? "Adding..." : "Add Task"}
            </Button>
          </Stack>
        </Box>

        {isLoading && (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={20} />
            <Typography>Loading tasks...</Typography>
          </Box>
        )}

        {!isLoading && errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {!isLoading && !errorMessage && tasks.length === 0 && (
          <Alert severity="info">No tasks yet. Add one in the next step.</Alert>
        )}

        {!isLoading &&
          !errorMessage &&
          tasks.map((task) => (
            <Card
              key={task.id}
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider" }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                    <Checkbox
                      checked={Boolean(task.completed)}
                      onChange={() => handleToggleTask(task)}
                      inputProps={{ "aria-label": `toggle-task-${task.id}` }}
                    />

                    {editingTaskId === task.id ? (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flex: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          disabled={isSavingEdit}
                        />
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            color="primary"
                            onClick={() => handleSaveEdit(task.id)}
                            disabled={isSavingEdit}
                            aria-label={`save-task-${task.id}`}
                          >
                            <SaveOutlinedIcon />
                          </IconButton>
                          <IconButton
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            aria-label={`cancel-edit-task-${task.id}`}
                          >
                            <CloseOutlinedIcon />
                          </IconButton>
                        </Stack>
                      </Stack>
                    ) : (
                      <Box>
                        <Typography
                          fontWeight={600}
                          sx={{
                            textDecoration: task.completed ? "line-through" : "none",
                            color: task.completed ? "text.secondary" : "text.primary"
                          }}
                        >
                          {task.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Status: {task.completed ? "Completed" : "Pending"}
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  <Tooltip title="Edit task">
                    <span>
                      <IconButton
                        onClick={() => handleStartEdit(task)}
                        disabled={editingTaskId === task.id}
                        aria-label={`edit-task-${task.id}`}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title="Delete task">
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label={`delete-task-${task.id}`}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          ))}
      </Stack>
    </PageContainer>
  );
}