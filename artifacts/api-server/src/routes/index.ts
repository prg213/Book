import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storiesRouter from "./stories";
import uploadRouter from "./upload";
import characterRouter from "./character";
import colouringRouter from "./colouring";
import audioRouter from "./audio";
import videoRouter from "./video";
import mobileRelayRouter from "./mobile-relay";
import imagesRouter from "./images";
import stripeRouter from "./stripe";
import adminRouter from "./admin";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use(imagesRouter);   // GET /api/images/:subdir/:filename — GCS-backed image serving
router.use(uploadRouter);
router.use(characterRouter);
router.use(storiesRouter);
router.use(colouringRouter);
router.use(audioRouter);
router.use(videoRouter);
router.use("/auth/mobile-relay", mobileRelayRouter);
router.use(stripeRouter);
router.use(adminRouter);
router.use(supportRouter);

export default router;
