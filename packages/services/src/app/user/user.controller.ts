import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CreateUserModel, CommonResponse, UserLoginModel, UserIdRequestModel, UpdateUserModel, ResetPassowordModel, EmailRequestModel } from '@nihal-ice-factory/shared-models';
import { ExceptionHandler } from 'winston';

export interface ScreenPreferencesModel {
  userId: string;
  preferences: { [key: string]: boolean };
}


@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post('createUser')
  @ApiBody({ type: CreateUserModel })
  async createUser(@Body() reqModel: CreateUserModel): Promise<CommonResponse> {
    try {
      return await this.userService.createUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'User Creation Failed', error);
    }
  }

  @Post('loginUser')
  @ApiBody({ type: UserLoginModel })
  async loginUser(@Body() userLoginDto: UserLoginModel): Promise<CommonResponse> {
    try {
      return await this.userService.loginUser(userLoginDto);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error logging in user', error);
    }
  }

  @Post('getUserById')
  @ApiBody({ type: UserIdRequestModel })
  async getUserById(@Body() reqModel: UserIdRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.getUserById(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error fetching user', error);
    }
  }

  @Post('updateUser')
  @ApiBody({ type: UpdateUserModel })
  async updateUser(@Body('userId') reqModel: UpdateUserModel): Promise<CommonResponse> {
    try {
      return await this.userService.updateUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error updating user', error);
    }
  }

  @Post('deleteUser')
  @ApiBody({ type: UserIdRequestModel })
  async deleteUser(@Body('userId') reqModel: UserIdRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.deleteUser(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error deleting user', error);
    }
  }


  @Post('resetPassword')
  @ApiBody({ type: ResetPassowordModel })
  async resetPassword(@Body() reqModel: ResetPassowordModel): Promise<CommonResponse> {
    try {
      return await this.userService.resetPassword(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error resetting password', error);
    }
  }

  @Post('forgotPassword')
  @ApiBody({ type: EmailRequestModel })
  async forgotPassword(@Body() reqModel: EmailRequestModel): Promise<CommonResponse> {
    try {
      return await this.userService.sendResetPasswordEmail(reqModel);
    } catch (error) {
      return new CommonResponse(false, 1, 'Error sending OTP', error);
    }
  }
}

