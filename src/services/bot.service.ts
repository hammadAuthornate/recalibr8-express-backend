import { BOT } from "../types/bot";
import { db } from "../config/firebase.config";
import { ApiError } from "../utils/apiError";

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
    try {
      const cleanedData = this.removeEmptyFields(botData);
      const now = new Date();

      const docRef = await db.collection(this.COLLECTION).add({
        ...cleanedData,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id: docRef.id,
        ...cleanedData,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new ApiError(500, "Error creating bot", [(error as Error).message]);
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
}
