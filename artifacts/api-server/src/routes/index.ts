import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import foldersRouter from "./folders";
import filesRouter from "./files";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import dashboardRouter from "./dashboard";
import knowledgeRouter from "./knowledge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(foldersRouter);
router.use(filesRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(dashboardRouter);
router.use(knowledgeRouter);

export default router;
