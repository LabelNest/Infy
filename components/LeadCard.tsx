import React, { useState } from 'react';
import { LeadRecord } from '../types';
import { calculateCompleteness } from '../App';

interface Props {
  lead: LeadRecord;
  onRetry: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  showCheckbox?: boolean;
}

export const LeadCard: React.FC<Props> = ({ lead, onRetry, isSelected, onSelect, showCheckbox }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isRunning = lead.state === 'running';
  const isCompleted = lead.state === 'completed';
  const isFailed = lead.state === 'error';
  const completeness = calculateCompleteness(lead.enriched);
  const hasLinkedin = isCompleted && lead.enriched?.linkedin_url;

  return (
    <div className={`relative bg-white border-2 rounded-[24px] overflow-hidden transition-all duration-300 ${
      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl' :
      isCompleted ? 'border-emerald-500/50 shadow-lg' : 
      isRunning ? 'border-indigo-600 shadow-xl' : 
      isFailed ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 shadow-sm'
    }`}>
      {showCheckbox && (
        <div onClick={() => onSelect?.(lead.id)} className="absolute left-0 top-0 bottom-0 w-16 z-10 flex items-center justify-center cursor-pointer">
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
            {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
          </div>
        </div>
      )}

      <div className={`px-8 py-6 flex items-center justify-between ${showCheckbox ? 'pl-20' : ''}`}>
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black transition-all ${isCompleted ? 'bg-emerald-600 text-white' : isFailed ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <span className="text-[12px]">{isCompleted ? `${completeness}%` : '---'}</span>
            <span className="text-[7px] uppercase tracking-tighter opacity-70">Density</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-slate-900 text-base uppercase tracking-tight truncate">{lead.input.firstName} {lead.input.lastName}</h3>
              {hasLinkedin && (
                <a href={lead.enriched?.linkedin_url || '#'} target="_blank" rel="noreferrer" className="w-6 h-6 bg-[#0077B5]/10 text-[#0077B5] rounded-md flex items-center justify-center hover:bg-[#0077B5] hover:text-white transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
              )}
              {isCompleted && <span className="text-[8px] px-2 py-0.5 rounded font-black bg-slate-900 text-white uppercase tracking-widest">ASSET LOCKED</span>}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{lead.input.firmName}</span>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span className={`text-[10px] font-black uppercase ${isFailed ? 'text-rose-500' : 'text-indigo-600'}`}>{isCompleted ? lead.enriched?.standard_title : lead.last_stage}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isFailed && (
            <button onClick={() => onRetry(lead.id)} className="text-[10px] font-black text-rose-500 uppercase tracking-widest border border-rose-200 px-4 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all">Retry</button>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      </div>

      {isRunning && (
        <div className="h-1 w-full bg-slate-100 relative">
          <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${lead.progress}%` }}></div>
        </div>
      )}

      {isExpanded && lead.enriched && (
        <div className="p-10 border-t border-slate-200 bg-slate-50 space-y-10">
          <div>
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
              Refinery Taxonomy
            </h4>
            <div className="grid grid-cols-4 gap-8">
              <DataGroup label="F0: Master Function" value={lead.enriched.f0} />
              <DataGroup label="F1: Sub-Function" value={lead.enriched.f1} />
              <DataGroup label="F2: Specialty" value={lead.enriched.f2} />
              <DataGroup label="Standard Title" value={lead.enriched.standard_title} />
              <DataGroup label="Job Level" value={lead.enriched.job_level !== null ? `L${lead.enriched.job_level}` : null} />
              <DataGroup label="Job Role" value={lead.enriched.job_role} />
              <DataGroup label="Intent Signal" value={lead.enriched.intent_signal} sub={`${lead.enriched.intent_score}% confidence`} />
              <DataGroup label="Refinery ID" value={lead.enriched.job_id} />
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
              Firmographics & Location
            </h4>
            <div className="grid grid-cols-4 gap-8">
              <DataGroup label="Vertical" value={lead.enriched.vertical} />
              <DataGroup label="Industry" value={lead.enriched.industry} />
              <DataGroup label="Revenue" value={lead.enriched.revenue} />
              <DataGroup label="Firm Name" value={lead.enriched.firm_name} />
              <DataGroup label="City" value={lead.enriched.city} />
              <DataGroup label="State / Province" value={lead.enriched.state} />
              <DataGroup label="Country" value={lead.enriched.country} />
              <DataGroup label="Phone" value={lead.enriched.phone} />
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
              System Metadata
            </h4>
            <div className="grid grid-cols-4 gap-8">
              <DataGroup label="Created At" value={new Date(lead.enriched.created_at).toLocaleString()} />
              <DataGroup label="Resolution Status" value={lead.enriched.resolution_status} />
              <DataGroup label="Last Synced" value={lead.enriched.last_synced_at ? new Date(lead.enriched.last_synced_at).toLocaleString() : 'Never'} />
              <DataGroup label="Project ID" value={lead.enriched.project_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DataGroup = ({ label, value, sub }: { label: string, value: string | null | undefined, sub?: string }) => (
  <div className="min-w-0">
    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
    <div className={`text-[11px] font-black uppercase truncate ${!value ? 'text-slate-300' : 'text-slate-800'}`}>
      {value || 'Not Resolved'}
    </div>
    {sub && value && <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</div>}
  </div>
);