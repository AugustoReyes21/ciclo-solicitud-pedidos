import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from './domain.error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Ocurrió un error inesperado';
    let details: unknown;

    if (exception instanceof DomainError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 400 ? 'VALIDATION_ERROR' : 'HTTP_ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if (body && typeof body === 'object' && 'message' in body) {
        message = (body as { message: string | string[] }).message;
      }
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
