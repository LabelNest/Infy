
import React, { useState, useRef } from 'react'
import { LeadInput, LeadRecord } from '../types'
declare const XLSX: any

interface Props {
  onBulkAdd: (leads: LeadInput[]) => void
  isProcessing: boolean
  leads: LeadRecord[]
}

export const BulkEngine: React.FC<Props> = ({ onBulkAdd }) => {
  const [csvText, setCsvText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const headers = "Email,First Name,Last Name,Firm Name,Declared Title,Website\n";
    const sample = "john.doe@firm.com,John,Doe,Example Corp,VP Engineering,https://example.com";
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'infy_refinery_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleProcessText = () => {
    const lines = csvText.split('\n').filter(l => l.trim() !== '')
    const parsed: LeadInput[] = lines.map(l => {
      const p = l.split(',')
      return {
        email: p[0]?.trim(),
        firstName: p[1]?.trim(),
        lastName: p[2]?.trim(),
        firmName: p[3]?.trim(),
        declaredTitle: p[4]?.trim(),
        website: p[5]?.trim()
      }
    }).filter(l => l.email && l.firstName && l.firmName)

    if (parsed.length > 0) {
      onBulkAdd(parsed)
      setCsvText('')
    }
  }

  const handleFile = (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[]
      const parsed = json.slice(1).map(r => ({
        email: String(r[0] || ''), 
        firstName: String(r[1] || ''), 
        lastName: String(r[2] || ''), 
        firmName: String(r[3] || ''), 
        declaredTitle: String(r[4] || ''), 
        website: String(r[5] || '')
      })).filter(l => l.email && l.firstName)
      onBulkAdd(parsed)
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bulk Intake</h2>
        </div>
        <button 
          onClick={downloadTemplate}
          className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
        >
          Download Template
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <textarea 
            value={csvText} 
            onChange={e => setCsvText(e.target.value)} 
            placeholder="Paste CSV data: Email, First, Last, Firm, Title, Website..."
            className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner resize-none placeholder:text-slate-300" 
          />
          <div className="absolute bottom-4 right-4 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded backdrop-blur-sm">Paste Raw Data</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">Required Schema:</span>
          {["Email", "First", "Last", "Firm", "Title", "Website"].map(field => (
            <span key={field} className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-600">{field}</span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleProcessText}
            disabled={!csvText.trim()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
          >
            Process Text
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200 active:scale-95"
          >
            Upload File
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept=".csv, .xlsx, .xls" />
      </div>
    </div>
  )
}
