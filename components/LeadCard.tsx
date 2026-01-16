import React, { useState } from 'react';
import { LeadInput } from '../types';

interface Props {
  onAdd: (input: LeadInput) => void;
  isLoading: boolean;
}

export const LeadForm: React.FC<Props> = ({ onAdd, isLoading }) => {
  const [formData, setFormData] = useState<LeadInput>({
    email: '',
    firstName: '',
    lastName: '',
    firmName: '',
    declaredTitle: '',
    website: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firmName) return;
    onAdd(formData);
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      firmName: '',
      declaredTitle: '',
      website: ''
    });
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Manual Intake</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="First Name" 
            value={formData.firstName} 
            onChange={(v: string) => setFormData({ ...formData, firstName: v })} 
            placeholder="John"
          />
          <Input 
            label="Last Name" 
            value={formData.lastName} 
            onChange={(v: string) => setFormData({ ...formData, lastName: v })} 
            placeholder="Doe"
          />
        </div>
        
        <Input 
          label="Corporate Email" 
          value={formData.email} 
          onChange={(v: string) => setFormData({ ...formData, email: v })} 
          placeholder="john.doe@firm.com"
          required
        />
        
        <Input 
          label="Firm Name" 
          value={formData.firmName} 
          onChange={(v: string) => setFormData({ ...formData, firmName: v })} 
          placeholder="Infosys, Goldman Sachs..."
          required
        />

        <Input 
          label="Firm Website" 
          value={formData.website} 
          onChange={(v: string) => setFormData({ ...formData, website: v })} 
          placeholder="https://www.infosys.com"
        />
        
        <Input 
          label="Declared Title" 
          value={formData.declaredTitle} 
          onChange={(v: string) => setFormData({ ...formData, declaredTitle: v })} 
          placeholder="VP of Engineering"
        />

        <button
          type="submit"
          disabled={isLoading || !formData.email}
          className="w-full bg-[#001529] hover:bg-indigo-600 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:bg-slate-200"
        >
          {isLoading ? 'Processing...' : 'Initiate Intelligence Cycle'}
        </button>
      </form>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder, required = false }: any) => (
  <div>
    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
      required={required}
    />
  </div>
);