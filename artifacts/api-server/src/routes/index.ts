import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storiesRouter from "./stories";
import uploadRouter from "./upload";
import characterRouter from "./character";
import colouringRouter from "./colouring";
import audioRouter from "./audio";
import videoRouter from "./video";
import mobileRelayRouter from "./mobile-relay";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(characterRouter);
router.use(storiesRouter);
router.use(colouringRouter);
router.use(audioRouter);
router.use(videoRouter);
router.use("/auth/mobile-relay", mobileRelayRouter);

export default router;
