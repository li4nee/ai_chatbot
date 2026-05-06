import { IsString, MinLength } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @MinLength(1)
  content: string;
}

export class UpdateKnowledgeDto {
  @IsString()
  @MinLength(1)
  content: string;
}
