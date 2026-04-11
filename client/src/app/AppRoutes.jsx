import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "../features/home/pages/HomePage";
import TasksPage from "../features/tasks/pages/TasksPage";
import NotFoundPage from "../pages/NotFoundPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

