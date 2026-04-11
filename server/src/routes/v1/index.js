// server/src/routes/v1/index.js
import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import taskRoutes from "./taskRoutes.js";
import aiRoutes from "./aiRoutes.js";

const router = Router();

router.use(healthRoutes);
router.use(taskRoutes);
router.use(aiRoutes);

export default router;