import asyncHandler from "../../utils/asyncHandler.js";
import { getHealthStatus } from "../../services/v1/healthService.js";

export const getHealth = asyncHandler(async (_req, res) => {
  const health = await getHealthStatus();
  res.status(200).json(health);
});
