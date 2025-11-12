export type AuthUser = {
  id: string;
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
};

export type MagicLinkSession = {
  user: AuthUser;
};
