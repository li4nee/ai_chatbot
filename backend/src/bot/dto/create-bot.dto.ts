import { IsString, MinLength, IsOptional, IsNumber } from 'class-validator';

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
