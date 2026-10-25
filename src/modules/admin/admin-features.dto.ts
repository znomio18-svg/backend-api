import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BankReconcilePreviewDto {
  @ApiProperty({ example: 'statement.xlsx' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ description: 'File content, base64 (≤ 10MB decoded)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15_000_000)
  contentBase64: string;
}

export class BankReconcileConfirmDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  paymentIds: string[];
}

export class SendToUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  movieId?: string;
}

export class GrantSubscriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ required: false, description: 'Defaults to plan.durationDays' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

export class GrantMovieDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  movieId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
