import { Trophy, Medal, FileDown } from 'lucide-react';
import { Shooter, Registration, Score, CompetitionSettings, CATEGORIES } from '../types';
import { useMemo } from 'react';
import { exportToPDF } from '../services/pdfService';
import { toast } from 'sonner';

interface Props {
  shooters: Shooter[];
  registrations: Registration[];
  scores: Score[];
  settings: CompetitionSettings;
  onUpdateScores?: (scores: Score[]) => void;
}

export default function RankingsView({ shooters, registrations, scores, settings, onUpdateScores }: Props) {
  const rankedData = useMemo(() => {
    const isManual = settings.rankingMode === 'manual';

    const list = registrations.map(reg => {
      const shooter = shooters.find(s => s.id === reg.shooterId);
      const score = scores.find(sc => sc.shooterId === reg.shooterId);
      const total = score ? (score.manualTotal !== null ? score.manualTotal : score.seriesScores.reduce((a: number, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) : 0;
      const spareggio = score?.spareggioScore || 0;
      return {
        shooter,
        total,
        spareggio,
        registration: reg,
        score
      };
    }).filter(d => d.shooter);

    if (isManual) {
      return list.sort((a, b) => {
        const rA = a.registration.manualRank ?? 99999;
        const rB = b.registration.manualRank ?? 99999;
        return rA - rB;
      });
    }

    return list.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.spareggio - a.spareggio;
    });
  }, [registrations, shooters, scores, settings.rankingMode]);

  const hasTies = useMemo(() => {
    if (settings.rankingMode === 'manual') return false;
    for (let i = 0; i < rankedData.length - 1; i++) {
      if (rankedData[i].total === rankedData[i + 1].total) return true;
    }
    return false;
  }, [rankedData, settings.rankingMode]);

  const handleExportPDF = () => {
    const isManual = settings.rankingMode === 'manual';
    const headers = ['Pos.', 'Atleta', 'Categoria', isManual ? 'Posizione' : 'Punti Hit'];
    const showSpareggio = settings.drawResolution === 'spareggio' && hasTies;
    
    if (showSpareggio && !isManual) {
      headers.splice(3, 0, 'Spareggio');
    }
    
    const data = rankedData.map((d, idx) => {
      const posLabel = isManual ? (d.registration.manualRank ? `${d.registration.manualRank}°` : '-') : `${idx + 1}°`;
      const valLabel = isManual ? (d.registration.manualRank ? `${d.registration.manualRank}°` : '-') : d.total.toString();
      
      const row = [
        posLabel,
        `${d.shooter?.lastName} ${d.shooter?.firstName}`,
        d.shooter?.category || '',
        valLabel
      ];
      if (showSpareggio && !isManual) {
        row.splice(3, 0, d.spareggio.toString());
      }
      return row;
    });
    
    exportToPDF('Classifica Generale', headers, data, `classifica_${settings.name.replace(/\s+/g, '_')}.pdf`, settings);
    toast.success('PDF generato correttamente');
  };

  const handleSpareggioChange = (shooterId: string, val: string) => {
    if (!onUpdateScores) return;
    const numVal = parseInt(val) || 0;
    const newScores = scores.map(s => s.shooterId === shooterId ? { ...s, spareggioScore: numVal } : s);
    onUpdateScores(newScores);
  };

  const categoryRankings = useMemo(() => {
    const categories: Record<string, typeof rankedData> = {};
    CATEGORIES.forEach(cat => {
      categories[cat] = rankedData.filter(d => d.shooter?.category === cat);
    });
    return categories;
  }, [rankedData]);

  return (
    <div className="p-4 sm:p-8 space-y-8 sm:space-y-12 bg-brand-bg h-full overflow-y-auto high-density-scroll">
      {/* General Classification */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl shadow-lg shadow-amber-900/10">
              <Trophy className="text-amber-500" size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider">Classifica Generale</h2>
              <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none mt-1">Podio basato sui bersagli colpiti</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <button
               onClick={handleExportPDF}
               className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:border-sky-500/50 hover:text-white transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest"
             >
               <FileDown size={14} /> PDF
             </button>
             <span className="hidden sm:inline-block text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded">Live Data</span>
          </div>
        </div>

        <div className="bg-card-bg rounded-xl border border-slate-800 overflow-x-auto no-scrollbar shadow-2xl">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-[#2D3A4F]">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                <th className="px-6 py-4 border-b border-slate-700 w-24">Pos.</th>
                <th className="px-6 py-4 border-b border-slate-700">Atleta</th>
                <th className="px-6 py-4 border-b border-slate-700">Categoria</th>
                {settings.drawResolution === 'spareggio' && hasTies && (
                  <th className="px-6 py-4 border-b border-slate-700 text-center text-amber-500">Spareggio</th>
                )}
                <th className="px-6 py-4 border-b border-slate-700 text-right text-emerald-400">
                  {settings.rankingMode === 'manual' ? 'Posizione' : 'Punti Hit'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rankedData.map((data, idx) => {
                const isPodium = idx < 3;
                const isManual = settings.rankingMode === 'manual';
                const isTied = !isManual && (idx > 0 && rankedData[idx-1].total === data.total) || (idx < rankedData.length - 1 && rankedData[idx+1].total === data.total);
                const pos = isManual ? (data.registration.manualRank ? `${data.registration.manualRank}°` : '-') : `${idx + 1}°`;

                return (
                  <tr key={data.registration.id} className={`${isPodium ? 'bg-amber-500/[0.03]' : ''} ${isTied && settings.drawResolution === 'spareggio' ? 'bg-amber-900/10' : ''} hover:bg-slate-800/40 transition-colors group`}>
                    <td className="px-6 py-4 border-none">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-xl
                        ${idx === 0 ? 'bg-amber-500 text-black shadow-amber-500/20' : 
                          idx === 1 ? 'bg-slate-300 text-black shadow-slate-300/20' : 
                          idx === 2 ? 'bg-amber-800 text-white shadow-amber-800/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}
                      `}>
                        {pos}
                      </div>
                    </td>
                    <td className="px-6 py-4 border-none">
                      <div className="text-sm font-black text-slate-200 uppercase tracking-tight group-hover:text-white transition-colors">
                        {data.shooter?.lastName} {data.shooter?.firstName}
                      </div>
                    </td>
                    <td className="px-6 py-4 border-none">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded border border-slate-700 text-slate-500 uppercase tracking-widest bg-slate-900/50">
                        {data.shooter?.category}
                      </span>
                    </td>
                    {settings.drawResolution === 'spareggio' && hasTies && (
                      <td className="px-6 py-4 border-none text-center">
                        {isTied ? (
                          <input
                            type="number"
                            className="w-16 bg-slate-900 border border-amber-500/30 rounded text-center font-mono font-bold text-amber-500 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                            value={data.spareggio || ''}
                            onChange={e => handleSpareggioChange(data.shooter!.id, e.target.value)}
                          />
                        ) : (
                          <span className="text-slate-700 font-mono text-xs">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 border-none text-right">
                      <span className="text-2xl font-black text-sky-400 font-mono tracking-tighter">
                        {settings.rankingMode === 'manual' 
                          ? (data.registration.manualRank ? `${data.registration.manualRank}°` : '-')
                          : data.total
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rankedData.length === 0 && (
                 <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.2em]">
                       Nessun dato disponibile per la classifica
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Category Mini-Tables */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-lg shadow-emerald-900/10">
            <Medal className="text-emerald-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Breakdown Per Categoria</h3>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none mt-1 italic">Premi e riconoscimenti di settore</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map(cat => {
            const shooters = categoryRankings[cat];
            if (shooters.length === 0) return null;
            return (
              <div key={cat} className="bg-card-bg rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col group hover:border-emerald-500/30 transition-colors">
                <div className="bg-[#2D3A4F] p-4 text-white font-black text-xs flex justify-between items-center border-b border-slate-700">
                  <span className="uppercase tracking-[0.2em] italic text-sky-400">{cat}</span>
                  <span className="text-[9px] bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-slate-400">{shooters.length} ATLETI</span>
                </div>
                <div className="p-3 flex-1">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800/50 text-slate-600 font-black uppercase tracking-widest">
                        <th className="p-2 text-left w-12 italic">Pos</th>
                        <th className="p-2 text-left">Cognome Nome</th>
                        <th className="p-2 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 font-medium">
                      {shooters.map((s, i) => (
                        <tr key={s.registration.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-2 font-bold text-slate-500">{i + 1}°</td>
                          <td className="p-2 text-slate-300 truncate max-w-[140px] uppercase font-bold tracking-tight">{s.shooter?.lastName} {s.shooter?.firstName?.charAt(0)}.</td>
                          <td className="p-2 text-right font-black text-emerald-400 font-mono text-xs">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  );
}
