import { Router } from "express";
import {
  askCodebaseAgentStream,
  askCodebase,
  askCodebaseAgent,
  askCodebaseStream,
  indexCodebase
} from "../../controllers/v1/aiController.js";

const router = Router();

router.post("/ai/index", indexCodebase);
router.post("/ai/ask", askCodebase);
router.post("/ai/agent", askCodebaseAgent);
router.post("/ai/ask/stream", askCodebaseStream);
router.post("/ai/agent/stream", askCodebaseAgentStream);

export default router;