import { createClient } from '@supabase/supabase-js';
import { LeadRecord, InfyEnrichedData } from '../types';

// Connection details for the LabelNest Refinery project
const supabaseUrl = 'https://evugaodpzepyjonlrptn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dWdhb2RwemVweWpvbmxycHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQwMjYsImV4cCI6MjA4MTAyMDAyNn0.n-ipz8mUvOyTfDOMMc5pjSNmNEKmVg2R5OhTsHU_rYI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Diagnostic: Checks if the Infy tables are reachable.
 */
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('infy_enriched_leads').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase Infy Connectivity Issue:', error.message);
      return false;
    }
    console.log('Supabase: Infy Connection Verified.');
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Stage 4: FINALIZATION
 * Persists data strictly using "infy_" prefixed base tables.
 */
export const saveEnrichedLead = async (lead: LeadRecord) => {
  if (!supabase || !lead.enriched) return null;

  const e = lead.enriched as InfyEnrichedData;

  try {
    // 1. CREATE PARENT (infy_raw_leads)
    const parentRecord = {
      id: lead.id,
      email: lead.input.email,
      first_name: lead.input.firstName,
      last_name: lead.input.lastName,
      firm_name: lead.input.firmName,
      declared_title: lead.input.declaredTitle,
      website: lead.input.website || null,
      job_id: e.job_id,
      tenant_id: e.tenant_id || "INSTITUTIONAL-DEFAULT",
      project_id: e.project_id || "REFINERY-MAIN",
      enrichment_status: 'completed',
      created_at: new Date(lead.createdAt).toISOString()
    };

    const { error: pError } = await supabase
      .from('infy_raw_leads')
      .upsert(parentRecord, { onConflict: 'id' });

    if (pError) {
      console.error('infy_raw_leads Sync Failed:', pError.message);
      return null; 
    }

    // 2. CREATE CHILD (infy_enriched_leads)
    const enrichedRecord = {
      raw_lead_id: lead.id,
      job_id: e.job_id,
      email: e.email,
      first_name: e.first_name,
      last_name: e.last_name,
      firm_name: e.firm_name,
      website: e.website || lead.input.website || null,
      standard_title: e.standard_title,
      job_level_id: e.job_level_id || (e.job_level ? `L${e.job_level}` : null),
      function_taxonomy_id: e.function_taxonomy_id,
      industry_id: e.industry_id,
      salutation: e.salutation || null,
      linkedin_url: e.linkedin_url,
      intent_signal: e.intent_signal || 'Low',
      intent_score: e.intent_score || 0,
      tenant_id: e.tenant_id,
      project_id: e.project_id,
      resolution_status: 'classified',
      last_synced_at: new Date().toISOString(),
      created_at: e.created_at || new Date().toISOString(),
      raw_evidence_json: e.raw_evidence_json
    };

    const { error: eError } = await supabase
      .from('infy_enriched_leads')
      .upsert(enrichedRecord, { onConflict: 'raw_lead_id' });
        
    if (eError) {
      console.error('infy_enriched_leads Sync Failed:', eError.message);
    } else {
      console.log(`Infy Vault Sync Success for ${lead.id}`);
    }
  } catch (err) {
    console.error('Infy Vault Sync Critical Error:', err);
  }
};

/**
 * FETCHING LOGIC
 * Pulls data exclusively from 'infy_export_view'.
 */
export const fetchVaultLeads = async (): Promise<LeadRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('infy_export_view')
      .select('*')
      .order('created_at', { ascending: false });
        
    if (error) {
      console.error('infy_export_view Fetch Failed:', error.message);
      return [];
    }
    return formatSupabaseRows(data);
  } catch (err) {
    return [];
  }
};

/**
 * Formats flat infy_export_view rows into LeadRecord objects.
 */
function formatSupabaseRows(data: any[] | null): LeadRecord[] {
  return (data || []).map(row => {
    const leadId = row.raw_lead_id || row.id;
    return {
      id: leadId,
      batchId: 'VAULT_SYNC',
      input: {
        email: row.email || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        firmName: row.firm_name || '',
        declaredTitle: row.declared_title || row.standard_title || '',
        website: row.website || ''
      },
      state: 'completed',
      progress: 100,
      last_stage: 'COMPLETED',
      enriched: {
        ...row,
        raw_lead_id: leadId,
        job_level: row.job_level_id 
          ? (typeof row.job_level_id === 'string' ? parseInt(row.job_level_id.replace('L', '')) : row.job_level_id)
          : null
      } as InfyEnrichedData,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      completedAt: new Date(row.last_synced_at || row.created_at || Date.now()).getTime()
    };
  });
}