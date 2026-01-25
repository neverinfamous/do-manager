import type { Instance } from "./index";

/**
 * API response for instances list
 */
export interface InstancesResponse {
  instances: Instance[];
  total: number;
}

/**
 * API response for single instance
 */
export interface InstanceResponse {
  instance: Instance;
  created?: boolean;
}

/**
 * Request body for creating an instance
 */
export interface CreateInstanceRequest {
  name?: string;
  object_id: string;
}

/**
 * API response for cloning an instance
 */
export interface CloneInstanceResponse {
  instance: Instance;
  clonedFrom: string;
}
