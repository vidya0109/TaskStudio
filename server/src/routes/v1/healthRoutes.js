import { Router } from "express";
import { getHealth } from "../../controllers/v1/healthController.js";

const router = Router();

router.get("/health", getHealth);

export default router;
