import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabase = config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

export async function getDelayHistory(route: string, transportType: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('delay_history')
        .select('*')
        .eq('route', route)
        .eq('transport_type', transportType)
        .order('recorded_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Supabase query error:', error);
        return [];
    }
    return data || [];
}

export async function getCancellationHistory(route: string, transportType: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('cancellation_history')
        .select('*')
        .eq('route', route)
        .eq('transport_type', transportType)
        .order('recorded_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Supabase query error:', error);
        return [];
    }
    return data || [];
}
