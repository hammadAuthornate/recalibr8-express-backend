// Custom error class to handle API errors
export class ApiError extends Error {
    statusCode: number;
    errors: string[];

    constructor(
        statusCode: number,
        message: string,
        errors: (string | any)[] = []
    ) {
        super(message);
        Object.setPrototypeOf(this, ApiError.prototype);
        this.name = "ApiError";

        this.statusCode = statusCode;
        this.errors = errors; // Optional array of validation errors

        Error.captureStackTrace(this, this.constructor);
    }
}
