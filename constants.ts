
export const INFY_JOB_LEVELS = [
  { job_level_id: "L1", job_level: "Top Leadership", title_pattern: "Founder, Owner, CEO, CxO, Board Member, President, Managing Director, Partner" },
  { job_level_id: "L2", job_level: "Senior Leadership", title_pattern: "VP, SVP, Head of Department, MD with function, Lead with team ownership" },
  { job_level_id: "L3", job_level: "Senior Management", title_pattern: "Director, Executive Director, GM, Product Owner, Chief of Staff" },
  { job_level_id: "L4", job_level: "Managers / Specialists", title_pattern: "Manager, Specialist, Architect, Analyst, Engineer, Lead, Consultant" }
];

export const INFY_FUNCTION_TAXONOMY = [
  { function_taxonomy_id: "FT001", job_role: 'Information Technology', f0: 'Information Technology', f1: 'Application Development and Maintenance', f2: 'Development' },
  { function_taxonomy_id: "FT002", job_role: 'Information Technology', f0: 'Information Technology', f1: 'Business Intelligence, Data and Analytics', f2: 'Data Analytics' },
  { function_taxonomy_id: "FT003", job_role: 'Business', f0: 'Energy Transition', f1: 'Carbon Management', f2: 'Sustainability' },
  { function_taxonomy_id: "FT004", job_role: 'Business', f0: 'Marketing', f1: 'Digital Marketing', f2: 'SEO' },
  { function_taxonomy_id: "FT005", job_role: 'Business', f0: 'Finance', f1: 'Financial Planning and Analysis', f2: 'Reporting' },
  { function_taxonomy_id: "FT006", job_role: 'Business', f0: 'Sales', f1: 'Channel Sales', f2: 'Partner Management' },
  { function_taxonomy_id: "FT007", job_role: 'Information Technology', f0: 'Cloud Services', f1: 'Infrastructure', f2: 'DevOps' }
];

export const INFY_INDUSTRIES = [
  { industry_id: "IND001", vertical_code: "CMT", industry_name: "Communication Services" },
  { industry_id: "IND002", vertical_code: "CMT", industry_name: "Hi Tech" },
  { industry_id: "IND003", vertical_code: "CMT", industry_name: "Media and Entertainment" },
  { industry_id: "IND004", vertical_code: "CMT", industry_name: "Semiconductor" },
  { industry_id: "IND005", vertical_code: "COREMFG", industry_name: "Aerospace and Defense" },
  { industry_id: "IND006", vertical_code: "COREMFG", industry_name: "Automotive" },
  { industry_id: "IND007", vertical_code: "COREMFG", industry_name: "Industrial Manufacturing" },
  { industry_id: "IND008", vertical_code: "CRL", industry_name: "Consumer Packaged Goods" },
  { industry_id: "IND009", vertical_code: "CRL", industry_name: "Retail" },
  { industry_id: "IND010", vertical_code: "FS", industry_name: "Financial Services" },
  { industry_id: "IND011", vertical_code: "HCLS", industry_name: "Healthcare" },
  { industry_id: "IND012", vertical_code: "INS", industry_name: "Insurance" },
  { industry_id: "IND013", vertical_code: "SURE", industry_name: "Oil and Gas" },
  { industry_id: "IND014", vertical_code: "SURE", industry_name: "Utilities" }
];

export const REGIONS = ['Americas', 'ANZ', 'APAC', 'Europe', 'MEA'];

// Legacy UI Fallback
export const VERTICAL_INDUSTRY_MAPPING = {
  'CMT': ['Communication Services', 'Hi Tech', 'Media and Entertainment', 'Semiconductor'],
  'COREMFG': ['Aerospace and Defense', 'Automotive', 'Industrial Manufacturing'],
  'CRL': ['Consumer Packaged Goods', 'Retail'],
  'FS': ['Financial Services'],
  'HCLS': ['Healthcare'],
  'INS': ['Insurance'],
  'SURE': ['Oil and Gas', 'Utilities']
};
