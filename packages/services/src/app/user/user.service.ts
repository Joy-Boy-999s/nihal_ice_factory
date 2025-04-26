import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import * as CryptoJS from 'crypto-js';
import { CommonResponse, CreateUserModel, EmailRequestModel, ResetPassowordModel, UserIdRequestModel, UserLoginModel, UserRole, UpdateUserModel } from '@nihal-ice-factory/shared-models';
import { UserRepository } from './repository/user.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { GenericTransactionManager } from '../../database/trasanction-manager';

@Injectable()
export class UserService {
  logger: any;
  constructor(
    @InjectRepository(UserRepository)
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly transactionManager: GenericTransactionManager,
  ) { }

  async createUser(reqModel: CreateUserModel): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const passwordRegex = /^(?=(.*[a-z]){2,})(?=(.*[A-Z]){1,})(?=(.*\d){1,})(?=(.*[@$!%*?&#_+\-/]){2,})[A-Za-z\d@$!%*?&#_+\-/]{8,}$/;
      if (!passwordRegex.test(reqModel.password)) {
        throw new Error(
          'Password must be at least 8 characters long, with at least 2 lowercase letters, 1 uppercase letter, 1 number, and 2 special characters (@, $, !, %, *, ?, &, #, _, -, +, /)',
        );
      }

      const userRepo = this.transactionManager.getRepository(this.userRepository);
      const existingUser = await userRepo.findOne({
        where: [{ username: reqModel.username }, { email: reqModel.email }],
      });
      if (existingUser) {
        throw new Error('Username or email already exists');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(reqModel.password, saltRounds);

      const user = userRepo.create({
        username: reqModel.username,
        email: reqModel.email,
        password: hashedPassword,
        role: reqModel.role || UserRole.USER,
      });

      const savedUser = await userRepo.save(user);
      await this.transactionManager.commitTransaction();

      const { password, ...userResponse } = savedUser;
      return new CommonResponse(true, 201, 'User created successfully', userResponse);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new CommonResponse(false, message.includes('required') ? 400 : 500, message, null);
    }
  }

  async loginUser(reqModel: UserLoginModel): Promise<CommonResponse> {
    try {
      const user = await this.userRepository.findOne({ where: { email: reqModel.email } });
      if (!user) {
        return new CommonResponse(false, 401, 'Invalid credentials');
      }

      const secretKey = process.env.ENCRYPTION_KEY;
      if (!secretKey) {
        throw new Error('Missing ENCRYPTION_KEY');
      }

      const decryptedPassword = CryptoJS.AES.decrypt(reqModel.password, secretKey).toString(CryptoJS.enc.Utf8);
      const isPasswordValid = await bcrypt.compare(decryptedPassword, user.password);
      if (!isPasswordValid) {
        return new CommonResponse(false, 401, 'Invalid credentials');
      }

      const payload = { username: user.username, sub: user.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '15d' });

      return new CommonResponse(true, 200, 'User logged in successfully', {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return new CommonResponse(false, 500, errorMessage);
    }
  }

  async getUserById(reqModel: UserIdRequestModel): Promise<CommonResponse> {
    try {
      const user = await this.userRepository.findOne({ where: { id: reqModel.userId } });
      if (!user) {
        return new CommonResponse(false, 404, 'User not found');
      }
      return new CommonResponse(true, 200, 'User fetched successfully', user);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return new CommonResponse(false, 500, errorMessage);
    }
  }

  async updateUser(reqModel: UpdateUserModel): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const userRepo = this.transactionManager.getRepository(this.userRepository);
      const user = await userRepo.findOne({ where: { id: reqModel.userId } });
      if (!user) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'User not found');
      }

      await userRepo.update(reqModel.userId, reqModel);
      const updatedUser = await userRepo.findOne({ where: { id: reqModel.userId } });
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'User updated successfully', updatedUser);
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      return new CommonResponse(false, 500, 'Error updating user');
    }
  }

  async deleteUser(reqModel: UserIdRequestModel): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const userRepo = this.transactionManager.getRepository(this.userRepository);
      const user = await userRepo.findOne({ where: { id: reqModel.userId } });
      if (!user) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'User not found');
      }
      await userRepo.remove(user);
      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'User deleted successfully');
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      return new CommonResponse(false, 500, 'Error deleting user');
    }
  }

  async logoutUser(userId: string): Promise<CommonResponse> {
    try {
      if (!userId) {
        return new CommonResponse(false, 400, 'Invalid user ID');
      }
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return new CommonResponse(false, 404, 'User not found');
      }
      await this.userRepository.save(user);
      return new CommonResponse(true, 200, 'User logged out successfully');
    } catch (error) {
      return new CommonResponse(false, 500, 'Error logging out user');
    }
  }


  async sendResetPasswordEmail(reqModel: EmailRequestModel): Promise<CommonResponse> {
    try {
      if (!reqModel?.email) {
        return new CommonResponse(false, 400, 'Email is required');
      }

      const user = await this.userRepository.findOne({ where: { email: reqModel.email } });
      if (!user) {
        return new CommonResponse(false, 404, 'User not found');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await this.userRepository.update(user.id, {
        resetPasswordOtp:otp,
        resetPasswordExpires,
      });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Password Reset OTP',
        html: `<!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <style>
                        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');

                        body {
                          margin: 0;
                          padding: 0;
                          background-color: #f4f7fb;
                          font-family: 'Poppins', sans-serif;
                        }

                        .container {
                          max-width: 600px;
                          margin: 0 auto;
                          background: linear-gradient(135deg, #ffffff, #f8fafc);
                          border-radius: 20px;
                          overflow: hidden;
                          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                          animation: slideIn 0.8s ease-out;
                        }

                        .header {
                          background: linear-gradient(45deg, #6b48ff, #00ddeb);
                          padding: 40px 20px;
                          text-align: center;
                          position: relative;
                          overflow: hidden;
                        }

                        .header img {
                          width: 120px;
                          animation: pulse 2s infinite;
                        }

                        .header::before {
                          content: '';
                          position: absolute;
                          top: -50%;
                          left: -50%;
                          width: 200%;
                          height: 200%;
                          background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
                          animation: rotate 20s linear infinite;
                        }

                        .content {
                          padding: 40px;
                          text-align: center;
                        }

                        .otp-box {
                          display: inline-block;
                          background: linear-gradient(45deg, #6b48ff, #8a2be2);
                          color: white;
                          padding: 20px 40px;
                          border-radius: 12px;
                          font-size: 28px;
                          font-weight: 600;
                          letter-spacing: 4px;
                          margin: 20px 0;
                          box-shadow: 0 5px 15px rgba(107, 72, 255, 0.3);
                          animation: fadeIn 1s ease-in;
                        }

                        .content p {
                          color: #555;
                          font-size: 16px;
                          line-height: 1.6;
                          margin: 15px 0;
                        }

                        .content p.warning {
                          color: #ff4d4d;
                          font-weight: 600;
                        }

                        .footer {
                          background-color: #2c2c2c;
                          padding: 20px;
                          text-align: center;
                          color: #ffffff;
                          font-size: 14px;
                        }

                        .footer a {
                          color: #00ddeb;
                          text-decoration: none;
                          transition: color 0.3s ease;
                        }

                        .footer a:hover {
                          color: #6b48ff;
                        }

                        @keyframes slideIn {
                          from { transform: translateY(50px); opacity: 0; }
                          to { transform: translateY(0); opacity: 1; }
                        }

                        @keyframes fadeIn {
                          from { opacity: 0; transform: scale(0.8); }
                          to { opacity: 1; transform: scale(1); }
                        }

                        @keyframes pulse {
                          0% { transform: scale(1); }
                          50% { transform: scale(1.1); }
                          100% { transform: scale(1); }
                        }

                        @keyframes rotate {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }

                        @media screen and (max-width: 480px) {
                          .container { margin: 10px; }
                          .content { padding: 20px; }
                          .otp-box { font-size: 24px; padding: 15px 30px; }
                          .header img { width: 100px; }
                        }
                      </style>
                    </head>
                    <body>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 0;">
                        <tr>
                          <td align="center">
                            <div class="container">
                              <!-- Header -->
                              <div class="header">
                                <img src='https://res.cloudinary.com/di8xeijf0/image/upload/v1745410429/WhatsApp_Image_2025-04-16_at_2.11.43_PM_jlgprc.jpg' alt="Kp Ice Factory">
                              </div>
                              <!-- Content -->
                              <div class="content">
                                <h2 style="color: #333; margin: 0 0 20px; font-weight: 600;">Password Reset OTP</h2>
                                <p>Your One-Time Password (OTP) for password reset is:</p>
                                <div class="otp-box">${otp}</div>
                                <p>This code will expire in <strong>15 minutes</strong>.</p>
                                <p class="warning">Please do not share this code with anyone.</p>
                              </div>
                              <!-- Footer -->
                              <div class="footer">
                                <p>If you did not request a password reset, please ignore this message or <a href="#">contact support</a>.</p>
                                <p style="margin-top: 10px;">© 2025 Joy Boy. All rights reserved.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </body>
                  </html>`,
      });

      return new CommonResponse(true, 200, 'OTP sent successfully');
    } catch (error) {
      console.error('Error in sendResetPasswordEmail:', error);
      return new CommonResponse(false, 500, 'Error sending OTP');
    }
  }


  async resetPassword(reqModel: ResetPassowordModel): Promise<CommonResponse> {
    await this.transactionManager.startTransaction();
    try {
      const userRepo = this.transactionManager.getRepository(this.userRepository);
      const user = await userRepo.findOne({ where: { email: reqModel.email } });
      if (!user) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 404, 'User not found');
      }

      if (
        user.resetPasswordOtp?.toString() !== reqModel.otp.toString() ||
        !user.resetPasswordExpires ||
        user.resetPasswordExpires < new Date()
      ) {
        await this.transactionManager.rollbackTransaction();
        return new CommonResponse(false, 401, 'Invalid or expired OTP');
      }

      const hashedPassword = await bcrypt.hash(reqModel.newPassword, 10);
      await userRepo.update(user.id, {
        password: hashedPassword,
      });

      await this.transactionManager.commitTransaction();
      return new CommonResponse(true, 200, 'Password reset successfully');
    } catch (error) {
      await this.transactionManager.rollbackTransaction();
      return new CommonResponse(false, 500, 'Error resetting password');
    }
  }
}
