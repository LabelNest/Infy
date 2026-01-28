
import React, { useState, useEffect } from 'react';
import { getAccessStatus, requestAccess } from '../services/supabase';
import { AccessStatus } from '../types';

interface Props {
  onAuthenticated: (email: string) => void;
}

const ADMIN_EMAIL = 'ankit@labelnest.in';
const ADMIN_PASSWORD_SECRET = (process.env.ADMIN_PASSWORD || 'LabelAnkit2025').trim();

export const AuthGuard: React.FC<Props> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [status, setStatus] = useState<AccessStatus | 'none' | 'checking' | 'error'>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const adminSession = sessionStorage.getItem('labelnest_admin_active');
    if (adminSession) {
      setEmail(ADMIN_EMAIL);
      onAuthenticated(ADMIN_EMAIL);
      return;
    }

    const savedEmail = localStorage.getItem('labelnest_identity');
    if (savedEmail && savedEmail !== ADMIN_EMAIL) {
      setEmail(savedEmail);
      autoAuth(savedEmail);
    } else {
      setStatus('none');
    }
  }, []);

  const autoAuth = async (savedEmail: string) => {
    const s = await getAccessStatus(savedEmail);
    setStatus(s);
    if (s === 'approved') {
      onAuthenticated(savedEmail);
    }
  };

  const handleInitialEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail.includes('@')) {
        setError('Valid institutional email required');
        return;
    }

    if (normalizedEmail === ADMIN_EMAIL) {
      setIsLocked(true);
      return;
    }

    setLoading(true);
    const s = await getAccessStatus(normalizedEmail);
    setStatus(s);
    
    if (s === 'approved') {
      localStorage.setItem('labelnest_identity', normalizedEmail);
      onAuthenticated(normalizedEmail);
    } else if (s === 'none') {
      setError('Identity not found in refinery vault.');
    } else if (s === 'error') {
      setError('Refinery connection error. Check Database RLS.');
    } else if (s === 'pending') {
      setError('Refinery clearance is still pending approval.');
    } else if (s === 'denied') {
      setError('Access to this identity has been restricted.');
    }
    setLoading(false);
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.trim() === ADMIN_PASSWORD_SECRET) {
      sessionStorage.setItem('labelnest_admin_active', 'true');
      onAuthenticated(ADMIN_EMAIL);
    } else {
      setError('Invalid master passphrase');
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    setLoading(true);
    await requestAccess(email);
    setStatus('pending');
    setLoading(false);
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#000B14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000B14] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-700">
        
        <div className="text-center mb-12">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[32px] flex items-center justify-center text-white mx-auto shadow-2xl mb-8 border border-white/10 ring-8 ring-indigo-500/5">
              <span className="font-black text-4xl tracking-tighter">LN</span>
            </div>
            {isLocked && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white border-4 border-[#000B14] shadow-lg animate-bounce">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              </div>
            )}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Refinery Entry</h1>
          <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] opacity-80">Institutional Intelligence Portal</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[48px] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-600/10 blur-[60px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-1000"></div>

          {(status === 'none' || status === 'denied' || status === 'error') && (
            <div className="space-y-6">
              {!isLocked ? (
                <form onSubmit={handleInitialEntry} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Institutional Identity</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      placeholder="name@labelnest.in"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center text-white font-black text-lg outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                      required
                    />
                  </div>
                  {error && (
                    <div className="flex flex-col items-center justify-center gap-2 text-rose-500 animate-in slide-in-from-top-2">
                       <div className="flex items-center gap-2">
                         <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                         <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                       </div>
                       {status === 'error' && <p className="text-[8px] text-slate-500 normal-case opacity-60">Open Console (F12) for technical trace</p>}
                    </div>
                  )}
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase py-5 rounded-2xl tracking-widest text-[11px] transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Validate Entry'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminAuth} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center mb-2 bg-indigo-600/10 p-4 rounded-2xl border border-indigo-600/20">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zM7 7a3 3 0 016 0v2H7V7z" /></svg>
                      Owner Clearance Required
                    </span>
                    <p className="text-white text-sm font-black mt-2 tracking-tight">{email}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Refinery Passphrase</label>
                    <input 
                      type="password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      placeholder="••••••••••••"
                      className="w-full bg-white/5 border border-white/20 rounded-2xl px-6 py-5 text-center text-white font-black text-2xl outline-none focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-400/50 transition-all tracking-[0.4em]"
                      autoFocus
                      required
                    />
                  </div>
                  {error && <p className="text-rose-500 text-[10px] font-black uppercase text-center tracking-widest animate-pulse">{error}</p>}
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => { setIsLocked(false); setPassword(''); }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 font-black uppercase py-5 rounded-2xl tracking-widest text-[10px] transition-all border border-white/5"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase py-5 rounded-2xl tracking-widest text-[10px] transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98]"
                    >
                      Verify Master
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {status === 'pending' && (
            <div className="text-center py-6 space-y-6 animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto">
                <svg className="w-8 h-8 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-black uppercase tracking-widest mb-2">Access Pending</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase leading-relaxed tracking-widest">Your request has been logged.<br/>Owner approval required (ankit@labelnest.in)</p>
              </div>
              <button onClick={() => setStatus('none')} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors pt-4 block mx-auto underline">Return to login</button>
            </div>
          )}

          {status === 'none' && !isLocked && email.includes('@') && !loading && !error && (
            <div className="mt-8 pt-8 border-t border-white/5 text-center">
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Identity unknown to refinery</p>
              <button 
                onClick={handleRequest}
                className="w-full text-[10px] font-black text-indigo-400 border border-indigo-400/30 px-6 py-4 rounded-xl uppercase tracking-widest hover:bg-indigo-400 hover:text-white transition-all shadow-lg"
              >
                Request Clearance Path
              </button>
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.3em]">
          &copy; 2025 LabelNest Institutional Systems
        </p>
      </div>
    </div>
  );
};
