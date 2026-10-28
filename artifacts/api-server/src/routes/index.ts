import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purpleAiRouter from "./purpleai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(purpleAiRouter);

export default router;
