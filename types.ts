
export type EnrichmentStage = 'QUEUED' | 'PROCESSING_SERP' | 'PROCESSING_AI' | 'COMPLETED' | 'ERROR';
export type EnrichmentState = 'queued' | 'running' | 'completed' | 'error';
export type AccessStatus = 'pending' | 'approved' | 'denied';

export interface LeadInput {
  email: string;
  firstName: string;
  lastName: string;
  firmName: string;
  declaredTitle: string;
  website?: string;
}

export interface InfyEnrichedData {
  job_id: string;
  raw_lead_id: string;
  email: string;
  first_name: string;
  last_name: string;
  firm_name: string;
  website: string;
  standard_title: string;
  job_level: number;
  job_level_id: string;
  job_role: string;
  job_role_id: string;
  function_taxonomy_id: string;
  f0: string;
  f1: string;
  f2: string;
  vertical: string;
  vertical_id: string;
  industry: string;
  industry_id: string;
  salutation: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  region: string;
  phone: string;
  linkedin_url: string;
  bio_snippet: string;
  job_description: string;
  alternate_profile_url?: string;
  intent_score: number;
  intent_signal: "Low" | "Medium" | "High";
  is_verified: boolean;
  tenant_id: string;
  project_id: string;
  resolution_status: string;
  last_synced_at: string;
  created_at: string;
  processed_by?: string;
  raw_evidence_json: {
    serp_query: string;
    serp_results: any;
    ai_output: any;
    discovery_logic?: string;
  };
}

export interface LeadRecord {
  id: string;
  batchId: string;
  input: LeadInput;
  state: EnrichmentState;
  progress: number;
  last_stage: EnrichmentStage;
  enriched: InfyEnrichedData | null;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AppAccessRequest {
  id: string;
  email: string;
  full_name?: string;
  status: AccessStatus;
  created_at: string;
}

export interface UserUsageLog {
  id: string;
  email: string;
  firm_name: string;
  standard_title: string;
  created_at: string;
}
