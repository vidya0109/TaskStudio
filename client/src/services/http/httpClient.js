import axios from "axios";
import { API_BASE_URL } from "../../utils/env";

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "ngrok-skip-browser-warning": "true"
  }
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message || error?.message || "Unexpected error";
    return Promise.reject(new Error(message));
  }
);

export default httpClient;
