import httpClient from "./http/httpClient";

export async function getTasks() {
  const { data } = await httpClient.get("/tasks");
  return data;
}

export async function createTask(payload) {
  const { data } = await httpClient.post("/tasks", payload);
  return data;
}

export async function updateTask(id, payload) {
  const { data } = await httpClient.put(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id) {
  const { data } = await httpClient.delete(`/tasks/${id}`);
  return data;
}