import { cookies, headers } from 'next/headers';

import { ACCESS_TOKEN_KEY } from '@/constants/auth';

export function createServerRequestInit(): RequestInit | undefined {
  const headerList = headers();
  const cookieStore = cookies();
  const forwardedHeaders = new Headers();
  let hasForwardedHeaders = false;

  const cookieHeader = cookieStore.toString();
  if (cookieHeader.length > 0) {
    forwardedHeaders.set('cookie', cookieHeader);
    hasForwardedHeaders = true;
  }

  const requestAuthorization = headerList.get('authorization');
  const cookieAccessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;

  if (requestAuthorization) {
    forwardedHeaders.set('authorization', requestAuthorization);
    hasForwardedHeaders = true;
  } else if (cookieAccessToken) {
    forwardedHeaders.set('authorization', `Bearer ${cookieAccessToken}`);
    hasForwardedHeaders = true;
  }

  const forwardedHost = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (forwardedHost) {
    forwardedHeaders.set('x-forwarded-host', forwardedHost);
    hasForwardedHeaders = true;
  }

  const forwardedProto = headerList.get('x-forwarded-proto');
  if (forwardedProto) {
    forwardedHeaders.set('x-forwarded-proto', forwardedProto);
    hasForwardedHeaders = true;
  }

  return hasForwardedHeaders ? { headers: forwardedHeaders } : undefined;
}
