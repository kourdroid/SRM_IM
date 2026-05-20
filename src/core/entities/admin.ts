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

export const UserRoleUpdateSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['field', 'admin'])
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type MonthlyChartPoint = z.infer<typeof MonthlyChartPointSchema>;
export type AdminIncidentUpdate = z.infer<typeof AdminIncidentUpdateSchema>;
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>;
