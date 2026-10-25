import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ChatbotIntegrationService } from './chatbot-integration.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import {
  AdminAlertDto,
  CreateOrderDto,
  IssueWatchLinkDto,
  ResolveUserDto,
  SearchTitlesDto,
} from './chatbot-integration.dto';

/**
 * Server-to-server API for the Messenger chatbot. Authenticated with the
 * shared `x-internal-api-key`; kept out of the public Swagger docs.
 */
@ApiExcludeController()
@Controller('internal/chatbot')
@UseGuards(InternalApiKeyGuard)
export class ChatbotIntegrationController {
  constructor(private readonly service: ChatbotIntegrationService) {}

  @Post('users/resolve')
  resolveUser(@Body() dto: ResolveUserDto) {
    return this.service.resolveUser(dto);
  }

  @Get('genres')
  listGenres() {
    return this.service.listGenres();
  }

  @Get('titles/search')
  searchTitles(@Query() dto: SearchTitlesDto) {
    return this.service.searchTitles(dto);
  }

  @Get('plans')
  listPlans() {
    return this.service.listPlans();
  }

  @Get('movies/:id')
  getMovie(@Param('id') id: string) {
    return this.service.getMovie(id);
  }

  @Get('series/:id')
  getSeries(@Param('id') id: string) {
    return this.service.getSeries(id);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.service.createOrder(dto);
  }

  @Get('orders/:paymentId')
  getOrder(
    @Param('paymentId') paymentId: string,
    @Query('userId') userId: string,
    @Query('verify') verify?: string,
  ) {
    return this.service.getOrder(userId, paymentId, verify === 'true');
  }

  @Post('admin-alert')
  adminAlert(@Body() dto: AdminAlertDto) {
    return this.service.adminAlert(dto);
  }

  @Get('users/:userId/support')
  support(@Param('userId') userId: string) {
    return this.service.supportSnapshot(userId);
  }

  @Post('users/:userId/payments/:paymentId/recheck')
  recheck(@Param('userId') userId: string, @Param('paymentId') paymentId: string) {
    return this.service.recheckPayment(userId, paymentId);
  }

  @Get('users/:userId/rentals')
  listRentals(@Param('userId') userId: string) {
    return this.service.listRentals(userId);
  }

  @Post('watch-links')
  issueWatchLink(@Body() dto: IssueWatchLinkDto) {
    return this.service.issueWatchLink(dto);
  }
}
