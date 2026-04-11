import pool from "../../config/db.js";
import AppError from "../../utils/AppError.js";

// Return id as string to keep the same shape the client already expects.
const SELECT = "id::text, title, completed";

export async function listTasks() {
  const { rows } = await pool.query(
    `SELECT ${SELECT} FROM tasks ORDER BY created_at DESC`
  );
  return rows;
}

export async function addTask(payload) {
  const title = String(payload?.title || "").trim();
  if (!title) throw new AppError("Title is required", 400);

  const { rows } = await pool.query(
    `INSERT INTO tasks (title, completed)
     VALUES ($1, $2)
     RETURNING ${SELECT}`,
    [title, Boolean(payload?.completed)]
  );
  return rows[0];
}

export async function editTask(id, payload) {
  const setClauses = [];
  const values = [];

  if (payload?.title !== undefined) {
    const title = String(payload.title || "").trim();
    if (!title) throw new AppError("Title is required", 400);
    setClauses.push(`title = $${values.push(title)}`);
  }

  if (payload?.completed !== undefined) {
    setClauses.push(`completed = $${values.push(Boolean(payload.completed))}`);
  }

  if (setClauses.length === 0) {
    const { rows } = await pool.query(
      `SELECT ${SELECT} FROM tasks WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) throw new AppError("Task not found", 404);
    return rows[0];
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE tasks
     SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING ${SELECT}`,
    values
  );

  if (rows.length === 0) throw new AppError("Task not found", 404);
  return rows[0];
}

export async function removeTask(id) {
  const { rows } = await pool.query(
    `DELETE FROM tasks WHERE id = $1 RETURNING ${SELECT}`,
    [id]
  );
  if (rows.length === 0) throw new AppError("Task not found", 404);
  return rows[0];
}
