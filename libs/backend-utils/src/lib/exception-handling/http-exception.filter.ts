import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();
        const logger = new Logger();
        const { body } = request;
        const loggingObject = {
            requestData: body,
            responseData: {}
        };

        let statusCode: number = null;
        let errorType: string;
        let statusInfo: any;
        let internalMessage: string;

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            // 4XX series
            if (status >= 400 && status < 500) {
                statusCode = status;
                errorType = 'Client Side Errors';
                internalMessage = exception.message['error'];
                if (status === HttpStatus.BAD_REQUEST) {
                    if (Array.isArray(exception['response'].message)) {
                        const errorMessage = exception['response'].message[0];
                        statusInfo = errorMessage;
                    } else {
                        console.log(exception)
                        statusInfo = 'Server cannot or will not process the request due to client error(Request Payload)';
                    }
                } else if (status === HttpStatus.UNAUTHORIZED) {
                    //401
                    statusCode = status;
                    errorType = 'Unauthorized';
                    statusInfo = 'Lack of valid authentication credentials';
                } else if (status === HttpStatus.FORBIDDEN) {
                    //403
                    statusCode = status;
                    errorType = 'Forbidden';
                    statusInfo = 'You are Forbidden to do this action';
                } else if (status === HttpStatus.NOT_FOUND) {
                    //404
                    statusCode = status;
                    errorType = 'Not Found';
                    statusInfo = 'Server can\'t find the requested resource';
                } else if (status === HttpStatus.NOT_ACCEPTABLE) {
                    //406
                    statusCode = status;
                    errorType = 'Not Acceptable';
                    statusInfo = 'Response headers not matching with Request headers';
                } else if (status === HttpStatus.EXPECTATION_FAILED) {
                    //417
                    statusCode = status;
                    errorType = 'Expectation Failed';
                    statusInfo = 'Request Header could not fulfilled';
                } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
                    //429
                    statusCode = status;
                    errorType = 'Too Many Requests';
                    statusInfo = 'Too many requests in limited time';
                }
            } else {
                statusCode = 500;
                errorType = 'Internal Server Error';
            }

            const responseObject = {
                status: false,
                statusCode: statusCode,
                errorType: errorType,
                internalMessage: statusInfo,
                statusInfo: internalMessage
            }
            loggingObject.responseData = responseObject;
            logger.error(loggingObject);
            response.status(statusCode).json(responseObject);
        }
    }

    getChildMessage = (messages: any) => {
        if (messages.children) {
            if (messages.children.length == 0) {
                return Object.values(messages.constraints)[0];
            } else {
                return this.getChildMessage(messages.children[0]);
            }
        }
    }
}
