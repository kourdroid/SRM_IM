import { z } from 'zod';

export const DashboardStatsSchema = z.object({
    total: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
    reclamations: z.number().int().nonnegative(),
});

export const MonthlyChartPointSchema = z.object({
    label: z.string(),
    value: z.number().int().nonnegative(),
});

export const AdminIncidentUpdateSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['open', 'closed']),
});

export const AdminIncidentClosureSchema = z.object({
    id: z.string().uuid(),
    materials: z.array(z.object({
        client_material_id: z.string().trim().min(1),
        material_name: z.string().trim().min(1).max(160),
        quantity: z.number().positive(),
    })).min(1),
});

export const UserRoleUpdateSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['field', 'admin', 'director'])
});

export const UserApprovalStatusUpdateSchema = z.object({
    id: z.string().uuid(),
    approval_status: z.enum(['pending', 'approved', 'rejected'])
});

export const CommuneMutationSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
});

export const IncidentTypeOptionMutationSchema = z.object({
    id: z.string().uuid().optional(),
    network_type: z.enum(['BT', 'MT']),
    name: z.string().trim().min(2).max(160),
    active: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(100000).optional(),
});

export const DepartHtaOptionMutationSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160),
    active: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(100000).optional(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type MonthlyChartPoint = z.infer<typeof MonthlyChartPointSchema>;
export type ChartDataPoint = MonthlyChartPoint;
export type AdminIncidentUpdate = z.infer<typeof AdminIncidentUpdateSchema>;
export type AdminIncidentClosure = z.infer<typeof AdminIncidentClosureSchema>;
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>;
export type UserApprovalStatusUpdate = z.infer<typeof UserApprovalStatusUpdateSchema>;
export type CommuneMutation = z.infer<typeof CommuneMutationSchema>;
export type IncidentTypeOptionMutation = z.infer<typeof IncidentTypeOptionMutationSchema>;
export type DepartHtaOptionMutation = z.infer<typeof DepartHtaOptionMutationSchema>;
