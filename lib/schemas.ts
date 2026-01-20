/**
 * SRM Domain Schemas
 * Zod validation at API boundaries following Backend Mastery principles.
 * 
 * "Validate at the edge. Never trust the client." - The Silicon Sovereign
 */

import { z } from 'zod';

// ============================================================
// COMMUNE SCHEMAS
// ============================================================

export const CommuneSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(100),
});

export type Commune = z.infer<typeof CommuneSchema>;

export const CommuneArraySchema = z.array(CommuneSchema);

// ============================================================
// INCIDENT SCHEMAS
// ============================================================

export const VoltageTypeSchema = z.enum(['BT', 'MT']);
export type VoltageType = z.infer<typeof VoltageTypeSchema>;

export const IncidentStatusSchema = z.enum(['open', 'closed']);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

/**
 * Schema for incident data coming FROM Supabase
 */
export const IncidentFromServerSchema = z.object({
    id: z.string().uuid(),
    type: VoltageTypeSchema,
    date: z.string().datetime({ offset: true }).or(z.string()),
    village: z.string().min(1),
    status: IncidentStatusSchema,
    incident_type: z.string().nullable().default('General'),
    commune_id: z.string().uuid().nullable(), // Can be null from server
    equipment_used: z.string().nullable().default(''),
    description: z.string().nullable().optional(),
    reclamation: z.boolean(),
    reclamation_name: z.string().nullable().optional(),
    reclamation_by: z.string().nullable().optional(),
    created_by: z.string().uuid(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string().nullable().optional(),
});

export type IncidentFromServer = z.infer<typeof IncidentFromServerSchema>;

export const IncidentFromServerArraySchema = z.array(IncidentFromServerSchema);

/**
 * Schema for creating a new incident (form validation)
 */
export const CreateIncidentSchema = z.object({
    type: VoltageTypeSchema,
    date: z.string().min(1, 'Date is required'),
    village: z.string().min(2, 'Village name must be at least 2 characters'),
    incident_type: z.string().default('General'),
    commune_id: z.string().uuid('Please select a valid commune'),
    equipment_used: z.string().min(1, 'Equipment is required'),
    description: z.string().optional(),
    reclamation: z.boolean().default(false),
    reclamation_name: z.string().optional(),
    reclamation_by: z.enum(['Administration', 'Client']).optional(),
});

export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;

/**
 * Schema for updating incident status
 */
export const UpdateIncidentStatusSchema = z.object({
    incident_id: z.number().int().positive(),
    status: IncidentStatusSchema,
});

export type UpdateIncidentStatusInput = z.infer<typeof UpdateIncidentStatusSchema>;

// ============================================================
// VOICE WEBHOOK SCHEMAS
// ============================================================

/**
 * Schema for voice AI webhook response
 */
export const VoiceAIResponseSchema = z.object({
    type: VoltageTypeSchema.optional(),
    village: z.string().optional(),
    commune_id: z.string().nullable().optional(),
    incident_type: z.string().optional(),
    equipment_used: z.string().optional(),
    description: z.string().optional(),
    title: z.string().optional(),
    date: z.string().optional(),
    reclamation: z.boolean().optional(),
    is_reclamation: z.boolean().optional(),
    reclamation_name: z.string().nullable().optional(),
    reclamation_by: z.string().nullable().optional(),
    status: IncidentStatusSchema.optional(),
    media_urls: z.array(z.string()).optional(),
});

export type VoiceAIResponse = z.infer<typeof VoiceAIResponseSchema>;

/**
 * Helper to safely parse voice AI response with fallback
 */
export function parseVoiceAIResponse(data: unknown): VoiceAIResponse | null {
    const result = VoiceAIResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    console.warn('Voice AI response validation failed:', result.error.flatten());
    return null;
}

// ============================================================
// USER SCHEMAS
// ============================================================

export const UserRoleSchema = z.enum(['admin', 'field']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserProfileSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(100),
    role: UserRoleSchema,
    created_at: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
