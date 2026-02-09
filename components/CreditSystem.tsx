
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
  getUserBalance,
  updateUserBalance
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
  const [creditInput, setCreditInput] = useState<Record<string, string>>({});

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
    
    // Batch load balances
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
      onRefresh();
      alert(`User ${newUserName} successfully onboarded.`);
    } catch (err) {
      alert('Failed to onboard user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDirectCreditUpdate = async (email: string) => {
    const amount = parseInt(creditInput[email] || "0");
    if (isNaN(amount) || amount <= 0) return;

    const current = userBalances[email] || 0;
    const newTotal = current + amount;

    try {
      await updateUserBalance(email, newTotal);
      setUserBalances(prev => ({ ...prev, [email]: newTotal }));
      setCreditInput(prev => ({ ...prev, [email]: "" }));
      onRefresh();
      alert(`Successfully added ${amount} credits to ${email}.`);
    } catch (e) {
      alert('Failed to update balance.');
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
    alert('Credit request submitted for approval.');
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
    <div className="space-y-12 pb-20">
      {/* USER VIEW (Personal Dashboard) */}
      {!isAdmin && (
        <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">My Logistics</h2>
          </div>

          <div className="flex items-center justify-between mb-10 bg-slate-50 p-8 rounded-[32px] border border-dashed border-slate-300">
            <div>
              <span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Balance</span>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{balance} <span className="text-sm text-slate-400 font-bold uppercase ml-1">Credits</span></span>
            </div>
          </div>

          <div className="space-y-5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Request Capacity Expansion</label>
            <div className="flex gap-4">
              <select 
                value={requestAmount} 
                onChange={e => setRequestAmount(Number(e.target.value))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-indigo-500 transition-all appearance-none"
              >
                <option value={100}>100 Units</option>
                <option value={500}>500 Units</option>
                <option value={1000}>1,000 Units</option>
              </select>
              <button 
                onClick={handleRequest}
                disabled={isRequesting}
                className="px-12 bg-[#001529] hover:bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all disabled:bg-slate-200"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CONTROL PANEL */}
      {isAdmin && (
        <div className="space-y-12">
          {/* USER MANAGEMENT */}
          <div className="bg-[#000B14] rounded-[48px] p-10 shadow-2xl border-b-[8px] border-indigo-600">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-widest leading-none">Institutional User Hub</h2>
                  <p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">Direct Admin Override</p>
                </div>
              </div>
              <button onClick={loadAccess} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-400/30 px-6 py-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Sync All Data</button>
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
                <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Legal Name</label>
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
                <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Initial Units</label>
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
                  {isCreatingUser ? 'Processing...' : 'Provision User'}
                </button>
              </div>
            </form>

            {/* Master User Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Identity</th>
                    <th className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Balance</th>
                    <th className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Add Credits</th>
                    <th className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="text-right py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {accessRequests.filter(u => u.email !== 'ankit@labelnest.in').map(user => (
                    <tr key={user.email} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-5">
                        <span className="block text-sm font-black text-white">{user.full_name || 'Generic Identity'}</span>
                        <span className="block text-[10px] font-bold text-indigo-400/60">{user.email}</span>
                      </td>
                      <td className="py-5 text-center">
                        <span className="text-xl font-black text-white">⚡ {userBalances[user.email] ?? '0'}</span>
                      </td>
                      <td className="py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number" 
                            placeholder="+Amt"
                            value={creditInput[user.email] || ''}
                            onChange={e => setCreditInput(prev => ({ ...prev, [user.email]: e.target.value }))}
                            className="w-20 bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-xs font-black text-white outline-none focus:border-indigo-500"
                          />
                          <button 
                            onClick={() => handleDirectCreditUpdate(user.email)}
                            className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-lg text-white transition-all shadow-lg active:scale-95"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
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
                      <td className="py-5 text-right space-x-2">
                        <button 
                          onClick={() => viewAudit(user.email)}
                          className="bg-white/5 hover:bg-indigo-600 text-white p-2.5 rounded-lg border border-white/10 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </button>
                        <button 
                          onClick={() => handleResolveAccess(user.email, user.status === 'approved' ? 'denied' : 'approved')}
                          className={`p-2.5 rounded-lg border transition-all ${
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

          {/* Audit Logs */}
          {selectedUserAudit && (
            <div className="bg-white rounded-[48px] p-10 shadow-xl animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Intelligence Audit</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Utilization trace: {selectedUserAudit}</p>
                </div>
                <button onClick={() => setSelectedUserAudit(null)} className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {isLoadingAudit ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Zero Consumption History</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-indigo-600 font-black text-xs">
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
        </div>
      )}
    </div>
  );
};
