import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storiesRouter from "./stories";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(storiesRouter);

export default router;
