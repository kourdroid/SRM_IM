/**
 * Shared type definitions for the SRM application.
 * Centralized types eliminate duplication and ensure consistency.
 */

// ============================================================
// USER & AUTH TYPES
// ============================================================

export type UserRole = 'admin' | 'field';

export type UserProfile = {
    id: string;
    name: string;
    role: UserRole;
    created_at: string;
};

// ============================================================
// INCIDENT TYPES
// ============================================================

export type VoltageType = 'BT' | 'MT';

export type IncidentStatus = 'open' | 'closed';

export type Incident = {
    id: string;
    title?: string;
    type: VoltageType;
    date: string;
    village: string;
    status: IncidentStatus;
    incident_type: string;
    commune_id: string;
    equipment_used: string;
    description?: string;
    reclamation: boolean;
    reclamation_name?: string;
    created_by: string;
    created_at: string;
};

/** Type for creating a new incident (excludes auto-generated fields) */
export type CreateIncidentPayload = Omit<Incident, 'id' | 'created_at'>;

/** Type for updating an incident */
export type UpdateIncidentPayload = Partial<Omit<Incident, 'id' | 'created_at' | 'created_by'>>;

// ============================================================
// COMMUNE TYPES
// ============================================================

export type Commune = {
    id: string;
    name: string;
};

// ============================================================
// DASHBOARD STATS
// ============================================================

export type DashboardStats = {
    total: number;
    open: number;
    closed: number;
    reclamations: number;
};

export type ChartDataPoint = {
    value: number;
    label: string;
    frontColor?: string;
};
