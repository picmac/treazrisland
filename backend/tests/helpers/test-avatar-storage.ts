import {
  type AvatarStorage,
  type AvatarUploadGrant,
  type AvatarUploadInput,
} from '../../src/modules/users/avatar.storage';

export class TestAvatarStorage implements AvatarStorage {
  public grants: AvatarUploadGrant[] = [];
  public requests: AvatarUploadInput[] = [];

  async createUploadGrant(input: AvatarUploadInput): Promise<AvatarUploadGrant> {
    this.requests.push(input);
    const objectKey = `avatars/${input.userId}/${input.filename}`;
    const grant: AvatarUploadGrant = {
      objectKey,
      uploadUrl: `https://avatar-upload/${objectKey}`,
      headers: { 'Content-Type': input.contentType },
    };
    this.grants.push(grant);
    return grant;
  }

  async getSignedAvatarUrl(objectKey: string): Promise<string> {
    return `https://avatar-url/${objectKey}`;
  }
}
