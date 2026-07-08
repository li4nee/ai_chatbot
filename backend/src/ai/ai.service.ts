import { Injectable, Logger } from '@nestjs/common';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { ChatMistralAI, MistralAIEmbeddings } from '@langchain/mistralai';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { AiProvider } from './ai-provider.enum';

const MAX_CACHED_CLIENTS = 200;

type ChatModel = ChatGoogleGenerativeAI | ChatOpenAI | ChatAnthropic | ChatGroq | ChatMistralAI;
type EmbeddingsModel = GoogleGenerativeAIEmbeddings | OpenAIEmbeddings | MistralAIEmbeddings;

interface ProviderClients {
  chatModel: ChatModel;
  embeddingsModel?: EmbeddingsModel;
}

/**
 * AI Service using LangChain — BYOK across five providers. Every call takes the
 * caller's own key (there is no platform-wide fallback key). Clients are cached
 * per provider+key so repeated calls from the same bot don't rebuild the
 * LangChain client each time; keying by provider+key (not bot id) means key
 * rotation "just works" — a new key is a cache miss and the old entry ages out.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly clientCache = new Map<string, ProviderClients>();

  private buildClient(provider: AiProvider, apiKey: string): ProviderClients {
    switch (provider) {
      case AiProvider.GEMINI:
        return {
          chatModel: new ChatGoogleGenerativeAI({
            apiKey,
            modelName: 'gemini-2.5-flash',
            temperature: 0.2,
            maxOutputTokens: 1024,
            maxRetries: 0,
          }),
          embeddingsModel: new GoogleGenerativeAIEmbeddings({
            apiKey,
            modelName: 'gemini-embedding-001',
          }),
        };
      case AiProvider.OPENAI:
        return {
          chatModel: new ChatOpenAI({
            apiKey,
            model: 'gpt-4o-mini',
            temperature: 0.2,
            maxTokens: 1024,
            maxRetries: 0,
          }),
          embeddingsModel: new OpenAIEmbeddings({
            apiKey,
            model: 'text-embedding-3-small',
          }),
        };
      case AiProvider.ANTHROPIC:
        return {
          chatModel: new ChatAnthropic({
            apiKey,
            model: 'claude-3-5-haiku-20241022',
            temperature: 0.2,
            maxTokens: 1024,
            maxRetries: 0,
          }),
          // No embeddings API — callers must resolve an embeddings-capable
          // provider/key separately (see BotService.getEmbeddingCredentials).
        };
      case AiProvider.GROQ:
        return {
          chatModel: new ChatGroq({
            apiKey,
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
            maxTokens: 1024,
            maxRetries: 0,
          }),
          // No embeddings API, same as Anthropic.
        };
      case AiProvider.MISTRAL:
        return {
          chatModel: new ChatMistralAI({
            apiKey,
            model: 'mistral-small-latest',
            temperature: 0.2,
            maxTokens: 1024,
            maxRetries: 0,
          }),
          embeddingsModel: new MistralAIEmbeddings({
            apiKey,
            model: 'mistral-embed',
          }),
        };
    }
  }

  private getOrCreateClient(provider: AiProvider, apiKey: string): ProviderClients {
    const cacheKey = `${provider}:${apiKey}`;
    const cached = this.clientCache.get(cacheKey);
    if (cached) return cached;

    const clients = this.buildClient(provider, apiKey);
    if (this.clientCache.size >= MAX_CACHED_CLIENTS) {
      const oldestKey = this.clientCache.keys().next().value;
      if (oldestKey) this.clientCache.delete(oldestKey);
    }
    this.clientCache.set(cacheKey, clients);
    return clients;
  }

  /**
   * Generate an AI response using LangChain and RAG.
   */
  async generateResponse(
    provider: AiProvider,
    apiKey: string,
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
   - Instead, say something nicely like: "I'm sorry, I don't have an answer for that right now. However, you can reach out to us via Phone or WhatsApp at 651-509-8767, or email contact@soloitech.com. You can also schedule a free consultation meeting at https://calendly.com/ajayg-soloitech. Is there anything else I can help you with?"
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
      this.logger.log(`LangChain Invoke [${provider}]: ${messages.length} messages in chain`);

      const { chatModel } = this.getOrCreateClient(provider, apiKey);
      const response = await chatModel.invoke(messages);

      return typeof response.content === 'string'
        ? response.content
        : 'Sorry, I could not process your request.';
    } catch (error) {
      this.logger.error(`LangChain ${provider} error:`, error.message);
      return 'I apologize, but I encountered a temporary issue while processing your request. How else can I assist you?';
    }
  }

  /**
   * Generate an embedding vector using LangChain. `provider` must be
   * embeddings-capable (Gemini/OpenAI/Mistral) — callers resolve this via
   * BotService.getEmbeddingCredentials before calling in.
   */
  async generateEmbedding(provider: AiProvider, apiKey: string, text: string): Promise<number[]> {
    try {
      const { embeddingsModel } = this.getOrCreateClient(provider, apiKey);
      if (!embeddingsModel) {
        throw new Error(`${provider} does not support embeddings`);
      }
      return await embeddingsModel.embedQuery(text);
    } catch (error) {
      this.logger.error(`LangChain ${provider} embedding error:`, error.message);
      return [];
    }
  }
}
