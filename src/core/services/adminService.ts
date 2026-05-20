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
    },

    /**
     * Fetches resolution time statistics (average and max days) for the last 30 days.
     * Falls back to a client-side computation if the RPC is not available.
     */
    async getResolutionStats(): Promise<{ avgDays: number; maxDays: number }> {
        try {
            const { data, error } = await supabase
                .rpc('get_resolution_time_stats');

            if (!error && data && data.length > 0) {
                return {
                    avgDays: Number(data[0].avg_days || 0),
                    maxDays: Number(data[0].max_days || 0),
                };
            }
        } catch {
            // RPC not available, fall through to client-side fallback
        }

        // Fallback: compute from raw incidents table
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: incidents, error: fallbackError } = await supabase
                .from('incidents')
                .select('created_at, closed_at')
                .eq('status', 'closed')
                .not('closed_at', 'is', null)
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (fallbackError || !incidents || incidents.length === 0) {
                return { avgDays: 0, maxDays: 0 };
            }

            const durations = incidents.map(inc => {
                const created = new Date(inc.created_at).getTime();
                const closed = new Date(inc.closed_at).getTime();
                return (closed - created) / (1000 * 60 * 60 * 24); // days
            });

            const avgDays = durations.reduce((a, b) => a + b, 0) / durations.length;
            const maxDays = Math.max(...durations);

            return { avgDays, maxDays };
        } catch {
            return { avgDays: 0, maxDays: 0 };
        }
    }
};
