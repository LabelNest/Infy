
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from "@google/genai"

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { raw_lead_id } = req.body
  if (!raw_lead_id) return res.status(400).json({ error: 'Missing raw_lead_id' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { data: lead } = await supabase.from('infy_raw_leads').select('*').eq('id', raw_lead_id).single()
    if (!lead) throw new Error('Lead not found')

    const aiSearch = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Find the LinkedIn URL and bio for ${lead.first_name} ${lead.last_name} at ${lead.firm_name}.`,
      config: { 
        tools: [{ googleSearch: {} }],
        systemInstruction: "Locate professional profile data. Prioritize LinkedIn."
      }
    });

    const snippets = aiSearch.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Strict Hierarchical Mapping
    const mappingRules = `
    MASTER ID RULES:
    1. VP, SVP, EVP, President MUST MAP TO ID: "8c7d6e5a-4b3c-2d1a-9e8f-7g6h5i4j3k2l" (Level 2).
    2. Executive Director, Director MUST MAP TO ID: "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6" (Level 3).
    3. Founder, Owner, Board MUST MAP TO ID: "78207f2a-89b4-4b52-9599-236c5354924a" (Level 1).
    4. Marketing must NOT be Sales.
    `;

    const resolution = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze identity for ${lead.first_name} ${lead.last_name}. Mapping Instructions: ${mappingRules}. Evidence: ${JSON.stringify(snippets)}.`,
      config: {
        systemInstruction: `Return JSON only.
- VP MUST BE L2.
- Executive Director MUST BE L3.
- DO NOT map Marketing to Sales.
- ZIP rules: No 00000. Fallback to HQ ZIP.`,
        responseMimeType: "application/json"
      }
    });

    const intel = JSON.parse(resolution.text || '{}');
    const linkedinUrl = intel.linkedin_url || snippets.find(s => s.web?.uri?.includes("linkedin.com"))?.web?.uri || "";

    // Map numeric level based on the selected ID for database consistency
    let numericLevel = 4;
    if (intel.job_level_id === "78207f2a-89b4-4b52-9599-236c5354924a") numericLevel = 1;
    else if (intel.job_level_id === "8c7d6e5a-4b3c-2d1a-9e8f-7g6h5i4j3k2l") numericLevel = 2;
    else if (intel.job_level_id === "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6") numericLevel = 3;

    const enrichedRecord = {
      raw_lead_id: lead.id,
      job_id: lead.job_id,
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      firm_name: lead.firm_name,
      standard_title: intel.standard_title || lead.declared_title || "",
      job_level: String(numericLevel),
      job_level_id: intel.job_level_id || "550e8400-e29b-41d4-a716-446655440000",
      job_role: intel.job_role || "",
      f0: intel.f0 || "",
      f1: intel.f1 || "",
      f2: intel.f2 || "",
      city: intel.location?.city || "Unknown",
      state: intel.location?.state || "Unknown",
      zip: intel.location?.zip || "",
      country: intel.location?.country || "United States",
      linkedin_url: linkedinUrl,
      intent_score: intel.confidence || 0,
      resolution_status: 'classified',
      function_taxonomy_id: intel.function_taxonomy_id || "",
      raw_evidence_json: { serp: snippets, ai: intel }
    };

    await supabase.from('infy_enriched_leads').upsert(enrichedRecord, { onConflict: 'raw_lead_id' });
    await supabase.from('infy_raw_leads').update({ enrichment_status: 'completed' }).eq('id', lead.id);

    return res.json({ status: 'ok' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
