import { IsString, MinLength, IsOptional } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @MinLength(1)
  message: string;

  /** Unique session identifier from the widget to maintain conversation continuity */
  @IsString()
  @IsOptional()
  sessionId?: string;
}
