
export interface InfyJobLevelConstant {
  job_level_id: string;
  job_level_numeric: number;
  label: string;
  slug: string;
}

export const INFY_JOB_LEVELS: InfyJobLevelConstant[] = [
  { job_level_id: "78207f2a-89b4-4b52-9599-236c5354924a", job_level_numeric: 1, label: "Founder / Board / C-Level", slug: "L1-FOUNDER" },
  { job_level_id: "8c7d6e5a-4b3c-2d1a-9e8f-7g6h5i4j3k2l", job_level_numeric: 2, label: "President / EVP / SVP / VP", slug: "L2-EXECUTIVE" },
  { job_level_id: "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6", job_level_numeric: 3, label: "Executive Director / Director", slug: "L3-DIRECTOR" },
  { job_level_id: "550e8400-e29b-41d4-a716-446655440000", job_level_numeric: 4, label: "Manager / Head / Lead", slug: "L4-MANAGER" }
];

export const INFY_FUNCTION_TAXONOMY = [
  // Sales
  { function_taxonomy_id: "b96fa70d-f013-451b-a79f-49161ed67726", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Sales', f1: 'Account Management', f2: null },
  { function_taxonomy_id: "14eca656-403e-43d8-9391-6b97f126e3c3", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Sales', f1: 'Business Development', f2: null },
  { function_taxonomy_id: "d4cb1ea4-9832-4dfb-9753-c9157a009a5e", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Sales', f1: 'Lead Generation', f2: null },
  
  // Marketing (Mandatory fix for misclassification)
  { function_taxonomy_id: "mkt-auth-001", job_role: 'Marketing', job_role_id: "JR-MKT", f0: 'Marketing', f1: 'Brand & Communication', f2: null },
  { function_taxonomy_id: "mkt-auth-002", job_role: 'Marketing', job_role_id: "JR-MKT", f0: 'Marketing', f1: 'Digital Marketing', f2: 'Growth' },
  { function_taxonomy_id: "mkt-auth-003", job_role: 'Marketing', job_role_id: "JR-MKT", f0: 'Marketing', f1: 'Product Marketing', f2: null },
  
  // Information Technology
  { function_taxonomy_id: "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d", job_role: 'Information Technology', job_role_id: "JR-IT", f0: 'Information Technology', f1: 'Application Development', f2: 'Development' },
  { function_taxonomy_id: "f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f", job_role: 'Information Technology', job_role_id: "JR-IT", f0: 'Information Technology', f1: 'Business Intelligence', f2: 'Data Analytics' }
];

export const INFY_INDUSTRIES = [
  { industry_id: "9c8d7e6f-5a4b-3c2d-1e0f-a1b2c3d4e5f6", vertical_id: "V-CMT", vertical_code: "CMT", industry_name: "Communication Services" },
  { industry_id: "8e9f0a1b-2c3d-4e5f-6g7h-8i9j0k1l2m3n", vertical_id: "V-MFG", vertical_code: "MFG", industry_name: "Manufacturing" },
  { industry_id: "ind-fin-001", vertical_id: "V-FS", vertical_code: "FS", industry_name: "Financial Services" },
  { industry_id: "ind-tech-001", vertical_id: "V-TECH", vertical_code: "TECH", industry_name: "Technology" }
];

export const COUNTRY_REGION_MAPPING: Record<string, string> = {
  "United States": "Americas",
  "Canada": "Americas",
  "United Kingdom": "Europe",
  "India": "APAC",
  "Australia": "ANZ"
};
