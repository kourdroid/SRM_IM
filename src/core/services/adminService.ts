import { supabase } from '@/lib/supabase';
import {
    DashboardStatsSchema,
    MonthlyChartPointSchema,
    type DashboardStats,
    type MonthlyChartPoint
} from '../entities/admin';

export const AdminService = {
    /**
     * Fetches the aggregated dashboard stats from the PostgreSQL view.
     * This is highly efficient and guarantees O(1) network payload.
     */
    async getDashboardStats(): Promise<DashboardStats> {
        const { data, error } = await supabase
            .from('dashboard_stats_view')
            .select('*')
            .single();

        if (error) throw new Error(`Dashboard stats fetch failed: ${error.message}`);

        // Zod boundary validation (Structural Integrity)
        return DashboardStatsSchema.parse({
            total: Number(data.total || 0),
            open: Number(data.open || 0),
            closed: Number(data.closed || 0),
            reclamations: Number(data.reclamations || 0)
        });
    },

    /**
     * Fetches the monthly incident aggregation natively executed via RPC on Postgres.
     * Prevents client-side V8 Engine CPU hog.
     */
    async getMonthlyIncidents(year: number): Promise<MonthlyChartPoint[]> {
        const { data, error } = await supabase
            .rpc('get_monthly_incidents', { target_year: year });

        if (error) throw new Error(`Monthly chart fetch failed: ${error.message}`);

        // Zod boundary validation
        return data.map((point: any) => MonthlyChartPointSchema.parse({
            label: point.label,
            value: Number(point.value || 0)
        }));
    }
};
