import { allow, deny, or, rule, shield } from 'orpc-shield';
import type { Context } from './generated/orpc/routers/helpers/createRouter';

const isAuthenticated = rule<Context>()(({ ctx }) => !!ctx.user);
const isAdmin = rule<Context>()(({ ctx }) => !!ctx.user?.roles && ctx.user.roles.includes('admin'));
const isModerator = rule<Context>()(
  ({ ctx }) => Array.isArray(ctx.user?.roles) && ctx.user.roles.includes('moderator')
);

const isPostOwner = rule<Context>()(({ ctx, input }) => {
  return ctx.user?.id === (input as any)?.authorId;
});

const isUserOwner = rule<Context>()(({ ctx, input }) => {
  return ctx.user?.id === (input as any)?.id;
});

const canDeleteUser = rule<Context>()(({ ctx, input }) => {
  const targetUser = input as any;
  return Boolean(
    ctx.user?.id === targetUser?.id ||
      (ctx.user?.roles?.includes('admin') && !targetUser?.roles?.includes('admin'))
  );
});

export const permissions = shield<Context>(
  {
    user: {
      userFindMany: allow,
      userFindById: allow,
      userCreate: allow,
      userUpdate: isUserOwner,
      userUpdateMany: deny,
      userUpsert: deny,
      userDelete: canDeleteUser,
      userDeleteMany: deny,
      userCount: allow,
      userAggregate: isAdmin,
      userGroupBy: isAdmin,
      userFindFirst: allow,
      userCreateMany: allow,
      userPosts: allow,
    },
    post: {
      postFindMany: allow,
      postFindById: allow,
      postCreate: isAuthenticated,
      postUpdate: isPostOwner,
      postUpdateMany: deny,
      postUpsert: deny,
      postDelete: or(isAdmin, isPostOwner),
      postDeleteMany: isAdmin,
      postCount: allow,
      postAggregate: isAuthenticated,
      postGroupBy: isAuthenticated,
      postFindFirst: allow,
      postCreateMany: isAuthenticated,
    },
  },
  {
    denyErrorCode: 'FORBIDDEN',
    debug: true,
    allowExternalErrors: true,
  }
);

export type Permissions = typeof permissions;
