import { Request, Response, NextFunction } from "express";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next); // Catch errors and pass them to next
    };
};
