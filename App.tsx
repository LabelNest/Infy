import React, { useState, useEffect, useRef } from 'react';
import { LeadForm } from './components/LeadForm';
import { LeadCard } from './components/LeadCard';
import { BulkEngine } from './components/BulkEngine';
import { StateMappingTool } from './components/StateMappingTool';
import { LeadRecord, LeadInput, InfyEnrichedData } from './types';
import { resolveIdentityRefinery } from './services/geminiService';
import { saveEnrichedLead, fetchVaultLeads, checkSupabaseConnection } from './services/supabase';

declare const XLSX: any;

export const calculateCompleteness = (enriched: InfyEnrichedData | null): number => {
  if (!enriched) return 0;
  
  const fieldsToExclude = ['revenue', 'raw_evidence_json'];
  const allFields = Object.keys(enriched).filter(k => !fieldsToExclude.includes(k));
  const nonNullCount = allFields.filter(k => {
    const val = (enriched as any)[k];
    return val !== null && val !== '' && val !== undefined;
  }).length;
  
  return Math.round((nonNullCount / allFields.length) * 100);
};

const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'refinery' | 'vault'>('refinery');
  const [isEngineActive, setIsEngineActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const processingRef = useRef(false);

  const loadVault = async () => {
    try {
      const vaultData = await fetchVaultLeads();
      if (vaultData && vaultData.length > 0) {
        setLeads(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLeadsFromVault = vaultData.filter(v => !existingIds.has(v.id));
          return [...newLeadsFromVault, ...prev];
        });
      }
    } catch (e) { console.error("Infy Vault load failed:", e); }
  };

  useEffect(() => {
    checkSupabaseConnection();
    loadVault();
  }, []);

  useEffect(() => {
    if (!isEngineActive || isProcessing || processingRef.current) return;

    const processQueue = async () => {
      const nextIdx = leads.findIndex(l => l.state === 'queued');
      if (nextIdx === -1) return;

      processingRef.current = true;
      setIsProcessing(true);
      
      const lead = leads[nextIdx];
      const updateLead = async (updates: Partial<LeadRecord>) => {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l));
        
        if (updates.state === 'completed') {
          const finalRecord = { ...lead, ...updates };
          await saveEnrichedLead(finalRecord as LeadRecord);
        }
      };

      try {
        updateLead({ state: 'running', progress: 10, last_stage: 'PROCESSING_SERP' });
        
        // Single unified refinery call that handles SERP internally
        const enriched = await resolveIdentityRefinery(
          lead.input.declaredTitle,
          lead.id,
          { 
            email: lead.input.email, 
            firstName: lead.input.firstName, 
            lastName: lead.input.lastName, 
            firmName: lead.input.firmName, 
            website: lead.input.website 
          }
        );

        updateLead({ 
          state: 'completed', 
          progress: 100, 
          last_stage: 'COMPLETED',
          enriched: enriched,
          completedAt: Date.now()
        });

      } catch (err: any) {
        console.error("Infy Pipeline Error:", err.message);
        updateLead({ 
          state: 'error', 
          last_stage: 'ERROR', 
          error: err.message || 'Pipeline interruption' 
        });
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [leads, isEngineActive, isProcessing]);

  const handleExport = () => {
    const dataToExport = leads.filter(l => l.state === 'completed' && (selectedIds.size === 0 || selectedIds.has(l.id)));
    if (dataToExport.length === 0) return;

    const flattened = dataToExport.map(l => {
      const e = l.enriched!;
      const exportRow: any = {};
      Object.keys(e).forEach(key => {
        const val = (e as any)[key];
        exportRow[key] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(flattened);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "infy_export_view");
    XLSX.writeFile(wb, `Infy_Intelligence_Refinery_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleAddLead = (input: LeadInput) => {
    setLeads(prev => [{
      id: crypto.randomUUID(),
      batchId: 'MANUAL',
      input,
      state: 'queued',
      progress: 0,
      last_stage: 'QUEUED',
      enriched: null,
      createdAt: Date.now()
    }, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans">
      <header className="bg-[#000B14] px-10 py-6 flex items-center justify-between sticky top-0 z-50 border-b-[6px] border-indigo-600 shadow-2xl">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-indigo-400 border border-white/10">
              <span className="font-black text-xl">LN</span>
            </div>
            <div>
              <h1 className="text-white font-black text-xl tracking-tighter uppercase leading-none">
                LabelNest <span className="text-indigo-500">Refinery</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isEngineActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Infy Intelligence Refinery {isEngineActive ? 'Active' : 'Standby'}
                </span>
              </div>
            </div>
          </div>
          <nav className="flex bg-white/5 p-1.5 rounded-xl border border-white/5">
            <button onClick={() => setActiveTab('refinery')} className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'refinery' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Refinery</button>
            <button onClick={() => setActiveTab('vault')} className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'vault' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Vault</button>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={handleExport} className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all border border-white/10">Export Logic</button>
          <button onClick={() => setIsEngineActive(!isEngineActive)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase border-2 ${isEngineActive ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'}`}>{isEngineActive ? 'Pause Pipeline' : 'Ignite Engine'}</button>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto w-full p-10 flex-grow">
        {activeTab === 'refinery' ? (
          <div className="grid grid-cols-12 gap-10">
            <aside className="col-span-12 lg:col-span-4 space-y-10">
              <LeadForm onAdd={handleAddLead} isLoading={isProcessing} />
              <BulkEngine onBulkAdd={(inputs) => setLeads(prev => [...inputs.map(i => ({ id: crypto.randomUUID(), batchId: 'BULK', input: i, state: 'queued' as any, progress: 0, last_stage: 'QUEUED' as any, enriched: null, createdAt: Date.now() })), ...prev])} isProcessing={isProcessing} leads={leads} />
              <StateMappingTool />
            </aside>
            <section className="col-span-12 lg:col-span-8 space-y-6">
              <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] pb-4 border-b-2 border-slate-200">Processing Floor</h2>
              {leads.filter(l => l.state !== 'completed').map(lead => (
                <LeadCard key={lead.id} lead={lead} onRetry={(id: string) => setLeads(prev => prev.map(l => l.id === id ? { ...l, state: 'queued' } : l))} />
              ))}
              {leads.filter(l => l.state === 'completed').length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-200">
                  <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] mb-6">Recent Assets</h2>
                  {leads.filter(l => l.state === 'completed').slice(0, 5).map(lead => (
                    <LeadCard key={lead.id} lead={lead} onRetry={() => {}} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="bg-[#000B14] rounded-[48px] p-12 min-h-[700px] border border-white/5">
            <div className="flex justify-between items-center mb-12 border-b border-white/10 pb-10">
               <div><h2 className="text-4xl font-black text-white uppercase tracking-tighter">Infy Vault</h2><p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Verified Intelligence Feed</p></div>
               <div className="flex gap-4">
                 <button onClick={loadVault} className="bg-white/5 hover:bg-white/10 text-white px-8 py-5 rounded-2xl text-[11px] font-black uppercase border border-white/10">Refresh Vault</button>
                 <button onClick={handleExport} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase shadow-2xl">Bulk Export</button>
               </div>
            </div>
            <div className="space-y-6">
               {leads.filter(l => l.state === 'completed').map(lead => (
                 <LeadCard key={lead.id} lead={lead} onRetry={() => {}} showCheckbox isSelected={selectedIds.has(lead.id)} onSelect={(id: string) => setSelectedIds(prev => {const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;})} />
               ))}
               {leads.filter(l => l.state === 'completed').length === 0 && (
                 <div className="text-center py-32">
                   <p className="text-slate-500 font-black text-xs uppercase tracking-[0.5em]">No Assets Locked in Infy Vault</p>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;