
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

export interface EnrichedData {
  job_id: string;                // Human-readable ID
  raw_lead_id: string;           // UUID
  email: string;
  first_name: string;
  last_name: string;
  firm_name: string;
  standard_title: string | null;
  job_level: number | null;      // INTEGER
  job_role: string | null;
  f0: string | null;
  f1: string | null;
  f2: string | null;
  vertical: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  region: string | null;
  phone: string | null;
  linkedin_url: string | null;
  revenue: string | null;        // Excluded from completeness score
  intent_score: number;          // DOUBLE
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
  enriched: EnrichedData | null;
  error?: string;
  createdAt: number;
  completedAt?: number;
}
