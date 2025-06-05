export const cleanGeneratedCode = (output: string) => {
  const codeMatch = output.match(
    /```(?:javascript|typescript)\n([\s\S]*?)\n```/
  );
  return codeMatch && codeMatch[1] ? codeMatch[1].trim() : output.trim();
};

export const AICall = async (role: string, prompt: string, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: role },
              { role: "user", content: prompt },
            ],
            stream: false,
          }),
        }
      );

      const data = (await response.json()) as any;
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
      throw new Error("Invalid response from OpenAI API");
    } catch (error) {
      if (attempt === retries) {
        console.error(`Error after ${retries} attempts:`, error);
        return `// Error generating code: ${
          (error as unknown as { message: string }).message
        }\n// Please try again later.`;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
};

export async function generateCompleteCode(
  answer: string,
  txtFileName: string,
  port: number
) {
  const prompt = `
    You are an expert Node.js developer specializing in trading bots. Generate a complete functional trading bot based on this strategy:

    User Strategy: ${JSON.stringify(answer, null, 2)}

    Requirements:
    1. Use Node.js with ccxt library for Binance exchange
    2. Default timeframe: 15m (unless user specified different)
    3. Default symbol: BTC/USDT (unless user specified different)
    4. Include the user's entry and exit conditions
    5. Add basic risk management (stop loss, position sizing)
    6. Paper trading mode by default for safety
    7. Paper trading should be working without api keys

    CRITICAL - STANDARDIZED DATA STORAGE:
    The bot must store data in these exact formats for API access:

    1. TRADES ARRAY - Store each trade as:
    {
      id: string,
      symbol: string,
      side: 'buy' | 'sell',
      amount: number,
      price: number,
      timestamp: number,
      profit: number, // calculated profit/loss for this trade
      status: 'open' | 'closed'
    }

    2. BOT RESULTS OBJECT - Store overall performance as:
    {
      totalTrades: number,
      winningTrades: number,
      losingTrades: number,
      totalProfit: number,
      totalLoss: number,
      netProfitLoss: number,
      winRate: number, // percentage
      currentBalance: number,
      initialBalance: number,
      isRunning: boolean,
      lastUpdate: number, // timestamp
      currentPrice: number
    }

    MANDATORY API ENDPOINTS:
    Include these two Express.js routes in the generated code:

    1. GET /api/trades - Returns the trades array
    2. GET /api/results - Returns the bot results object

    Store all data in memory using global variables (trades array and results object). Update these data structures whenever trades happen or bot status changes.

    Keep all logs in a separate ${txtFileName}.txt file that should be in the same directory as the current file. txt file name must be "${txtFileName}.txt" and keep updated on log changes.
    Must use port ${port} to run the server.

    Generate only the complete Node.js code with Express server, trading logic, and the two required API routes.
    `;

  try {
    const code = await AICall(
      "Expert Node.js developer for trading systems",
      prompt
    );
    return { backend: cleanGeneratedCode(code), frontend: "" };
  } catch (error) {
    return `// Error generating trading logic: ${
      (error as unknown as Error).message
    }`;
  }
}
