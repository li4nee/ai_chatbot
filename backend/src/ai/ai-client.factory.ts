import { Injectable } from '@nestjs/common';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { ChatMistralAI, MistralAIEmbeddings } from '@langchain/mistralai';
import { AiProvider } from './ai-provider.enum';

export type ChatModel = ChatGoogleGenerativeAI | ChatOpenAI | ChatAnthropic | ChatGroq | ChatMistralAI;
export type EmbeddingsModel = GoogleGenerativeAIEmbeddings | OpenAIEmbeddings | MistralAIEmbeddings;

export interface ProviderClients {
  chatModel: ChatModel;
  embeddingsModel?: EmbeddingsModel;
}

/**
 * Builds LangChain clients per provider — the only part of the AI layer that
 * actually touches a third-party SDK. Kept as its own injectable so tests can
 * override this one provider with a fake and unit-test AiService's caching,
 * prompt-building, and error-handling logic without constructing a real LLM
 * client or making a network call.
 */
@Injectable()
export class AiClientFactory {
  build(provider: AiProvider, apiKey: string): ProviderClients {
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
}
