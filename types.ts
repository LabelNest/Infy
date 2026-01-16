export type EnrichmentStage = 'QUEUED' | 'PROCESSING_SERP' | 'PROCESSING_AI' | 'COMPLETED' | 'ERROR';
export type EnrichmentState = 'queued' | 'running' | 'completed' | 'error';

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
  website: string | null;
  standard_title: string | null;
  salutation?: string | null;
  job_level: number | null;
  job_level_id?: string | null;
  job_role: string | null;
  function_taxonomy_id?: string | null;
  f0: string | null;
  f1: string | null;
  f2: string | null;
  vertical: string | null;
  industry: string | null;
  industry_id?: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  region: string | null;
  phone: string | null;
  linkedin_url: string | null;
  revenue: string | null;
  intent_score: number;
  intent_signal: "Low" | "Medium" | "High";
  is_verified: boolean;
  tenant_id: string;
  project_id: string;
  resolution_status: string;
  resolution_error: string | null;
  last_synced_at: string;
  created_at: string;
  raw_evidence_json: {
    serp_query: string;
    serp_results: any;
    ai_output: any;
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