import { Router } from "express";
import { BotRouter } from "./bot.router";
import { ProcessRouter } from "./process.router";

const router = Router();

router.use("/bots", BotRouter);
router.use("/process", ProcessRouter);

export { router as MainRouter };
