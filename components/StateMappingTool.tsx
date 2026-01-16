
import React, { useState } from 'react';
import { resolveCountryFromState } from '../services/geminiService';

export const StateMappingTool: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState<{ state_or_province: string, country: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    try {
      const data = await resolveCountryFromState(inputValue);
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-white font-black text-xs uppercase tracking-widest">Tactical Mapping Engine</h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-tighter">Deterministic Location Resolver</p>
        </div>
      </div>

      <form onSubmit={handleResolve} className="space-y-4">
        <div>
          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Administrative Unit</label>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. Maharashtra, California..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-indigo-100 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all active:scale-95 border border-indigo-400/20"
        >
          {loading ? 'Processing Node...' : 'Resolve Exact Country'}
        </button>
      </form>

      {result && (
        <div className="mt-6 pt-5 border-t border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div>
              <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Resolved Country</span>
              <span className={`text-xs font-black uppercase tracking-tight ${result.country ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.country || 'No Exact Match Found'}
              </span>
            </div>
            {result.country && (
              <div className="w-6 h-6 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
