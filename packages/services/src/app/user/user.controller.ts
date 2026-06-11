import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CommonResponse,
  CreateUserModel,
  EmailRequestModel,
  ResetPassowordModel,
  UpdateUserModel,
  UserIdRequestModel,
  UserLoginModel,
  UserRole,
} from '@nihal-ice-factory/shared-models';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Public endpoints (no auth required) ──────────────────────────────────

  @Post('createUser')
  @ApiBody({ type: CreateUserModel })
  @ApiOperation({ summary: 'Register a new user (public)' })
  async createUser(@Body() reqModel: CreateUserModel): Promise<CommonResponse> {
    try {
      return await this.userService.createUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'User Creation Failed');
    }
  }

  /** Public customer self-registration — role is always forced to CUSTOMER. */
  @Post('registerCustomer')
  @ApiBody({ type: CreateUserModel })
  @ApiOperation({ summary: 'Customer self-registration (role forced to CUSTOMER)' })
  async registerCustomer(@Body() reqModel: CreateUserModel): Promise<CommonResponse> {
    try {
      return await this.userService.createUser({ ...reqModel, role: UserRole.CUSTOMER });
    } catch (error) {
      return new CommonResponse(false, 1, 'Customer registration failed');
    }
  }

  @Post('loginUser')
  @ApiBody({ type: UserLoginModel })
  @ApiOperation({ summary: 'Authenticate and receive a JWT (public)' })
  async loginUser(@Body() userLoginDto: UserLoginModel): Promise<CommonResponse> {
    try {
      return await this.userService.loginUser(userLoginDto);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error logging in user');
    }
  }

  @Post('forgotPassword')
  @ApiBody({ type: EmailRequestModel })
  @ApiOperation({ summary: 'Send a password-reset OTP to the user\'s email (public)' })
  async forgotPassword(@Body() reqModel: EmailRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.sendResetPasswordEmail(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error sending OTP');
    }
  }

  @Post('resetPassword')
  @ApiBody({ type: ResetPassowordModel })
  @ApiOperation({ summary: 'Reset password using a valid OTP (public)' })
  async resetPassword(@Body() reqModel: ResetPassowordModel): Promise<CommonResponse> {
    try {
      return await this.userService.resetPassword(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error resetting password');
    }
  }

  // ── Authenticated user endpoints ──────────────────────────────────────────

  @Post('getUserById')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UserIdRequestModel })
  @ApiOperation({ summary: 'Fetch a user by ID' })
  async getUserById(@Body() reqModel: UserIdRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.getUserById(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching user');
    }
  }

  @Post('updateUser')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpdateUserModel })
  @ApiOperation({ summary: 'Update user profile fields' })
  async updateUser(@Body('userId') reqModel: UpdateUserModel): Promise<CommonResponse> {
    try {
      return await this.userService.updateUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error updating user');
    }
  }

  // ── Admin-only endpoints ──────────────────────────────────────────────────

  @Get('getAll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  async getAllUsers(): Promise<CommonResponse> {
    try {
      return await this.userService.getAllUsers();
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching users');
    }
  }

  @Post('deleteUser')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiBody({ type: UserIdRequestModel })
  @ApiOperation({ summary: 'Delete a user account (admin only)' })
  async deleteUser(@Body() reqModel: UserIdRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.deleteUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error deleting user');
    }
  }

  /**
   * PATCH /users/:userId/role
   * Change a user's role. Admin cannot change their own role.
   */
  @Patch(':userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', description: 'UUID of the user whose role to update' })
  @ApiOperation({ summary: 'Update a user\'s role (admin only)' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: string,
    @GetUser() caller: JwtUser,
  ): Promise<CommonResponse> {
    return this.userService.updateUserRole(userId, role, caller.userId);
  }
}
