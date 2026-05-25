import { useState, useMemo } from 'react';
import { Trophy, Plus, Target, Trash2, Save, X, CheckSquare, FileDown } from 'lucide-react';
import { Shooter, Registration, Score, CompetitionSettings, CATEGORIES, Barrage } from '../types';
import { toast } from 'sonner';
import { exportToPDF } from '../services/pdfService';

interface Props {
  shooters: Shooter[];
  registrations: Registration[];
  scores: Score[];
  settings: CompetitionSettings;
  barrages: Barrage[];
  onUpdateBarrages: (barrages: Barrage[]) => void;
}

export default function BarrageView({ shooters, registrations, scores, settings, barrages, onUpdateBarrages }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [nPerCategory, setNPerCategory] = useState(1);
  const [selectedShooters, setSelectedShooters] = useState<string[]>([]);
  const [barrageName, setBarrageName] = useState('');
  const [barrageType, setBarrageType] = useState<'elimination' | 'series'>('elimination');
  const [bSeriesCount, setBSeriesCount] = useState(1);
  const [bTargetsPerSeries, setBTargetsPerSeries] = useState(1);

  const rankedData = useMemo(() => {
    return registrations.map(reg => {
      const shooter = shooters.find(s => s.id === reg.shooterId);
      const score = scores.find(sc => sc.shooterId === reg.shooterId);
      const total = score ? (score.manualTotal !== null ? score.manualTotal : score.seriesScores.reduce((a: number, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) : 0;
      return { shooter, total, shooterId: reg.shooterId };
    }).sort((a, b) => b.total - a.total);
  }, [registrations, shooters, scores]);

  const handleAutoSelect = () => {
    const selectedIds = new Set<string>();
    CATEGORIES.forEach(cat => {
      const catShooters = rankedData.filter(d => d.shooter?.category === cat);
      catShooters.slice(0, nPerCategory).forEach(d => {
        if (d.shooterId) selectedIds.add(d.shooterId);
      });
    });
    setSelectedShooters(Array.from(selectedIds));
    toast.success(`Selezionati primi ${nPerCategory} per categoria`);
  };

  const handleCreateBarrage = () => {
    if (!barrageName.trim()) {
      toast.error('Inserisci un nome per il barrage');
      return;
    }
    if (selectedShooters.length === 0) {
      toast.error('Seleziona almeno un partecipante');
      return;
    }

    const newBarrage: Barrage = {
      id: crypto.randomUUID(),
      name: barrageName,
      type: barrageType,
      seriesCount: barrageType === 'series' ? bSeriesCount : 1,
      targetsPerSeries: barrageType === 'series' ? bTargetsPerSeries : 1,
      participants: selectedShooters,
      scores: selectedShooters.reduce((acc, id) => ({ 
        ...acc, 
        [id]: Array(barrageType === 'series' ? bSeriesCount : 1).fill(0) 
      }), {})
    };

    onUpdateBarrages([...barrages, newBarrage]);
    setIsAdding(false);
    setSelectedShooters([]);
    setBarrageName('');
    toast.success('Barrage creato con successo');
  };

  const handleScoreChange = (barrageId: string, shooterId: string, sIdx: number, val: string) => {
    const numVal = parseInt(val) || 0;
    const newBarrages = barrages.map(b => {
      if (b.id === barrageId) {
        const rawScores = b.scores[shooterId];
        const normalizedScores = Array.isArray(rawScores) ? [...rawScores] : (typeof rawScores === 'number' ? [rawScores] : [0]);
        
        // Ensure array is long enough for the index
        while (normalizedScores.length <= sIdx) normalizedScores.push(0);
        
        normalizedScores[sIdx] = numVal;
        return { ...b, scores: { ...b.scores, [shooterId]: normalizedScores } };
      }
      return b;
    });
    onUpdateBarrages(newBarrages);
  };

  const removeBarrage = (id: string) => {
    onUpdateBarrages(barrages.filter(b => b.id !== id));
    toast.warning('Barrage rimosso');
  };

  return (
    <div className="p-8 space-y-8 bg-brand-bg h-full overflow-y-auto high-density-scroll">
      <div className="flex justify-between items-center bg-card-bg p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Target className="text-amber-500" size={20} /> Management Barrages
          </h2>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 italic">Gestione mini-gare e finali post-competizione</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-amber-600 text-white px-6 py-2.5 rounded-lg hover:bg-amber-500 transition font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-900/20"
        >
          <Plus size={14} /> Crea Nuovo Barrage
        </button>
      </div>

      {isAdding && (
        <div className="bg-card-bg p-8 rounded-2xl border border-amber-500/30 shadow-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
              Configurazione Barrage
            </h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white transition">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome Barrage</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-200"
                  placeholder="Esempio: Finale Assoluta"
                  value={barrageName}
                  onChange={e => setBarrageName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modalità</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBarrageType('elimination')}
                    className={`px-3 py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition ${barrageType === 'elimination' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    Eliminazione
                  </button>
                  <button
                    onClick={() => setBarrageType('series')}
                    className={`px-3 py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition ${barrageType === 'series' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    Serie/Gara
                  </button>
                </div>
              </div>

              {barrageType === 'series' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Num. Serie</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                      value={bSeriesCount}
                      onChange={e => setBSeriesCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Bersagli/Serie</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                      value={bTargetsPerSeries}
                      onChange={e => setBTargetsPerSeries(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic block">Filtro Risultati</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Primi "n" per categoria</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-500 font-mono font-bold"
                      value={nPerCategory}
                      onChange={e => setNPerCategory(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <button
                    onClick={handleAutoSelect}
                    className="mt-4 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:border-amber-500/50 hover:text-white transition font-black text-[9px] uppercase"
                  >
                    Seleziona
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Partecipanti Selezionati ({selectedShooters.length})</label>
              <div className="max-h-64 overflow-y-auto bg-slate-900/80 rounded-xl border border-slate-800 p-2 high-density-scroll">
                {rankedData.map(d => (
                  <label 
                    key={d.shooterId} 
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedShooters.includes(d.shooterId) ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-slate-800'}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                      checked={selectedShooters.includes(d.shooterId)}
                      onChange={e => {
                        if (e.target.checked) setSelectedShooters([...selectedShooters, d.shooterId]);
                        else setSelectedShooters(selectedShooters.filter(id => id !== d.shooterId));
                      }}
                    />
                    <div className="flex-1">
                      <span className="block text-xs font-black uppercase text-slate-200">{d.shooter?.lastName} {d.shooter?.firstName}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase italic">{d.shooter?.category} • {d.total} HIT</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handleCreateBarrage}
              className="px-10 py-3 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-900/40 hover:bg-amber-500 transition-all flex items-center gap-2"
            >
              <Save size={18} /> Inizia il Barrage
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {barrages.map(barrage => {
          const barrageRanked = barrage.participants.map(pid => {
            const sh = shooters.find(s => s.id === pid);
            const rawScores = barrage.scores[pid];
            const pScores = Array.isArray(rawScores) ? rawScores : (typeof rawScores === 'number' ? [rawScores] : [0]);
            const bTotal = pScores.reduce((a, b) => a + (b || 0), 0);
            return { shooter: sh, total: bTotal, scores: pScores, shooterId: pid };
          }).sort((a, b) => b.total - a.total);

          return (
            <div key={barrage.id} className="bg-card-bg rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
              <div className="bg-[#2D3A4F] p-6 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl">
                    <Trophy size={24} className="text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">{barrage.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded text-[8px] font-black uppercase tracking-widest">
                        {barrage.type === 'elimination' ? 'Eliminazione Diretta' : `${barrage.seriesCount}x${barrage.targetsPerSeries} Serie`}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">• {barrage.participants.length} Atleti</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                        const headers = ['Pos.', 'Atleta', 'Hits'];
                        const data = barrageRanked.map((d, i) => [
                          `${i+1}°`,
                          `${d.shooter?.lastName} ${d.shooter?.firstName}`,
                          d.total.toString()
                        ]);
                        exportToPDF(`Barrage: ${barrage.name}`, headers, data, `barrage_${barrage.name.replace(/\s+/g, '_')}.pdf`, settings);
                        toast.success('Report PDF generato');
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-transparent hover:border-sky-500/20"
                  >
                    <FileDown size={16} /> <span className="text-[10px] font-black uppercase">PDF</span>
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBarrage(barrage.id);
                    }}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/20"
                  >
                    <Trash2 size={16} /> <span className="text-[10px] font-black uppercase">Elimina</span>
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Rank</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Atleta</th>
                        {barrage.type === 'series' ? (
                          Array.from({ length: barrage.seriesCount }).map((_, i) => (
                            <th key={i} className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">S{i + 1}</th>
                          ))
                        ) : (
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">In Successione</th>
                        )}
                        <th className="px-6 py-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Totale Hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barrageRanked.map((data, idx) => (
                        <tr key={data.shooterId} className="border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
                          <td className="px-6 py-4">
                            <span className={`text-xs font-black p-1 rounded ${idx === 0 ? 'text-amber-500' : 'text-slate-500'}`}>{idx + 1}°</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-200 uppercase">{data.shooter?.lastName} {data.shooter?.firstName}</span>
                              <span className="text-[9px] text-slate-500 font-bold uppercase">{data.shooter?.category}</span>
                            </div>
                          </td>
                          {data.scores.map((s, sIdx) => (
                            <td key={sIdx} className="px-4 py-4 text-center">
                              <input
                                type="number"
                                min={0}
                                max={barrage.type === 'series' ? barrage.targetsPerSeries : 99}
                                className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all group-hover:border-amber-500/40"
                                value={s || ''}
                                onChange={e => handleScoreChange(barrage.id, data.shooterId, sIdx, e.target.value)}
                              />
                            </td>
                          ))}
                          <td className="px-6 py-4 text-right">
                            <span className="text-lg font-black text-amber-500 font-mono italic">{data.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 bg-slate-900/30 border-t border-slate-800 border-dashed flex justify-center items-center gap-8">
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-emerald-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risultati Salvati</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-amber-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classifica Aggiornata Real-Time</span>
                </div>
              </div>
            </div>
          );
        })}

        {barrages.length === 0 && !isAdding && (
          <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer group" onClick={() => setIsAdding(true)}>
             <Target className="text-slate-700 group-hover:text-amber-500 transition-colors mb-4" size={48} />
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] group-hover:text-slate-400 transition-colors">Nessun barrage configurato</p>
             <p className="text-[9px] text-slate-700 uppercase mt-2 font-bold italic tracking-wider">Le finali possono essere create in qualsiasi momento della gara</p>
          </div>
        )}
      </div>
    </div>
  );
}
