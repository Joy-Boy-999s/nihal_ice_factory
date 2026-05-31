import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Must be a class (not interface) so that emitDecoratorMetadata can emit
 * the correct Reflect.metadata("design:paramtypes", [JwtUser]) entry for
 * decorated method parameters.
 */
export class JwtUser {
  userId!: string;
  username!: string;
  role!: string;
}

/** Extracts the validated JWT payload from the request. */
export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
