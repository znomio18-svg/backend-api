import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ResolveUserDto {
  /** messenger = Messenger PSID, web = anonymous website chat visitor */
  @IsIn(['messenger', 'web'])
  provider!: 'messenger' | 'web';

  @IsString()
  @MaxLength(200)
  externalId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsUrl({ protocols: ['https'] })
  @IsOptional()
  @MaxLength(2000)
  avatar?: string;
}

export class SearchTitlesDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  query?: string;

  /** The chatbot also sends other platforms' categories (COMEDY…); those match nothing here */
  @IsString()
  @IsOptional()
  @MaxLength(40)
  category?: string;

  /** Genre slug or (part of) its name */
  @IsString()
  @IsOptional()
  @MaxLength(60)
  genre?: string;

  @IsIn(['latest', 'popular', 'rating', 'price_asc', 'price_desc'])
  @IsOptional()
  sort?: 'latest' | 'popular' | 'rating' | 'price_asc' | 'price_desc';

  @IsIn(['movie', 'series', 'all'])
  @IsOptional()
  type?: 'movie' | 'series' | 'all';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  rentableOnly?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number;
}

export class CreateOrderDto {
  @IsString()
  userId!: string;

  @IsString()
  @IsOptional()
  movieId?: string;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @IsString()
  @IsOptional()
  subscriptionPlanId?: string;

  /** BANK_TRANSFER: a transfer an admin has seen on the bank account and confirms next */
  @IsIn(['QPAY', 'BANK_TRANSFER'])
  @IsOptional()
  paymentMethod?: 'QPAY' | 'BANK_TRANSFER';
}

export class AdminAlertDto {
  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MaxLength(20000)
  text!: string;

  /** Recipients; falls back to the admin "notification_email" setting */
  @IsString({ each: true })
  @IsOptional()
  to?: string[];
}

export class IssueWatchLinkDto {
  @IsString()
  userId!: string;

  @IsString()
  @IsOptional()
  rentalId?: string;

  @IsString()
  @IsOptional()
  purchaseId?: string;

  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsString()
  @IsOptional()
  movieId?: string;
}
