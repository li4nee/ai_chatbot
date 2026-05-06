import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';


/**
 * AI Service using Gemini API with simple RAG.
 * Abstracted behind a clear interface for future extensibility
 * (e.g., swap to OpenAI, add phone/voice integration).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
  }

  /**
   * Generate an AI response using RAG.
   * @param context - Knowledge text for the bot
   * @param userMessage - The user's question
   * @param conversationHistory - Previous messages for continuity
   */
  async generateResponse(
    context: string,
    userMessage: string,
    conversationHistory: { role: string; content: string }[] = [],
  ): Promise<string> {
    try {
      // Build the system instruction with RAG context
      const systemInstruction = context
        ? `You are a helpful assistant. Answer the user's question based ONLY on the following context. If the answer cannot be found in the context, say "I don't have enough information to answer that question."\n\nContext:\n${context}`
        : `You are a helpful assistant. You don't have any specific knowledge base loaded. Let the user know they should add knowledge to this bot through the admin panel.`;

      // Build the conversation contents for Gemini
      const contents = conversationHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Add the current user message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: 1024,
          temperature: 0.3,
        },
      });

      return response.text || 'Sorry, I could not generate a response.';
    } catch (error) {
      this.logger.error('Gemini API error:', error);
      return 'Sorry, I encountered an error. Please try again later.';
    }
  }
}
