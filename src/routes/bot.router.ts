import { Router, Request, Response } from "express";
import { BOT } from "../types/bot";
import { BotService } from "../services/bot.service";
import { asyncHandler } from "../utils/asyncHandler";
import { apiResponse } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";

const router = Router();

// Create a new bot
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const botData: Omit<BOT, "id" | "createdAt" | "updatedAt"> = req.body;

    if (!botData.userId || !botData.prompt) {
      throw new ApiError(
        400,
        "Missing required fields: userId and prompt are required"
      );
    }

    const bot = await BotService.create(botData);
    res.status(201).json(apiResponse(true, "Bot created successfully", bot));
  })
);

// Get all bots (with optional userId filter)
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    const bots = await BotService.getAll(userId);
    res
      .status(200)
      .json(apiResponse(true, "Bots retrieved successfully", bots));
  })
);

// Get a bot by ID
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const bot = await BotService.getById(req.params.id);
    res.status(200).json(apiResponse(true, "Bot retrieved successfully", bot));
  })
);

// Update a bot
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const updateData: Partial<BOT> = req.body;
    const bot = await BotService.update(req.params.id, updateData);
    res.status(200).json(apiResponse(true, "Bot updated successfully", bot));
  })
);

// Delete a bot
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await BotService.delete(req.params.id);
    res.status(200).json(apiResponse(true, "Bot deleted successfully"));
  })
);

export { router as BotRouter };
