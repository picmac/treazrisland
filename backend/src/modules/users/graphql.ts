import { graphql, buildSchema } from 'graphql';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { AuthUser } from '../auth/types';
import {
  isProfileComplete,
  serializeUserProfile,
  updateUserProfile,
  userProfileSelect,
} from './profile';
import { avatarUploadSchema, profilePatchSchema } from './validators';

type GraphqlRequestBody = {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};

const schema = buildSchema(`
  type AvatarHeader {
    key: String!
    value: String!
  }

  type AvatarUploadGrant {
    objectKey: String!
    uploadUrl: String!
    headers: [AvatarHeader!]!
  }

  type UserProfile {
    id: ID!
    email: String!
    displayName: String
    avatarObjectKey: String
    avatarContentType: String
    avatarSize: Int
    avatarUploadedAt: String
    avatarUrl: String
    createdAt: String!
    updatedAt: String!
    profileUpdatedAt: String
    profileCompletedAt: String
  }

  type ProfilePayload {
    user: UserProfile!
    isProfileComplete: Boolean!
  }

  input ProfileInput {
    displayName: String
    avatarObjectKey: String
    avatarContentType: String
    avatarSize: Int
  }

  input AvatarUploadInput {
    filename: String!
    contentType: String!
    size: Int!
  }

  type Query {
    meProfile: ProfilePayload!
  }

  type Mutation {
    updateProfile(input: ProfileInput!): ProfilePayload!
    createAvatarUploadGrant(input: AvatarUploadInput!): AvatarUploadGrant!
  }
`);

const getAuthUser = (request: FastifyRequest): AuthUser | null => {
  const user = request.user as Partial<AuthUser> | undefined;

  if (user && typeof user.id === 'string' && typeof user.email === 'string') {
    return { id: user.id, email: user.email, isAdmin: Boolean(user.isAdmin) };
  }

  return null;
};

export const userGraphqlRoutes: FastifyPluginAsync = async (fastify) => {
  const resolvers = {
    meProfile: async (_: unknown, _args: unknown, request: FastifyRequest) => {
      const authUser = getAuthUser(request);

      if (!authUser) {
        throw new Error('Unauthorized');
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: authUser.id },
        select: userProfileSelect,
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        user: await serializeUserProfile(user, fastify.avatarStorage),
        isProfileComplete: isProfileComplete(user),
      };
    },
    updateProfile: async (_source: unknown, args: { input: unknown }, request: FastifyRequest) => {
      const authUser = getAuthUser(request);

      if (!authUser) {
        throw new Error('Unauthorized');
      }

      const parsed = profilePatchSchema.safeParse(args.input);

      if (!parsed.success) {
        throw new Error('Invalid profile payload');
      }

      const result = await updateUserProfile(
        fastify.prisma,
        fastify.avatarStorage,
        authUser.id,
        parsed.data,
      );

      if (!result) {
        throw new Error('User not found');
      }

      return result;
    },
    createAvatarUploadGrant: async (
      _source: unknown,
      args: { input: unknown },
      request: FastifyRequest,
    ) => {
      const authUser = getAuthUser(request);

      if (!authUser) {
        throw new Error('Unauthorized');
      }

      const parsed = avatarUploadSchema.safeParse(args.input);

      if (!parsed.success) {
        throw new Error('Invalid upload payload');
      }

      const grant = await fastify.avatarStorage.createUploadGrant({
        ...parsed.data,
        userId: authUser.id,
      });

      return {
        objectKey: grant.objectKey,
        uploadUrl: grant.uploadUrl,
        headers: Object.entries(grant.headers ?? {}).map(([key, value]) => ({ key, value })),
      };
    },
  } as const;

  fastify.post('/users/graphql', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as GraphqlRequestBody;

    if (!body?.query) {
      return reply.status(400).send({ errors: [{ message: 'Missing query' }] });
    }

    const response = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
      rootValue: resolvers,
      contextValue: request,
    });

    return reply.send(response);
  });
};
