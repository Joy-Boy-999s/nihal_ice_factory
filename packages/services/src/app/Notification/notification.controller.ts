import {
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Latest notifications for the current user' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async list(
    @GetUser() user: JwtUser,
    @Query('limit') limit?: string,
  ): Promise<CommonResponse> {
    return this.notificationService.list(user.userId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the current user' })
  async unreadCount(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.notificationService.unreadCount(user.userId);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.notificationService.markAllRead(user.userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', type: Number })
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.notificationService.markRead(user.userId, id);
  }

  /** SSE: pushes the user's new notifications in real time (+ heartbeat). */
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream of new notifications for the current user' })
  stream(@GetUser() user: JwtUser): Observable<MessageEvent> {
    const notifications$ = this.notificationService.streamFor(user.userId).pipe(
      map((n): MessageEvent => ({ type: 'notification', retry: 3000, data: n })),
    );

    const heartbeat$ = interval(15_000).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { ts: new Date().toISOString() } })),
    );

    return merge(notifications$, heartbeat$);
  }
}
