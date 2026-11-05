import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const NotificationSchema = z.object({
  id: z.uuid(), recipient_id: z.uuid(), incident_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  acknowledged_at: z.iso.datetime({ offset: true }).nullable(),
  incidents: z.object({
    type: z.enum(['BT', 'MT']), incident_type: z.string(), village: z.string(),
    date: z.string(), depart_hta: z.string().nullable(), status: z.string(),
    communes: z.object({ name: z.string() }).nullable(),
  }).nullable(),
});

export type AdminNotification = z.infer<typeof NotificationSchema>;
export const NOTIFICATION_PAGE_SIZE = 30;

export async function listAdminNotifications(cursor?: Pick<AdminNotification, 'created_at' | 'id'>) {
  let query = supabase.from('admin_notifications')
    .select('id,recipient_id,incident_id,created_at,acknowledged_at,incidents!inner(type,incident_type,village,date,depart_hta,status,communes(name))')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE);
  if (cursor) {
    z.uuid().parse(cursor.id);
    z.iso.datetime({ offset: true }).parse(cursor.created_at);
    query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error('Impossible de charger les notifications. Vérifiez votre connexion.');
  return NotificationSchema.array().parse(data ?? []);
}

export async function acknowledgeAdminNotification(id: string) {
  const { error } = await supabase.rpc('acknowledge_admin_notification', { p_notification_id: z.uuid().parse(id) });
  if (error) throw new Error('La prise en compte a échoué. Vérifiez votre connexion et réessayez.');
}

export async function countUnreadAdminNotifications() {
  const { count, error } = await supabase.from('admin_notifications')
    .select('id,incidents!inner(id)', { count: 'exact', head: true }).is('acknowledged_at', null);
  if (error) throw error;
  return count ?? 0;
}
