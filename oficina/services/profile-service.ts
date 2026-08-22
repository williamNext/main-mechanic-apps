import { UpdateProfileInput, User } from '@main-mechanic/types';
import { request } from '@main-mechanic/wire-client';

export async function updateMyProfile(data: UpdateProfileInput): Promise<User> {
  return request<User>('/profiles/me', {
    method: 'PATCH',
    body: data,
  });
}
