export enum AiProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GROQ = 'GROQ',
  MISTRAL = 'MISTRAL',
}

/** Anthropic and Groq are chat-only in LangChain's JS SDKs — no embeddings API. */
export const EMBEDDING_CAPABLE_PROVIDERS = [AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.MISTRAL] as const;

export function supportsEmbeddings(provider: AiProvider): boolean {
  return (EMBEDDING_CAPABLE_PROVIDERS as readonly AiProvider[]).includes(provider);
}
