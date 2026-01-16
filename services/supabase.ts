
import { createClient } from '@supabase/supabase-js';
import { LeadRecord } from '../types';

// Connection details for the LabelNest Refinery project
const supabaseUrl = 'https://evugaodpzepyjonlrptn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dWdhb2RwemVweWpvbmxycHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQwMjYsImV4cCI6MjA4MTAyMDAyNn0.n-ipz8mUvOyTfDOMMc5pjSNmNEKmVg2R5OhTsHU_rYI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Stage 4: FINALIZATION
 * Persists normalized refinery output to the institutional vault.
 * Strictly adheres to the infy_export_view contract specified in Architect Mode.
 */
export const saveEnrichedLead = async (lead: LeadRecord) => {
  if (!supabase) return null;

  const e = lead.enriched;
  if (!e) return null;

  const exportRecord = {
    job_id: e.job_id,
    raw_lead_id: lead.id,
    email: e.email,
    first_name: e.first_name,
    last_name: e.last_name,
    firm_name: e.firm_name,
    standard_title: e.standard_title,
    job_level: e.job_level,
    job_role: e.job_role,
    f0: e.f0,
    f1: e.f1,
    f2: e.f2,
    vertical: e.vertical,
    industry: e.industry,
    city: e.city,
    state: e.state,
    zip: e.zip,
    country: e.country,
    region: e.region,
    phone: e.phone,
    linkedin_url: e.linkedin_url,
    revenue: e.revenue,
    intent_score: e.intent_score,
    intent_signal: e.intent_signal,
    is_verified: e.is_verified,
    tenant_id: e.tenant_id,
    project_id: e.project_id,
    resolution_status: e.resolution_status,
    resolution_error: e.resolution_error,
    last_synced_at: e.last_synced_at,
    created_at: e.created_at,
    raw_evidence_json: e.raw_evidence_json
  };

  try {
    // Attempt upsert to the view
    const { data, error } = await supabase
      .from('infy_export_view') 
      .upsert(exportRecord, { onConflict: 'raw_lead_id' });
      
    if (error) {
      console.warn('View upsert failed (expected if view is read-only), falling back to base table:', error.message);
      // Fallback to the underlying enriched leads table if the view isn't updatable
      const { error: fallbackError } = await supabase
        .from('infy_enriched_leads')
        .upsert(exportRecord, { onConflict: 'raw_lead_id' });
        
      if (fallbackError) {
        console.error('Supabase Refinery Sync Failed:', fallbackError.message);
      }
    }
    return data;
  } catch (err) {
    console.error('Refinery Sync Exception:', err);
    return null;
  }
};

export const fetchVaultLeads = async (): Promise<LeadRecord[]> => {
  try {
    // We try to pull from the export view as it is the canonical source
    const { data, error } = await supabase
      .from('infy_export_view')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      // Fallback to the base table if the view query fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('infy_enriched_leads')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (fallbackError) return [];
      return formatSupabaseRows(fallbackData);
    }
    
    return formatSupabaseRows(data);
  } catch (err) {
    return [];
  }
};

/**
 * Maps raw database rows back to the frontend LeadRecord structure.
 */
function formatSupabaseRows(data: any[] | null): LeadRecord[] {
  return (data || []).map(row => ({
    id: row.raw_lead_id,
    batchId: 'VAULT_SYNC',
    input: {
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      firmName: row.firm_name,
      declaredTitle: row.standard_title || '',
      website: row.linkedin_url || ''
    },
    state: 'completed',
    progress: 100,
    last_stage: 'COMPLETED',
    enriched: row as any,
    createdAt: new Date(row.created_at).getTime(),
    completedAt: new Date(row.last_synced_at || row.created_at).getTime()
  }));
}
