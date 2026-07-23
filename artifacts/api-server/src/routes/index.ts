import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storiesRouter from "./stories";
import uploadRouter from "./upload";
import characterRouter from "./character";
import colouringRouter from "./colouring";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(characterRouter);
router.use(storiesRouter);
router.use(colouringRouter);

export default router;
