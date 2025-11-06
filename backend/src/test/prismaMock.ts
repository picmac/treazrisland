import { vi } from "vitest";

export type MockFn = ReturnType<typeof vi.fn>;

export type PrismaMock = {
  userInvitation: { findUnique: MockFn; update: MockFn; create: MockFn };
  user: { create: MockFn; findFirst: MockFn; findUnique: MockFn; update: MockFn };
  refreshTokenFamily: { create: MockFn; findMany: MockFn; updateMany: MockFn };
  refreshToken: { create: MockFn; findUnique: MockFn; update: MockFn; updateMany: MockFn };
  passwordResetToken: { create: MockFn; updateMany: MockFn; findUnique: MockFn; update: MockFn };
  loginAudit: { create: MockFn };
  mfaSecret: {
    create: MockFn;
    deleteMany: MockFn;
    findFirst: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  $transaction: MockFn;
};

export const createPrismaMock = (): PrismaMock => {
  const prisma = {
    userInvitation: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    user: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshTokenFamily: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    loginAudit: { create: vi.fn() },
    mfaSecret: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (client: PrismaMock) => Promise<unknown>) =>
      callback(prisma as PrismaMock),
    ),
  } satisfies PrismaMock;

  return prisma as PrismaMock;
};
