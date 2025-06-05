import { Router } from "express";
import { BotRouter } from "./bot.router";

const router = Router();

router.use("/bots", BotRouter);

export { router as MainRouter };
