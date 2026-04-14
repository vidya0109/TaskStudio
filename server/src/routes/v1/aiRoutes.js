import { Router } from "express";
import {
  indexCodebase,
  askCodebaseAgentStream
} from "../../controllers/v1/aiController.js";

const router = Router();

router.post("/ai/index", indexCodebase);
router.post("/ai/agent/stream", askCodebaseAgentStream);

export default router;