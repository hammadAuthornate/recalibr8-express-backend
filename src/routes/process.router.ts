import { Router, Request, Response } from "express";
import { ProcessService } from "../services/process.service";
import { asyncHandler } from "../utils/asyncHandler";
import { apiResponse } from "../utils/apiResponse";
import { BotConfig } from "../types/bot";

const router = Router();

// Start a new process
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const config: BotConfig = req.body;
    if (!config.processKey) {
      throw new Error("Process key is required");
    }

    const process = await ProcessService.startProcess(config);
    res
      .status(201)
      .json(apiResponse(true, "Process started successfully", process));
  })
);

// Get all processes
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const processes = await ProcessService.getAllProcesses();
    res
      .status(200)
      .json(apiResponse(true, "Processes retrieved successfully", processes));
  })
);

// Get a specific process
router.get(
  "/:processKey",
  asyncHandler(async (req: Request, res: Response) => {
    const process = await ProcessService.getProcessByKey(req.params.processKey);
    res
      .status(200)
      .json(apiResponse(true, "Process retrieved successfully", process));
  })
);

// Stop a process
router.delete(
  "/:processKey",
  asyncHandler(async (req: Request, res: Response) => {
    await ProcessService.stopProcess(req.params.processKey);
    res.status(200).json(apiResponse(true, "Process stopped successfully"));
  })
);

export { router as ProcessRouter };
