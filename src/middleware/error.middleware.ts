import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
// import logger from "../config/logger";

export const errorHandler = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // console.log(err);
    console.error(err); // Log unexpected errors

    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err,
        }); // Respond with API error details
    } else {
        res.status(500).json({
            success: false,
            message: "Internal server error", // Generic error message
        });
    }
};
