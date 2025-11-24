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

type GraphqlContext = {
  request: FastifyRequest;
  authUser: AuthUser;
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

export const userGraphqlRoutes: FastifyPluginAsync = async (fastify) => {
  const resolvers = {
    meProfile: async (_args: unknown, context: GraphqlContext) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: context.authUser.id },
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
    updateProfile: async (args: { input: unknown }, context: GraphqlContext) => {
      const parsed = profilePatchSchema.safeParse(args.input);

      if (!parsed.success) {
        throw new Error('Invalid profile payload');
      }

      const result = await updateUserProfile(
        fastify.prisma,
        fastify.avatarStorage,
        context.authUser.id,
        parsed.data,
      );

      if (!result) {
        throw new Error('User not found');
      }

      return result;
    },
    createAvatarUploadGrant: async (args: { input: unknown }, context: GraphqlContext) => {
      const parsed = avatarUploadSchema.safeParse(args.input);

      if (!parsed.success) {
        throw new Error('Invalid upload payload');
      }

      const grant = await fastify.avatarStorage.createUploadGrant({
        ...parsed.data,
        userId: context.authUser.id,
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

    const authUser = request.user as AuthUser | undefined;

    if (!authUser) {
      return reply.status(401).send({ errors: [{ message: 'Unauthorized' }] });
    }

    if (!body?.query) {
      return reply.status(400).send({ errors: [{ message: 'Missing query' }] });
    }

    const response = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
      rootValue: resolvers,
      contextValue: { request, authUser },
    });

    return reply.send(response);
  });
};
