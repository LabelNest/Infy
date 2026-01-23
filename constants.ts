export const INFY_JOB_LEVELS = [
  { job_level_id: "L1-FOUNDER", job_level_numeric: 1, label: "Founder / Board / C-Level" },
  { job_level_id: "L2-PRESIDENT", job_level_numeric: 2, label: "President / EVP / SVP" },
  { job_level_id: "L3-VP", job_level_numeric: 3, label: "Vice President / Director" },
  { job_level_id: "L4-MANAGER", job_level_numeric: 4, label: "Manager / Head" }
];

export const INFY_FUNCTION_TAXONOMY = [
  { function_taxonomy_id: "FT-IT-DEV-001", job_role: 'Information Technology', job_role_id: "JR-IT", f0: 'Information Technology', f1: 'Application Development', f2: 'Development' },
  { function_taxonomy_id: "FT-IT-DATA-002", job_role: 'Information Technology', job_role_id: "JR-IT", f0: 'Information Technology', f1: 'Business Intelligence', f2: 'Data Analytics' },
  { function_taxonomy_id: "FT-IT-INFRA-003", job_role: 'Information Technology', job_role_id: "JR-IT", f0: 'Information Technology', f1: 'Cloud Infrastructure', f2: 'Operations' },
  { function_taxonomy_id: "FT-BIZ-SUS-004", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Energy Transition', f1: 'Carbon Management', f2: null },
  { function_taxonomy_id: "FT-BIZ-MKT-005", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Marketing', f1: 'Digital Marketing', f2: 'SEO' },
  { function_taxonomy_id: "FT-BIZ-FIN-006", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Finance', f1: 'Financial Planning', f2: null },
  { function_taxonomy_id: "FT-BIZ-SAL-007", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Sales', f1: 'Channel Sales', f2: null },
  { function_taxonomy_id: "FT-BIZ-HR-008", job_role: 'Business', job_role_id: "JR-BIZ", f0: 'Human Resources', f1: 'Talent Acquisition', f2: null },
  { function_taxonomy_id: "FT-OPS-DEL-009", job_role: 'Operations', job_role_id: "JR-OPS", f0: 'Operations', f1: 'Service Delivery', f2: null }
];

export const INFY_INDUSTRIES = [
  { industry_id: "IND-CMT-001", vertical_id: "V-CMT", vertical_code: "CMT", industry_name: "Communication Services" },
  { industry_id: "IND-CMT-002", vertical_id: "V-CMT", vertical_code: "CMT", industry_name: "Hi Tech" },
  { industry_id: "IND-CMT-003", vertical_id: "V-CMT", vertical_code: "CMT", industry_name: "Media and Entertainment" },
  { industry_id: "IND-FS-010", vertical_id: "V-FS", vertical_code: "FS", industry_name: "Financial Services" },
  { industry_id: "IND-CRL-009", vertical_id: "V-CRL", vertical_code: "CRL", industry_name: "Retail" },
  { industry_id: "IND-MFG-011", vertical_id: "V-MFG", vertical_code: "MFG", industry_name: "Manufacturing" }
];

export const COUNTRY_REGION_MAPPING: Record<string, string> = {
  "United States": "Americas",
  "Canada": "Americas",
  "United Kingdom": "Europe",
  "Germany": "Europe",
  "France": "Europe",
  "India": "APAC",
  "Australia": "ANZ",
  "Singapore": "APAC",
  "Japan": "APAC",
  "United Arab Emirates": "MEA",
  "Saudi Arabia": "MEA",
  "Brazil": "Americas",
  "Mexico": "Americas"
};