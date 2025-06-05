import { BOT } from "../types/bot";
import { db } from "../config/firebase.config";
import { ApiError } from "../utils/apiError";
import { generateCompleteCode } from "./ai.service";

export class BotService {
  private static readonly COLLECTION = "bots";

  private static removeEmptyFields(data: any): any {
    const cleanData = { ...data };
    Object.keys(cleanData).forEach((key) => {
      if (
        cleanData[key] === undefined ||
        cleanData[key] === null ||
        cleanData[key] === ""
      ) {
        delete cleanData[key];
      } else if (
        typeof cleanData[key] === "object" &&
        !Array.isArray(cleanData[key])
      ) {
        cleanData[key] = this.removeEmptyFields(cleanData[key]);
        if (Object.keys(cleanData[key]).length === 0) {
          delete cleanData[key];
        }
      }
    });
    return cleanData;
  }

  static async create(
    botData: Omit<BOT, "id" | "createdAt" | "updatedAt">
  ): Promise<BOT> {
    let docRef;
    try {
      const cleanedData = this.removeEmptyFields(botData);
      const now = new Date();

      // Create the bot with pending status
      docRef = await db.collection(this.COLLECTION).add({
        ...cleanedData,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      } as BOT);

      return {
        id: docRef.id,
        ...cleanedData,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;

      // If we have a document reference, update it with error status
      if (docRef) {
        try {
          await docRef.update({
            status: "error",
            errorText: errorMessage,
            updatedAt: new Date(),
          });
        } catch (updateError) {
          console.error("Failed to update error status:", updateError);
        }
      }

      throw new ApiError(500, "Error creating bot", [errorMessage]);
    }
  }

  private static convertTimestamps(data: any): any {
    if (data.createdAt && typeof data.createdAt.toDate === "function") {
      data.createdAt = data.createdAt.toDate().toISOString();
    }
    if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
      data.updatedAt = data.updatedAt.toDate().toISOString();
    }
    return data;
  }

  static async getById(id: string): Promise<BOT> {
    try {
      const doc = await db.collection(this.COLLECTION).doc(id).get();

      if (!doc.exists) {
        throw new ApiError(404, "Bot not found");
      }

      const data = doc.data();
      return {
        id: doc.id,
        ...this.convertTimestamps(data),
      } as BOT;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Error retrieving bot", [
        (error as Error).message,
      ]);
    }
  }

  static async getAll(userId?: string): Promise<BOT[]> {
    try {
      const collectionRef = db.collection(this.COLLECTION);
      const snapshot = userId
        ? await collectionRef.where("userId", "==", userId).get()
        : await collectionRef.get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...this.convertTimestamps(doc.data()),
      })) as BOT[];
    } catch (error) {
      throw new ApiError(500, "Error retrieving bots", [
        (error as Error).message,
      ]);
    }
  }

  static async update(id: string, updateData: Partial<BOT>): Promise<BOT> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "Bot not found");
      }

      const cleanedData = this.removeEmptyFields(updateData);
      const now = new Date();

      await docRef.update({
        ...cleanedData,
        updatedAt: now,
      });

      const updatedDoc = await docRef.get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as BOT;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Error updating bot", [(error as Error).message]);
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "Bot not found");
      }

      await docRef.delete();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Error deleting bot", [(error as Error).message]);
    }
  }

  /**
   * Handles post-creation processing for a bot.
   * This method is called after the response has been sent to the client.
   */
  static async handlePostCreation(bot: BOT): Promise<void> {
    try {
      // Log the creation
      console.log(
        `Bot created with ID: ${bot.id} at ${new Date().toISOString()}`
      );

      // You can perform any additional async operations here, such as:
      // - Send notifications
      // - Update analytics
      // - Trigger other background processes
      // - Initialize bot configurations
      // - Set up monitoring

      // Simulate bot initialization process
      await this.initializeBot(bot);

      // Update status to initialized if everything succeeds
      await db.collection(this.COLLECTION).doc(bot.id!).update({
        updatedAt: new Date(),
        status: "initialized",
        errorText: null, // Clear any error message
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during post-creation processing";
      console.error("Error in post-creation handling:", error);

      // Update the bot status to error
      try {
        await db.collection(this.COLLECTION).doc(bot.id!).update({
          updatedAt: new Date(),
          status: "error",
          errorText: errorMessage,
        });
      } catch (updateError) {
        // If we can't even update the error status, just log it
        console.error("Failed to update error status:", updateError);
      }
    }
  }

  /**
   * Initialize a bot after creation. This is where you would put your actual
   * bot initialization logic.
   */
  private static async initializeBot(bot: BOT): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    try {
      console.log(`[Bot ${bot.id}] Starting initialization process...`);
      console.log(
        `[Bot ${bot.id}] Generating code from prompt: "${bot.prompt.substring(0, 50)}..."`
      );

      // Generate the bot code using AI
      const response = await generateCompleteCode(bot.prompt);
      console.log(
        "[Bot ${bot.id}] Raw AI response:",
        JSON.stringify(response, null, 2)
      );

      if (!response || typeof response === "string") {
        throw new Error(`Invalid code generated, error ${response || ""}`);
      }

      // Extract the backend code from the response
      const generatedCode = response.backend!;

      // // Validate generated code
      // if (!generatedCode || typeof generatedCode !== "string") {
      //   throw new Error(
      //     `Invalid code generated. Expected string in backend field but got ${typeof generatedCode}`
      //   );
      // }

      console.log(
        `[Bot ${bot.id}] Code generated successfully (${generatedCode.length} characters)`
      );

      // Create the bots directory if it doesn't exist
      const publicDir = path.join(__dirname, "..", "public", "bots");
      await fs.mkdir(publicDir, { recursive: true });
      console.log(`[Bot ${bot.id}] Ensuring directory exists: ${publicDir}`);

      // Save the generated code to a file
      const filePath = path.join(publicDir, `${bot.id}.js`);
      console.log(`[Bot ${bot.id}] Saving code to file: ${filePath}`);

      await fs.writeFile(filePath, generatedCode, "utf8");
      console.log(`[Bot ${bot.id}] Code file saved successfully`);

      // Update bot status to running
      console.log(`[Bot ${bot.id}] Updating bot status to running...`);
      await db
        .collection(this.COLLECTION)
        .doc(bot.id!)
        .update({
          status: "running",
          updatedAt: new Date(),
          botCodeUrl: `/public/bots/${bot.id}.js`,
        });

      console.log(`[Bot ${bot.id}] Initialization completed successfully`);
    } catch (error) {
      console.error(`[Bot ${bot.id}] Initialization failed:`, error);
      // Add additional error details for debugging
      if (error instanceof Error) {
        console.error(`[Bot ${bot.id}] Error name: ${error.name}`);
        console.error(`[Bot ${bot.id}] Error message: ${error.message}`);
        console.error(`[Bot ${bot.id}] Stack trace: ${error.stack}`);
      }
      throw error; // This will be caught by handlePostCreation and set error status
    }
  }
}
