export type ContentSecurityPolicyOptions = {
  nonce?: string;
  mediaCdn?: string | null;
};

export declare function createContentSecurityPolicy(
  options?: ContentSecurityPolicyOptions
): string;

export declare function buildSecurityHeaders(options?: ContentSecurityPolicyOptions): {
  key: string;
  value: string;
}[];
