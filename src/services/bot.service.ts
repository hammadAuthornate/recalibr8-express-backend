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
        access: "private",
        createdAt: now,
        updatedAt: now,
      } as BOT);

      return {
        id: docRef.id,
        ...cleanedData,
        status: "pending",
        access: "private",
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
        createdAt: doc.createTime?.toDate(),
        updatedAt: doc?.updateTime?.toDate(),
      } as BOT;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Error retrieving bot", [
        (error as Error).message,
      ]);
    }
  }

  static async getAll(marketplace: boolean, userId?: string): Promise<BOT[]> {
    try {
      const collectionRef = db.collection(this.COLLECTION);

      let query = collectionRef as any;

      // If userId is provided, filter by userId
      if (userId) {
        query = query.where("userId", "==", userId);
      }

      // If marketplace is true, filter out private bots
      if (marketplace) {
        query = query.where("access", "!=", "private");
      }

      const snapshot = await query.get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...this.convertTimestamps(doc.data()),
        createdAt: doc.createTime?.toDate(),
        updatedAt: doc?.updateTime?.toDate(),
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
      // await db.collection(this.COLLECTION).doc(bot.id!).update({
      //   updatedAt: new Date(),
      //   status: "initialized",
      //   errorText: null, // Clear any error message
      // });
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

      // Calculate port number based on total bots
      const botsSnapshot = await db.collection(this.COLLECTION).get();
      const totalBots = botsSnapshot.size;
      const portNumber = 3100 + totalBots + 1; // Start from 3101

      // Update bot document with port number
      await db.collection(this.COLLECTION).doc(bot.id!).update({
        port: portNumber,
        updatedAt: new Date(),
      });

      console.log(`[Bot ${bot.id}] Assigned port number: ${portNumber}`);
      console.log(
        `[Bot ${bot.id}] Generating code from prompt: "${bot.prompt.substring(0, 50)}..."`
      );

      // Generate the bot code using AI with calculated port
      const response = await generateCompleteCode(
        bot.prompt,
        bot.id!,
        portNumber
      );
      // console.log(
      //   "[Bot ${bot.id}] Raw AI response:",
      //   JSON.stringify(response, null, 2)
      // );

      if (!response || typeof response === "string") {
        throw new Error(`Invalid code generated, error ${response || ""}`);
      }

      // Extract the backend code from the response
      const generatedCodeAI = response.backend!;

      // // Validate generated code
      // if (!generatedCode || typeof generatedCode !== "string") {
      //   throw new Error(
      //     `Invalid code generated. Expected string in backend field but got ${typeof generatedCode}`
      //   );
      // }

      console.log("AI generated code ", generatedCodeAI);

      const generatedCode =
        "const ccxt = require('ccxt');\n\
      const express = require('express');\n\
      const fs = require('fs');\n\
      const path = require('path');\n\
      \n\
      // Global variables for data storage\n\
      const trades = [];\n\
      const botResults = {\n\
        totalTrades: 0,\n\
        winningTrades: 0,\n\
        losingTrades: 0,\n\
        totalProfit: 0,\n\
        totalLoss: 0,\n\
        netProfitLoss: 0,\n\
        winRate: 0,\n\
        currentBalance: 1000, // Starting with $1000 paper balance\n\
        initialBalance: 1000,\n\
        isRunning: false,\n\
        lastUpdate: Date.now(),\n\
        currentPrice: 0\n\
      };\n\
      \n\
      // Log file setup\n\
      const logFileName = '" +
        bot.id +
        ".txt';\n\
      const logFilePath = path.join(__dirname, logFileName);\n\
      \n\
      function log(message) {\n\
        const timestamp = new Date().toISOString();\n\
        const logMessage = '[' + timestamp + '] ' + message + '\\n';\n\
        fs.appendFileSync(logFilePath, logMessage);\n\
      }\n\
      \n\
      // Initialize Express app\n\
      const app = express();\n\
      const PORT = 3112;\n\
      \n\
      // Paper trading exchange (no API keys needed)\n\
      const exchange = new ccxt.binance({\n\
        enableRateLimit: true,\n\
        options: {\n\
          defaultType: 'spot',\n\
          adjustForTimeDifference: true\n\
        }\n\
      });\n\
      \n\
      // Grid trading parameters\n\
      const gridParams = {\n\
        symbol: 'BTC/USDT',\n\
        timeframe: '15m',\n\
        upperPrice: 0, // Will be set based on initial market conditions\n\
        lowerPrice: 0, // Will be set based on initial market conditions\n\
        gridLevels: 5,\n\
        orderAmount: 0.002, // BTC amount per order\n\
        stopLossPercent: 2, // 2% stop loss\n\
        takeProfitPercent: 1.5, // 1.5% take profit per grid level\n\
        isPaperTrading: true\n\
      };\n\
      \n\
      // Initialize the grid levels\n\
      async function initializeGrid() {\n\
        try {\n\
          const candles = await exchange.fetchOHLCV(gridParams.symbol, gridParams.timeframe, undefined, 20);\n\
          const prices = candles.map(candle => candle[4]); // Closing prices\n\
          \n\
          // Calculate upper and lower bounds based on recent price action\n\
          const maxPrice = Math.max(...prices);\n\
          const minPrice = Math.min(...prices);\n\
          const rangeBuffer = (maxPrice - minPrice) * 0.1; // 10% buffer\n\
          \n\
          gridParams.upperPrice = maxPrice + rangeBuffer;\n\
          gridParams.lowerPrice = minPrice - rangeBuffer;\n\
          \n\
          log('Grid initialized. Upper: ' + gridParams.upperPrice + ', Lower: ' + gridParams.lowerPrice);\n\
          log('Grid levels: ' + gridParams.gridLevels + ', Order amount: ' + gridParams.orderAmount + 'BTC');\n\
          \n\
          return true;\n\
        } catch (error) {\n\
          log('Error initializing grid: ' + error.message);\n\
          return false;\n\
        }\n\
      }\n\
      \n\
      // Calculate grid levels\n\
      function calculateGridLevels() {\n\
        const priceRange = gridParams.upperPrice - gridParams.lowerPrice;\n\
        const levelStep = priceRange / (gridParams.gridLevels + 1);\n\
        \n\
        const levels = [];\n\
        for (let i = 1; i <= gridParams.gridLevels; i++) {\n\
          const price = gridParams.lowerPrice + (levelStep * i);\n\
          levels.push(price);\n\
        }\n\
        \n\
        return levels;\n\
      }\n\
      \n\
      // Execute trade (paper or real)\n\
      async function executeTrade(side, price, amount) {\n\
        const trade = {\n\
          id: 'trade-' + Date.now() + '-' + Math.floor(Math.random() * 1000),\n\
          symbol: gridParams.symbol,\n\
          side,\n\
          amount,\n\
          price,\n\
          timestamp: Date.now(),\n\
          profit: 0,\n\
          status: 'open'\n\
        };\n\
        \n\
        // Add to trades array\n\
        trades.push(trade);\n\
        \n\
        // Update bot results\n\
        botResults.totalTrades++;\n\
        botResults.lastUpdate = Date.now();\n\
        \n\
        log('Executed ' + side + ' order: ' + amount + ' ' + gridParams.symbol + ' at ' + price);\n\
        \n\
        return trade;\n\
      }\n\
      \n\
      // Close trade and calculate P&L\n\
      function closeTrade(tradeId, closePrice) {\n\
        const tradeIndex = trades.findIndex(t => t.id === tradeId && t.status === 'open');\n\
        if (tradeIndex === -1) return null;\n\
        \n\
        const trade = trades[tradeIndex];\n\
        const profit = trade.side === 'buy' \n\
          ? (closePrice - trade.price) * trade.amount\n\
          : (trade.price - closePrice) * trade.amount;\n\
        \n\
        // Update trade\n\
        trade.profit = profit;\n\
        trade.status = 'closed';\n\
        \n\
        // Update bot results\n\
        botResults.netProfitLoss += profit;\n\
        botResults.lastUpdate = Date.now();\n\
        \n\
        if (profit > 0) {\n\
          botResults.winningTrades++;\n\
          botResults.totalProfit += profit;\n\
        } else {\n\
          botResults.losingTrades++;\n\
          botResults.totalLoss += Math.abs(profit);\n\
        }\n\
        \n\
        botResults.winRate = (botResults.winningTrades / botResults.totalTrades) * 100;\n\
        \n\
        // Update paper balance\n\
        if (gridParams.isPaperTrading) {\n\
          botResults.currentBalance += profit;\n\
        }\n\
        \n\
        log('Closed trade ' + tradeId + '. P&L: ' + profit + ' USDT');\n\
        \n\
        return trade;\n\
      }\n\
      \n\
      // Main trading strategy\n\
      async function runStrategy() {\n\
        try {\n\
          botResults.isRunning = true;\n\
          log('Starting grid trading bot...');\n\
          \n\
          // Initialize grid levels\n\
          const initialized = await initializeGrid();\n\
          if (!initialized) {\n\
            log('Failed to initialize grid. Stopping bot.');\n\
            botResults.isRunning = false;\n\
            return;\n\
          }\n\
          \n\
          // Main trading loop\n\
          const tradingInterval = setInterval(async () => {\n\
            if (!botResults.isRunning) {\n\
              clearInterval(tradingInterval);\n\
              return;\n\
            }\n\
            \n\
            try {\n\
              // Get current price\n\
              const ticker = await exchange.fetchTicker(gridParams.symbol);\n\
              const currentPrice = ticker.last;\n\
              botResults.currentPrice = currentPrice;\n\
              \n\
              // Check if price is outside our grid range\n\
              if (currentPrice > gridParams.upperPrice || currentPrice < gridParams.lowerPrice) {\n\
                log('Price (' + currentPrice + ') outside grid range. Stopping bot.');\n\
                botResults.isRunning = false;\n\
                return;\n\
              }\n\
              \n\
              // Calculate grid levels\n\
              const gridLevels = calculateGridLevels();\n\
              \n\
              // Check for buy signals (price near grid levels)\n\
              for (const level of gridLevels) {\n\
                const priceDiff = Math.abs(currentPrice - level);\n\
                const priceDiffPercent = (priceDiff / currentPrice) * 100;\n\
                \n\
                // If price is within 0.5% of a grid level and we don't have an open position at this level\n\
                if (priceDiffPercent < 0.5) {\n\
                  const hasOpenTrade = trades.some(t => \n\
                    Math.abs(t.price - level) < 0.0001 && t.status === 'open');\n\
                  \n\
                  if (!hasOpenTrade) {\n\
                    // Execute buy order\n\
                    const trade = await executeTrade('buy', currentPrice, gridParams.orderAmount);\n\
                    \n\
                    // Set take profit and stop loss levels\n\
                    const takeProfitPrice = currentPrice * (1 + (gridParams.takeProfitPercent / 100));\n\
                    const stopLossPrice = currentPrice * (1 - (gridParams.stopLossPercent / 100));\n\
                    \n\
                    // Simulate order execution (in a real bot, we'd monitor these levels)\n\
                    setTimeout(() => {\n\
                      const newTicker = exchange.fetchTicker(gridParams.symbol)\n\
                        .then(t => {\n\
                          const newPrice = t.last;\n\
                          \n\
                          // Check if price hit take profit or stop loss\n\
                          if (newPrice >= takeProfitPrice || newPrice <= stopLossPrice) {\n\
                            closeTrade(trade.id, newPrice);\n\
                          }\n\
                        });\n\
                    }, 10000); // Check after 10 seconds (simulated)\n\
                  }\n\
                }\n\
              }\n\
              \n\
              // Check for sell signals on open positions\n\
              const openTrades = trades.filter(t => t.status === 'open' && t.side === 'buy');\n\
              for (const trade of openTrades) {\n\
                const profitPercent = ((currentPrice - trade.price) / trade.price) * 100;\n\
                \n\
                if (profitPercent >= gridParams.takeProfitPercent || \n\
                    profitPercent <= -gridParams.stopLossPercent) {\n\
                  closeTrade(trade.id, currentPrice);\n\
                }\n\
              }\n\
              \n\
            } catch (error) {\n\
              log('Error in trading loop: ' + error.message);\n\
            }\n\
          }, 60000); // Check every minute\n\
          \n\
        } catch (error) {\n\
          log('Error in strategy: ' + error.message);\n\
          botResults.isRunning = false;\n\
        }\n\
      }\n\
      \n\
      // API Endpoints\n\
      app.get('/api/trades', (req, res) => {\n\
        res.json(trades);\n\
      });\n\
      \n\
      app.get('/api/results', (req, res) => {\n\
        res.json(botResults);\n\
      });\n\
      \n\
      // Start server and bot\n\
      app.listen(PORT, () => {\n\
        log('Server running on port ' + PORT);\n\
        runStrategy().catch(err => log('Failed to start bot: ' + err.message));\n\
      });\n\
      \n\
      // Handle shutdown gracefully\n\
      process.on('SIGINT', () => {\n\
        log('Shutting down bot...');\n\
        botResults.isRunning = false;\n\
        process.exit();\n\
      });";

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
      // Update bot status and code URL in database
      await db
        .collection(this.COLLECTION)
        .doc(bot.id!)
        .update({
          status: "running",
          updatedAt: new Date(),
          botCodeUrl: `/public/bots/${bot.id}.js`,
        });

      // Start the process
      const { ProcessService } = await import("./process.service");
      await ProcessService.startProcess({
        ...bot,
        processKey: bot.id!,
      });

      console.log(
        `[Bot ${bot.id}] Initialization and process start completed successfully`
      );
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
