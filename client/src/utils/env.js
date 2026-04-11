// In dev, Vite proxies /api → localhost:5001. In production (served from Express), /api is on the same origin.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");
