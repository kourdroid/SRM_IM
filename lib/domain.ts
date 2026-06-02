/**
 * Domain Layer - Incident Repository Interface
 * 
 * The repository pattern abstracts data access. The domain layer
 * depends on this INTERFACE, not concrete implementations.
 * 
 * "Dependencies point INWARD only." - Clean Architecture
 */

import type { CreateIncidentInput, IncidentFromServer, IncidentStatus } from './schemas';

// ============================================================
// DOMAIN ENTITY (Pure business logic)
// ============================================================

export interface IncidentEntity {
    readonly id: number;
    readonly remoteId: string | null;
    readonly type: 'BT' | 'MT';
    readonly date: Date;
    readonly village: string;
    readonly status: IncidentStatus;
    readonly incidentType: string;
    readonly communeId: string;
    readonly equipmentUsed: string;
    readonly description: string | null;
    readonly reclamation: boolean;
    readonly reclamationName: string | null;
    readonly reclamationBy: string | null;
    readonly createdBy: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly synced: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

// ============================================================
// REPOSITORY INTERFACE (Port)
// ============================================================

export interface IIncidentRepository {
    /**
     * Get all incidents, ordered by creation date (newest first)
     */
    findAll(): Promise<IncidentEntity[]>;

    /**
     * Get incidents by status
     */
    findByStatus(status: IncidentStatus): Promise<IncidentEntity[]>;

    /**
     * Get unsynced incidents (for push to server)
     */
    findUnsynced(): Promise<IncidentEntity[]>;

    /**
     * Create a new incident
     * @returns The ID of the created incident
     */
    create(input: CreateIncidentInput, createdBy: string): Promise<number>;

    /**
     * Update incident status
     */
    updateStatus(id: number, status: IncidentStatus): Promise<void>;

    /**
     * Mark incidents as synced after successful push
     */
    markSynced(ids: number[]): Promise<void>;

    /**
     * Upsert incidents from server (for pull sync)
     */
    upsertFromServer(incidents: IncidentFromServer[]): Promise<void>;

    /**
     * Delete incidents with invalid commune_id
     * @returns Count of deleted incidents
     */
    deleteInvalid(): Promise<number>;
}

// ============================================================
// COMMUNE REPOSITORY INTERFACE
// ============================================================

export interface CommuneEntity {
    readonly id: number;
    readonly remoteId: string;
    readonly name: string;
    readonly region: string | null;
}

export interface ICommuneRepository {
    /**
     * Get all communes
     */
    findAll(): Promise<CommuneEntity[]>;

    /**
     * Find commune by remote ID
     */
    findByRemoteId(remoteId: string): Promise<CommuneEntity | null>;

    /**
     * Upsert communes from server
     */
    upsertFromServer(communes: { id: string; name: string }[]): Promise<void>;
}

// ============================================================
// DOMAIN ERRORS
// ============================================================

export class DomainError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'DomainError';
    }
}

export class InvalidCommuneError extends DomainError {
    constructor(communeId: string) {
        super(
            'INVALID_COMMUNE',
            `Invalid commune ID: ${communeId}`,
            { communeId }
        );
    }
}

export class IncidentNotFoundError extends DomainError {
    constructor(incidentId: number) {
        super(
            'INCIDENT_NOT_FOUND',
            `Incident with ID ${incidentId} was not found`,
            { incidentId }
        );
    }
}
