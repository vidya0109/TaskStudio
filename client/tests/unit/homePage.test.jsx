import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/app/App";

jest.mock("../../src/services/healthService", () => ({
  getApiHealth: jest.fn().mockResolvedValue({ status: "ok" })
}));

// Prevent importing real task service in route tree during this test.
jest.mock("../../src/services/taskService", () => ({
  getTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn()
}));

describe("Home page", () => {
  it("renders dashboard content", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("React + MUI Starter")).toBeInTheDocument();
    expect(screen.getByTestId("refresh-health-btn")).toBeInTheDocument();
  });
});
