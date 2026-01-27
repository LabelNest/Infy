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

    // Unified Evidence Discovery
    const aiSearch = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Find professional details for ${lead.first_name} ${lead.last_name} at ${lead.firm_name} and the corporate HQ address.`,
      config: { tools: [{ googleSearch: {} }] }
    });

    const snippets = aiSearch.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const linkedinUrl = snippets.find(s => s.web?.uri?.includes("linkedin.com"))?.web?.uri || "";

    // Fetch Taxonomy for AI context
    const [jobLevels, functions] = await Promise.all([
      supabase.from('infy_job_levels').select('*'),
      supabase.from('infy_function_taxonomy').select('*')
    ]);

    const resolution = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Resolve Identity for ${lead.first_name} ${lead.last_name}. Evidence: ${JSON.stringify(snippets)}`,
      config: {
        systemInstruction: `Output JSON. Map to these functions: ${JSON.stringify(functions.data)}. 
        CRITICAL ZIP RULES: 
        1. ZIP codes like '00000' or '99999' are strictly forbidden. 
        2. ZIP MUST match the City, State, and Country. 
        3. Use Company HQ for location if individual office is missing. 
        4. If no real ZIP can be found via search or HQ fallback, return an empty string for ZIP.`,
        responseMimeType: "application/json"
      }
    });

    const intel = JSON.parse(resolution.text || '{}');
    const funcMatch = functions.data.find(f => f.id === intel.function_taxonomy_id);
    
    // Clean ZIP: Placeholder becomes empty string, never null
    const rawZip = intel.location?.zip;
    const sanitizedZip = (rawZip === "00000" || rawZip === "99999" || !rawZip) 
      ? "" 
      : String(rawZip).trim();

    const enrichedRecord = {
      raw_lead_id: lead.id,
      job_id: lead.job_id,
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      firm_name: lead.firm_name,
      standard_title: intel.standard_title || lead.declared_title || "",
      job_level: String(intel.job_level_numeric || 4),
      job_role: funcMatch?.job_role || "",
      f0: funcMatch?.f0 || "",
      f1: funcMatch?.f1 || "",
      f2: funcMatch?.f2 || "",
      city: intel.location?.city || "Unknown",
      state: intel.location?.state || "Unknown",
      zip: sanitizedZip,
      country: intel.location?.country || "United States",
      linkedin_url: linkedinUrl,
      intent_signal: (intel.confidence || 0) > 70 ? 'High' : 'Medium',
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