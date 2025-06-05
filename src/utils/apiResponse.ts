// Utility function to standardize API responses
export const apiResponse = (
    success: boolean,
    message: string,
    data?: unknown,
    errors?: string[]
) => {
    return {
        success,
        message,
        data, // Response data
        errors, // Optional array of errors
    };
};
