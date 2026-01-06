/**
 * Migration API Service
 * 
 * Frontend API functions for migrating instances between namespaces.
 */

import { apiFetch } from '../lib/apiFetch'
import type { Instance } from '../types'

/**
 * Cutover mode for migration
 */
export type CutoverMode = 'copy' | 'copy_freeze' | 'copy_delete'

/**
 * Migration request options
 */
export interface MigrateInstanceRequest {
    /** Target namespace ID */
    targetNamespaceId: string
    /** Custom name for the new instance (defaults to source instance name) */
    targetInstanceName?: string
    /** Cutover mode: copy, copy_freeze, or copy_delete */
    cutoverMode: CutoverMode
    /** Whether to migrate alarms from source instance */
    migrateAlarms?: boolean
    /** Whether to run verification after migration */
    runVerification?: boolean
}

/**
 * Verification result from migration
 */
export interface VerificationResult {
    passed: boolean
    sourceKeyCount: number
    targetKeyCount: number
}

/**
 * Migration response from API
 */
export interface MigrateInstanceResponse {
    success: boolean
    newInstance: Instance
    sourceFrozen: boolean
    sourceDeleted: boolean
    verification?: VerificationResult
    warnings?: string[]
}

/**
 * Migration API functions
 */
export const migrateApi = {
    /**
     * Migrate an instance to another namespace
     * 
     * @param instanceId - Source instance ID
     * @param options - Migration options
     * @returns Migration result with new instance details
     */
    async migrateInstance(
        instanceId: string,
        options: MigrateInstanceRequest
    ): Promise<MigrateInstanceResponse> {
        const data = await apiFetch<MigrateInstanceResponse>(
            `/instances/${instanceId}/migrate`,
            {
                method: 'POST',
                body: JSON.stringify(options),
            }
        )
        return data
    },
}
