/**
 * Freeze API Service
 *
 * Functions for checking freeze status and unfreezing instances.
 */

export interface FreezeStatus {
  frozen: boolean;
  frozenAt?: string;
  warning?: string;
}

export interface UnfreezeResponse {
  success: boolean;
  frozen: boolean;
}

interface ErrorResponse {
  error?: string;
}

/**
 * Get the freeze status of an instance
 */
export async function getFreezeStatus(
  instanceId: string,
): Promise<FreezeStatus> {
  const response = await fetch(`/api/instances/${instanceId}/freeze`);
  if (!response.ok) {
    throw new Error(`Failed to get freeze status: ${String(response.status)}`);
  }
  return response.json() as Promise<FreezeStatus>;
}

/**
 * Unfreeze an instance
 */
export async function unfreezeInstance(
  instanceId: string,
): Promise<UnfreezeResponse> {
  const response = await fetch(`/api/instances/${instanceId}/freeze`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData: ErrorResponse = (await response
      .json()
      .catch(() => ({ error: "Unknown error" }))) as ErrorResponse;
    throw new Error(
      errorData.error ?? `Failed to unfreeze: ${String(response.status)}`,
    );
  }
  return response.json() as Promise<UnfreezeResponse>;
}
