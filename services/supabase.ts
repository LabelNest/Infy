
import { createClient } from '@supabase/supabase-js';
import { LeadRecord, InfyEnrichedData, AppAccessRequest, AccessStatus, UserUsageLog } from '../types';

const supabaseUrl = 'https://evugaodpzepyjonlrptn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dWdhb2RwemVweWpvbmxycHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQwMjYsImV4cCI6MjA4MTAyMDAyNn0.n-ipz8mUvOyTfDOMMc5pjSNmNEKmVg2R5OhTsHU_rYI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CreditRequest {
  id: string;
  user_email: string;
  requested_amount: number;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('infy_enriched_leads').select('count', { count: 'exact', head: true });
    if (error) return false;
    return true;
  } catch (err) {
    return false;
  }
};

// --- ACCESS GOVERNANCE LOGIC ---

export const getAccessStatus = async (email: string): Promise<AccessStatus | 'none'> => {
  const normalized = email.toLowerCase().trim();
  if (normalized === 'ankit@labelnest.in') return 'approved';
  
  const { data, error } = await supabase
    .from('infy_app_access')
    .select('status')
    .ilike('email', normalized)
    .single();
    
  if (error || !data) return 'none';
  return data.status;
};

export const requestAccess = async (email: string, fullName?: string) => {
  return await supabase.from('infy_app_access').upsert({
    email: email.toLowerCase().trim(),
    full_name: fullName,
    status: 'pending'
  }, { onConflict: 'email' });
};

export const createManualUser = async (email: string, fullName: string, initialCredits: number = 100) => {
  const normalized = email.toLowerCase().trim();
  // 1. Authorize identity
  await supabase.from('infy_app_access').upsert({
    email: normalized,
    full_name: fullName,
    status: 'approved'
  }, { onConflict: 'email' });

  // 2. Set initial credits
  await supabase.from('infy_user_credits').upsert({
    user_email: normalized,
    balance: initialCredits
  }, { onConflict: 'user_email' });
};

export const getAllAccessRequests = async (): Promise<AppAccessRequest[]> => {
  const { data } = await supabase
    .from('infy_app_access')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
};

export const resolveAccessRequest = async (email: string, status: AccessStatus) => {
  return await supabase
    .from('infy_app_access')
    .update({ status })
    .ilike('email', email.toLowerCase().trim());
};

// --- CREDIT SYSTEM LOGIC ---

export const getUserBalance = async (email: string): Promise<number> => {
  const normalized = email.toLowerCase().trim();
  try {
    const { data, error } = await supabase
      .from('infy_user_credits')
      .select('balance')
      .ilike('user_email', normalized)
      .single();
    
    if (error || !data) {
      // Initialize credits if user doesn't exist
      await supabase.from('infy_user_credits').insert({ user_email: normalized, balance: 10 });
      return 10;
    }
    return data.balance;
  } catch {
    return 0;
  }
};

export const deductCredit = async (email: string): Promise<boolean> => {
  const normalized = email.toLowerCase().trim();
  const current = await getUserBalance(normalized);
  if (current <= 0) return false;

  const { error } = await supabase
    .from('infy_user_credits')
    .update({ balance: current - 1 })
    .ilike('user_email', normalized);

  return !error;
};

export const requestCredits = async (email: string, amount: number) => {
  return await supabase.from('infy_credit_requests').insert({
    user_email: email.toLowerCase().trim(),
    requested_amount: amount,
    status: 'pending'
  });
};

export const getPendingRequests = async (): Promise<CreditRequest[]> => {
  const { data, error } = await supabase
    .from('infy_credit_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return data || [];
};

export const resolveCreditRequest = async (requestId: string, userEmail: string, amount: number, approved: boolean) => {
  const status = approved ? 'approved' : 'denied';
  const normalized = userEmail.toLowerCase().trim();
  
  // 1. Update the request status
  await supabase.from('infy_credit_requests').update({ status }).eq('id', requestId);

  if (approved) {
    // 2. Add credits to user's balance
    const current = await getUserBalance(normalized);
    await supabase.from('infy_user_credits').update({ balance: current + amount }).ilike('user_email', normalized);
  }
};

export const fetchUsageHistory = async (email: string): Promise<UserUsageLog[]> => {
  const { data } = await supabase
    .from('infy_enriched_leads')
    .select('raw_lead_id, email, firm_name, standard_title, created_at')
    .ilike('processed_by', email.toLowerCase().trim())
    .order('created_at', { ascending: false });
  
  return (data || []).map(d => ({
    id: d.raw_lead_id,
    email: d.email,
    firm_name: d.firm_name,
    standard_title: d.standard_title,
    created_at: d.created_at
  }));
};

// --- DATA PERSISTENCE ---

export const saveEnrichedLead = async (lead: LeadRecord, userEmail: string) => {
  if (!supabase || !lead.enriched) return null;

  const e = lead.enriched as InfyEnrichedData;
  const normalizedUser = userEmail.toLowerCase().trim();

  try {
    // Deduct credit before final save
    const creditDeducted = await deductCredit(normalizedUser);
    if (!creditDeducted) {
      throw new Error("Insufficient intelligence credits");
    }

    const parentRecord = {
      id: lead.id,
      email: lead.input.email,
      first_name: lead.input.firstName,
      last_name: lead.input.lastName,
      firm_name: lead.input.firmName,
      declared_title: lead.input.declaredTitle,
      website: lead.input.website || "",
      job_id: e.job_id,
      tenant_id: e.tenant_id || "INSTITUTIONAL-DEFAULT",
      project_id: e.project_id || "REFINERY-MAIN",
      enrichment_status: 'completed',
      created_at: new Date(lead.createdAt).toISOString()
    };

    await supabase.from('infy_raw_leads').upsert(parentRecord, { onConflict: 'id' });

    const enrichedRecord = {
      raw_lead_id: lead.id,
      job_id: e.job_id,
      email: e.email,
      first_name: e.first_name,
      last_name: e.last_name,
      firm_name: e.firm_name,
      standard_title: e.standard_title,
      job_level: String(e.job_level),
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
      intent_score: e.intent_score,
      intent_signal: e.intent_signal,
      linkedin_url: e.linkedin_url,
      is_verified: e.is_verified,
      raw_evidence_json: e.raw_evidence_json,
      last_synced_at: new Date().toISOString(),
      tenant_id: e.tenant_id,
      project_id: e.project_id,
      resolution_status: 'classified',
      function_taxonomy_id: e.function_taxonomy_id,
      job_level_id: e.job_level_id,
      industry_id: e.industry_id,
      salutation: e.salutation,
      phone: e.phone,
      created_at: e.created_at || new Date().toISOString(),
      processed_by: normalizedUser, // Track who processed this lead
      standard_title_confidence: e.intent_score, 
      function_confidence: e.intent_score
    };

    await supabase.from('infy_enriched_leads').upsert(enrichedRecord, { onConflict: 'raw_lead_id' });
  } catch (err) {
    console.error('Vault Sync Exception:', err);
    throw err;
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
        firm_name: row.firm_name || '',
        declared_title: row.standard_title || '',
        website: row.website || ''
      } as any,
      state: 'completed',
      progress: 100,
      last_stage: 'COMPLETED',
      enriched: {
        ...row,
        raw_lead_id: leadId,
        job_level: row.job_level ? parseInt(String(row.job_level).replace(/\D/g, '')) : 0
      } as InfyEnrichedData,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      completedAt: new Date(row.last_synced_at || row.created_at || Date.now()).getTime()
    };
  });
}
