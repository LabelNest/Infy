import { createClient } from '@supabase/supabase-js';
import { LeadRecord, InfyEnrichedData } from '../types';

// Connection details for the LabelNest Refinery project
const supabaseUrl = 'https://evugaodpzepyjonlrptn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dWdhb2RwemVweWpvbmxycHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQwMjYsImV4cCI6MjA4MTAyMDAyNn0.n-ipz8mUvOyTfDOMMc5pjSNmNEKmVg2R5OhTsHU_rYI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('infy_enriched_leads').select('count', { count: 'exact', head: true });
    if (error) return false;
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Stage 4: FINALIZATION (Sync to Supabase)
 * This logic strictly follows your infy_enriched_leads column definitions.
 */
export const saveEnrichedLead = async (lead: LeadRecord) => {
  if (!supabase || !lead.enriched) return null;

  const e = lead.enriched as InfyEnrichedData;

  try {
    // 1. CREATE PARENT (infy_raw_leads)
    const parentRecord = {
      id: lead.id, // Must be a UUID string
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
      console.error('Sync Aborted: infy_raw_leads Error:', pError.message);
      return null; 
    }

    // 2. CREATE CHILD (infy_enriched_leads)
    // We map the internal object to your EXACT table columns.
    const enrichedRecord = {
      raw_lead_id: lead.id, // UUID
      job_id: e.job_id,
      email: e.email,
      first_name: e.first_name,
      last_name: e.last_name,
      firm_name: e.firm_name,
      standard_title: e.standard_title,
      job_level: String(e.job_level), // Your table says 'text' for job_level
      job_role: e.job_role,
      f0: e.f0,
      f1: e.f1,
      f2: e.f2,
      city: e.city,
      state: e.state,
      zip: e.zip,
      country: e.country,
      region: e.region,
      vertical: e.vertical,
      industry: e.industry,
      intent_score: e.intent_score, // double precision
      intent_signal: e.intent_signal,
      linkedin_url: e.linkedin_url,
      is_verified: e.is_verified, // boolean
      raw_evidence_json: e.raw_evidence_json, // jsonb
      last_synced_at: new Date().toISOString(),
      tenant_id: e.tenant_id,
      project_id: e.project_id,
      resolution_status: 'classified',
      function_taxonomy_id: e.function_taxonomy_id, // MUST be valid UUID
      job_level_id: e.job_level_id, // MUST be valid UUID
      industry_id: e.industry_id, // MUST be valid UUID
      salutation: e.salutation,
      phone: e.phone,
      created_at: e.created_at || new Date().toISOString(),
      // Adding confidence metrics from schema
      standard_title_confidence: e.intent_score, 
      function_confidence: e.intent_score
    };

    const { error: eError } = await supabase
      .from('infy_enriched_leads')
      .upsert(enrichedRecord, { onConflict: 'raw_lead_id' });
        
    if (eError) {
      console.error('Critical Sync Error (infy_enriched_leads):', eError.message);
      console.error('Payload Check:', {
        function_taxonomy_id: e.function_taxonomy_id,
        raw_lead_id: lead.id
      });
    } else {
      console.log(`Vault Sync Successful for Lead ID: ${lead.id}`);
    }
  } catch (err) {
    console.error('Vault Sync Exception:', err);
  }
};

export const fetchVaultLeads = async (): Promise<LeadRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('infy_export_view')
      .select('*')
      .order('created_at', { ascending: false });
        
    if (error) return [];
    return formatSupabaseRows(data);
  } catch (err) {
    return [];
  }
};

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
        declaredTitle: row.standard_title || '',
        website: row.website || ''
      },
      state: 'completed',
      progress: 100,
      last_stage: 'COMPLETED',
      enriched: {
        ...row,
        raw_lead_id: leadId,
        job_level: row.job_level ? parseInt(String(row.job_level).replace(/\D/g, '')) : null
      } as InfyEnrichedData,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      completedAt: new Date(row.last_synced_at || row.created_at || Date.now()).getTime()
    };
  });
}