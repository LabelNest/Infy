
import React, { useState, useEffect } from 'react';
import { 
  requestCredits, 
  getPendingRequests, 
  resolveCreditRequest, 
  CreditRequest,
  getAllAccessRequests,
  resolveAccessRequest,
  createManualUser,
  fetchUsageHistory,
  getUserBalance
} from '../services/supabase';
import { AppAccessRequest, AccessStatus, UserUsageLog } from '../types';

interface Props {
  currentUser: string;
  balance: number;
  onRefresh: () => void;
}

export const CreditSystem: React.FC<Props> = ({ currentUser, balance, onRefresh }) => {
  const [requestAmount, setRequestAmount] = useState(500);
  const [isRequesting, setIsRequesting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<CreditRequest[]>([]);
  const [accessRequests, setAccessRequests] = useState<AppAccessRequest[]>([]);
  
  // User Management State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCredits, setNewUserCredits] = useState(100);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // Usage Audit State
  const [selectedUserAudit, setSelectedUserAudit] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<UserUsageLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [userBalances, setUserBalances] = useState<Record<string, number>>({});

  const isAdmin = currentUser === 'ankit@labelnest.in';

  useEffect(() => {
    if (isAdmin) {
      loadPending();
      loadAccess();
    }
  }, [isAdmin]);

  const loadPending = async () => {
    const reqs = await getPendingRequests();
    setPendingRequests(reqs);
  };

  const loadAccess = async () => {
    const reqs = await getAllAccessRequests();
    setAccessRequests(reqs);
    
    // Batch load balances for all users in the management view
    const balances: Record<string, number> = {};
    for (const req of reqs) {
        balances[req.email] = await getUserBalance(req.email);
    }
    setUserBalances(balances);
  };

  const handleManualUserAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) return;
    setIsCreatingUser(true);
    try {
      await createManualUser(newUserEmail, newUserName, newUserCredits);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserCredits(100);
      await loadAccess();
      alert(`User ${newUserName} authorized and provisioned with ${newUserCredits} credits.`);
    } catch (err) {
      alert('Failed to onboard user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const viewAudit = async (email: string) => {
    setSelectedUserAudit(email);
    setIsLoadingAudit(true);
    const logs = await fetchUsageHistory(email);
    setAuditLogs(logs);
    setIsLoadingAudit(false);
  };

  const handleRequest = async () => {
    setIsRequesting(true);
    await requestCredits(currentUser, requestAmount);
    setIsRequesting(false);
    alert('Credit request submitted for approval by ankit@labelnest.in');
  };

  const handleResolveCredit = async (req: CreditRequest, approved: boolean) => {
    await resolveCreditRequest(req.id, req.user_email, req.requested_amount, approved);
    loadPending();
    onRefresh();
  };

  const handleResolveAccess = async (email: string, status: AccessStatus) => {
    await resolveAccessRequest(email, status);
    loadAccess();
  };

  return (
    <div className="space-y-12">
      {/* USER REQUEST SECTION */}
      <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">Credit Logistics</h2>
        </div>

        <div className="flex items-center justify-between mb-10 bg-slate-50 p-8 rounded-[32px] border border-dashed border-slate-300">
          <div>
            <span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Balance</span>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">{balance} <span className="text-sm text-slate-400 font-bold uppercase ml-1">Credits</span></span>
          </div>
          <div className="w-16 h-16 rounded-full border-[6px] border-emerald-500 border-t-transparent animate-spin opacity-20"></div>
        </div>

        <div className="space-y-5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Request Additional Capacity</label>
          <div className="flex gap-4">
            <select 
              value={requestAmount} 
              onChange={e => setRequestAmount(Number(e.target.value))}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-indigo-500 transition-all appearance-none"
            >
              <option value={100}>100 Units (Discovery)</option>
              <option value={500}>500 Units (Standard)</option>
              <option value={1000}>1,000 Units (Scale)</option>
              <option value={5000}>5,000 Units (Enterprise)</option>
            </select>
            <button 
              onClick={handleRequest}
              disabled={isRequesting}
              className="px-12 bg-[#001529] hover:bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:bg-slate-200"
            >
              Submit Request
            </button>
          </div>
        </div>
      </div>

      {/* ADMIN CONTROL PANEL */}
      {isAdmin && (
        <div className="space-y-12">
          {/* MASTER USER MANAGEMENT */}
          <div className="bg-[#000B14] rounded-[48px] p-10 shadow-2xl border-b-[8px] border-indigo-600">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-widest leading-none">Institutional Identity Master</h2>
                  <p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">Manual Onboarding & Access Control</p>
                </div>
              </div>
            </div>

            {/* Manual Onboard Form */}
            <form onSubmit={handleManualUserAdd} className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-10 grid grid-cols-12 gap-6 items-end">
              <div className="col-span-12 lg:col-span-4">
                <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Institutional Email</label>
                <input 
                  type="email" 
                  value={newUserEmail} 
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="name@firm.com"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>
              <div className="col-span-12 lg:col-span-3">
                <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Full Legal Name</label>
                <input 
                  type="text" 
                  value={newUserName} 
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>
              <div className="col-span-12 lg:col-span-2">
                <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Initial Credits</label>
                <input 
                  type="number" 
                  value={newUserCredits} 
                  onChange={e => setNewUserCredits(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>
              <div className="col-span-12 lg:col-span-3">
                <button 
                  type="submit" 
                  disabled={isCreatingUser}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all"
                >
                  {isCreatingUser ? 'Authorizing...' : 'Provision User'}
                </button>
              </div>
            </form>

            {/* User List Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Identity / Name</th>
                    <th className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Balance</th>
                    <th className="text-right py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {accessRequests.filter(u => u.email !== 'ankit@labelnest.in').map(user => (
                    <tr key={user.email} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-5">
                        <span className="block text-sm font-black text-white">{user.full_name || 'Legacy Identity'}</span>
                        <span className="block text-[10px] font-bold text-indigo-400/60 lowercase">{user.email}</span>
                      </td>
                      <td className="py-5 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          user.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          user.status === 'denied' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-5 text-center">
                        <span className="text-indigo-100 font-black text-sm">{userBalances[user.email] ?? '...'}</span>
                      </td>
                      <td className="py-5 text-right space-x-2">
                        <button 
                          onClick={() => viewAudit(user.email)}
                          className="bg-white/5 hover:bg-indigo-600 text-white p-2.5 rounded-lg border border-white/10 transition-all active:scale-95"
                          title="View Usage Logs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </button>
                        <button 
                          onClick={() => handleResolveAccess(user.email, user.status === 'approved' ? 'denied' : 'approved')}
                          className={`p-2.5 rounded-lg border transition-all active:scale-95 ${
                            user.status === 'approved' 
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500 hover:text-white' 
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500 hover:text-white'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={user.status === 'approved' ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* USAGE LOG MODAL / PANEL */}
          {selectedUserAudit && (
            <div className="bg-white rounded-[48px] p-10 shadow-xl border-2 border-slate-900/5 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Refinery Audit Trail</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Utilization Logs for {selectedUserAudit}</p>
                </div>
                <button 
                  onClick={() => setSelectedUserAudit(null)}
                  className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {isLoadingAudit ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">Fetching intelligence records...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
                   <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">No Intelligence Consumption Detected</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm text-indigo-600 font-black text-xs">
                          {new Date(log.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                        </div>
                        <div>
                          <span className="block text-xs font-black text-slate-900 uppercase tracking-tight">{log.firm_name}</span>
                          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{log.standard_title}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">-1 Unit</span>
                        <span className="block text-[8px] font-bold text-slate-300 uppercase mt-1">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CREDIT COMMAND (Legacy) */}
          <div className="bg-[#000B14] rounded-[48px] p-10 shadow-2xl border border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-base font-black text-white uppercase tracking-widest">Ad-hoc Capacity Requests</h2>
            </div>
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                  <p className="text-slate-600 text-[11px] font-black uppercase tracking-widest">No Capacity Requests Pending</p>
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div key={req.id} className="bg-white/5 p-6 rounded-[32px] border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div className="min-w-0">
                      <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Request Unit</span>
                      <span className="block text-sm font-black text-white truncate">{req.user_email}</span>
                      <span className="block text-xl font-black text-indigo-100 mt-1">+{req.requested_amount} Intelligence Credits</span>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleResolveCredit(req, true)}
                        className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white hover:bg-emerald-600 transition-all shadow-xl active:scale-90"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                      </button>
                      <button 
                        onClick={() => handleResolveCredit(req, false)}
                        className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white hover:bg-rose-600 transition-all shadow-xl active:scale-90"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
