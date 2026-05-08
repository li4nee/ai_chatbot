import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';

/**
 * AI Service using LangChain with Gemini.
 * Standardized for easy switching between models in the future.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly chatModel: ChatGoogleGenerativeAI;
  private readonly embeddingsModel: GoogleGenerativeAIEmbeddings;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey,
      modelName: 'gemini-2.5-flash',
      temperature: 0.2,
      maxOutputTokens: 1024,
      maxRetries: 0, // This makes the error show up "sooner" by failing immediately on invalid models
    });

    this.embeddingsModel = new GoogleGenerativeAIEmbeddings({
      apiKey,
      modelName: 'gemini-embedding-001',
    });
  }

  /**
   * Generate an AI response using LangChain and RAG.
   */
  async generateResponse(
    context: string,
    userMessage: string,
    conversationHistory: { role: string; content: string }[] = [],
  ): Promise<string> {
    try {
      const systemInstruction = `You are a friendly and professional Customer Service Assistant for the project described in the context.
        
[TONE & STYLE]
- Be helpful, polite, and conversational.
- Use "we" and "us" when referring to the company/project.
- Keep answers concise but welcoming.

[KNOWLEDGE CONTEXT]
${context || 'No knowledge base loaded.'}

[OBJECTIVE]
Answer the [CURRENT QUESTION] using the provided [KNOWLEDGE CONTEXT].

[RULES]
1. Answer ONLY the [CURRENT QUESTION] based on the context.
2. If the answer is NOT in the [KNOWLEDGE CONTEXT]:
   - Do NOT say "I don't have information about that in my knowledge base."
   - Instead, say something like: "I'm sorry, I don't have that specific information on hand right now. Is there anything else I can help you with?" or "I'm not exactly sure about that, but feel free to ask me about [Topic from context]."
3. Never use technical jargon like "context," "embeddings," or "knowledge base" when talking to users.
4. If you see unrelated previous questions in [CONVERSATION HISTORY], ignore them and focus on the [CURRENT QUESTION].`;

      const messages: BaseMessage[] = [new SystemMessage(systemInstruction)];

      // Add conversation history
      conversationHistory.forEach((msg) => {
        if (msg.role === 'user') {
          messages.push(
            new HumanMessage(`[PAST USER QUESTION]: ${msg.content}`),
          );
        } else {
          messages.push(new AIMessage(`[PAST AI RESPONSE]: ${msg.content}`));
        }
      });

      // Add current user message
      messages.push(new HumanMessage(`[CURRENT QUESTION]: ${userMessage}`));

      // Log the prompt structure
      this.logger.log(`LangChain Invoke: ${messages.length} messages in chain`);

      const response = await this.chatModel.invoke(messages);

      return typeof response.content === 'string'
        ? response.content
        : 'Sorry, I could not process your request.';
    } catch (error) {
      this.logger.error('LangChain Gemini error:', error.message);
      return 'I apologize, but I encountered a temporary issue while processing your request. How else can I assist you?';
    }
  }

  /**
   * Generate an embedding vector using LangChain.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.embeddingsModel.embedQuery(text);
    } catch (error) {
      this.logger.error('LangChain Embedding error:', error.message);
      return [];
    }
  }
}
