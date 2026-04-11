import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TasksPage from "../../src/features/tasks/pages/TasksPage";

jest.mock("../../src/services/taskService", () => ({
  getTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn()
}));

import { createTask, getTasks } from "../../src/services/taskService";

describe("TasksPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads tasks on mount and renders them", async () => {
    getTasks.mockResolvedValue({
      data: [
        { id: "1", title: "Learn React", completed: false },
        { id: "2", title: "Build Tasks App", completed: true }
      ]
    });

    render(<TasksPage />);

    expect(await screen.findByText("Learn React")).toBeInTheDocument();
    expect(screen.getByText("Build Tasks App")).toBeInTheDocument();
  });

  it("creates a new task and prepends it to the list", async () => {
    getTasks.mockResolvedValue({
      data: [{ id: "1", title: "Existing Task", completed: false }]
    });

    createTask.mockResolvedValue({
      data: { id: "2", title: "New Task", completed: false }
    });

    render(<TasksPage />);

    expect(await screen.findByText("Existing Task")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "New Task" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Task" }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({ title: "New Task" });
    });

    expect(await screen.findByText("New Task")).toBeInTheDocument();
  });
});