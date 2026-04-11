import httpClient from "./http/httpClient";

export async function getApiHealth() {
  const { data } = await httpClient.get("/health");
  return data;
}
