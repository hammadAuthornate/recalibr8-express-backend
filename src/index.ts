import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";

dotenv.config();

import { apiResponse } from "./utils/apiResponse";

import fs from "node:fs";
import util from "node:util";
import path from "node:path";
import { Readable } from "node:stream";
import { errorHandler } from "./middleware/error.middleware";
import { MainRouter } from "./routes";

const app = express();
const port = process.env.PORT!;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(
  morgan("combined", {
    stream: { write: (message) => console.info(message.trim()) },
  })
);

// Serve static files from the public directory
app.use("/public", express.static(path.join(__dirname, "public")));

// Middleware to set a timeout
const setRequestTimeout = (req: any, res: any, next: any) => {
  // Set timeout value (e.g., 10 minutes)
  const timeout = 600000; // Create a timeout handler
  const timeoutHandler = setTimeout(() => {
    res.status(504).send("Timeout Gateway");
  }, timeout);
  // Clear the timeout if the response finishes before the timeout
  res.on("finish", () => {
    clearTimeout(timeoutHandler);
  });
  // Continue to the next middleware
  next();
}; // Use the timeout middleware
app.use(setRequestTimeout);

// Body Parser
app.use((req, res, next) => {
  express.json({ limit: "10kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.get("/health-check", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.use("/api", MainRouter);

app.use(errorHandler);

const server = app.listen(port, () => {
  // console.info(`[Server] running on port ${port}`);
  console.log(`[Server] running on port ${port}`);
});

module.exports = app;
// export { app, server };
