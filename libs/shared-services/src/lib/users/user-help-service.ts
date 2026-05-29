import { AxiosRequestConfig } from 'axios';
import { CommonAxiosService } from '../common-axios-service';
import { CreateUserModel, UpdateUserModel, UserLoginModel, CommonResponse, UserIdRequestModel, EmailRequestModel, ResetPassowordModel} from '@nihal-ice-factory/shared-models';


export class UserHelpService extends CommonAxiosService {
  private getURLwithMainEndPoint(childUrl: string): string {
    return `/users/${childUrl}`;
  }

  async createUser(reqModel: CreateUserModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('createUser'), reqModel, config);
  }

  async loginUser(reqModel: UserLoginModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('loginUser'), reqModel, config);
  }

  async verifyEmail(token: string, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('verifyEmail'), { token }, config);
  }

  async getUserById(reqModel: UserIdRequestModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('getUserById'), reqModel, config);
  }

  async updateUser(reqModel: UpdateUserModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('updateUser'), reqModel, config);
  }

  async deleteUser(reqModel: UserIdRequestModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('deleteUser'), reqModel, config);
  }

  async forgotPassword(reqModel: EmailRequestModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('forgotPassword'), reqModel, config);
  }

  async resetPassword(reqModel: ResetPassowordModel, config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosPostCall(this.getURLwithMainEndPoint('resetPassword'), reqModel, config);
  }

  async getAllUsers(config?: AxiosRequestConfig): Promise<CommonResponse> {
    return await this.axiosGetCall(this.getURLwithMainEndPoint('getAll'), config);
  }
}