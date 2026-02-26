import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a property name is passed (e.g., @CurrentUser('id')), return that property
    if (data && user) {
      return user[data];
    }

    // Otherwise return the full user object
    return user;
  },
);
