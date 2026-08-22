import { isApiError, request } from '@main-mechanic/wire-client';
import { PublicMechanic } from '@main-mechanic/types';

export async function getAllMechanics(): Promise<PublicMechanic[]> {
  return request<PublicMechanic[]>('/mechanics');
}

export async function getMechanicById(id: string): Promise<PublicMechanic | null> {
  try {
    return await request<PublicMechanic>(`/mechanics/${encodeURIComponent(id)}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}
