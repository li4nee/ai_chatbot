import { IsString, MinLength, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { AiProvider } from '../../ai/ai-provider.enum';

export class CreateBotDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  themeColor?: string;

  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @IsNumber()
  @IsOptional()
  pricePer1kTokens?: number;

  @IsNumber()
  @IsOptional()
  pricePerMessage?: number;
}

export class UpdateBotDto {
  // BYOK credentials — write-only. An empty string clears the stored value,
  // omitting the field entirely leaves it untouched (standard PATCH semantics).
  @IsEnum(AiProvider)
  @IsOptional()
  aiProvider?: AiProvider;

  @IsString()
  @IsOptional()
  aiApiKey?: string;

  @IsEnum(AiProvider)
  @IsOptional()
  embeddingProvider?: AiProvider;

  @IsString()
  @IsOptional()
  embeddingApiKey?: string;

  @IsString()
  @IsOptional()
  hubspotAccessToken?: string;

  @IsString()
  @IsOptional()
  vapiPublicKey?: string;

  @IsString()
  @IsOptional()
  vapiAssistantId?: string;

  @IsString()
  @IsOptional()
  vapiWebhookSecret?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  themeColor?: string;

  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @IsNumber()
  @IsOptional()
  pricePer1kTokens?: number;

  @IsNumber()
  @IsOptional()
  pricePerMessage?: number;
}
