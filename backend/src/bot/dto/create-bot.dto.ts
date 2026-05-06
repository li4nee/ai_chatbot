import { IsString, MinLength, IsOptional } from 'class-validator';

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
}
