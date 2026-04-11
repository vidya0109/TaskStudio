import request from "supertest";
import app from "../src/app.js";

describe("Tasks API - B3.1", () => {
  it("GET /api/tasks should return success with data array", async () => {
    const response = await request(app).get("/api/tasks");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("POST /api/tasks should create a task", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .send({ title: "Write backend tests", completed: false });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.title).toBe("Write backend tests");
    expect(response.body.data.completed).toBe(false);
  });

  it("POST /api/tasks should return 400 for empty title", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .send({ title: "   " });
  
    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBeDefined();
  });
  
  it("PUT /api/tasks/:id should update task", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .send({ title: "Before update", completed: false });
  
    const id = created.body.data.id;
  
    const response = await request(app)
      .put(`/api/tasks/${id}`)
      .send({ title: "After update", completed: true });
  
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe("After update");
    expect(response.body.data.completed).toBe(true);
  });
  
  it("PUT /api/tasks/:id should return 404 for missing task", async () => {
    const response = await request(app)
      .put("/api/tasks/99999")
      .send({ title: "No task" });
  
    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
  });
  
  it("DELETE /api/tasks/:id should delete task", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .send({ title: "Delete me", completed: false });
  
    const id = created.body.data.id;
  
    const response = await request(app).delete(`/api/tasks/${id}`);
  
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  it("DELETE /api/tasks/:id should return 404 for missing task", async () => {
    const response = await request(app).delete("/api/tasks/99999");
  
    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
  });
});