import asyncHandler from "../../utils/asyncHandler.js";
import {
  listTasks,
  addTask,
  editTask,
  removeTask
} from "../../services/v1/taskService.js";

export const getTasks = asyncHandler(async (_req, res) => {
  const tasks = await listTasks();
  res.status(200).json({ success: true, data: tasks });
});

export const createTask = asyncHandler(async (req, res) => {
  const task = await addTask(req.body);
  res.status(201).json({ success: true, data: task, message: "Task created successfully" });
});

export const updateTask = asyncHandler(async (req, res) => {
  const updatedTask = await editTask(req.params.id, req.body);
  res.status(200).json({ success: true, data: updatedTask, message: "Task updated successfully" });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const result = await removeTask(req.params.id);
  res.status(200).json({ success: true, message: "Task deleted successfully" });
});