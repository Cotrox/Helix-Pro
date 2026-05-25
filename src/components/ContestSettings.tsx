import { useState, useEffect, useMemo } from 'react';
import { Trophy, Landmark, History, Plus, Trash2, Save, Users } from 'lucide-react';
import { CompetitionSettings, CATEGORIES, TournamentPrize, Tournament, ShooterCategory } from '../types';
import { toast } from 'sonner';

interface Props {
  settings: CompetitionSettings;
  tournaments: Tournament[];
  onUpdate: (settings: CompetitionSettings) => void;
  onDelete?: () => void;
}

export default function ContestSettings({ settings, tournaments, onUpdate, onDelete }: Props) {
  const [localSettings, setLocalSettings] = useState<CompetitionSettings>({
    ...settings,
    managedType: settings.managedType || 'proprietaria',
    seriesTargets: settings.seriesTargets || Array(settings.seriesCount).fill(settings.targetsPerSeries || 5),
    prizes: settings.prizes || [],
    tournamentId: settings.tournamentId || undefined,
    isOneShot: settings.isOneShot ?? true,
    categoryFees: settings.categoryFees || {} as Record<ShooterCategory, { standard?: number, reserved?: number }>
  });

  // Calculate total prize pool from prizes array
  const calculatedPrizePool = useMemo(() => {
    return (localSettings.prizes || []).reduce((sum, p) => sum + (p.value || 0), 0);
  }, [localSettings.prizes]);

  // Keep totalPrizePool in sync with prizes
  useEffect(() => {
    if (localSettings.totalPrizePool !== calculatedPrizePool) {
      setLocalSettings(prev => ({ ...prev, totalPrizePool: calculatedPrizePool }));
    }
  }, [calculatedPrizePool]);

  // Sync localSettings if settings prop changes (e.g. after save)
  useEffect(() => {
    setLocalSettings({
      ...settings,
      managedType: settings.managedType || 'proprietaria',
      seriesTargets: settings.seriesTargets || Array(settings.seriesCount).fill(settings.targetsPerSeries || 5),
      prizes: settings.prizes || [],
      tournamentId: settings.tournamentId || undefined,
      isOneShot: settings.isOneShot ?? true,
      categoryFees: settings.categoryFees || {} as Record<ShooterCategory, { standard?: number, reserved?: number }>
    });
  }, [settings]);

  const toggleReserved = (catString: string) => {
    const cat = catString as ShooterCategory;
    setLocalSettings(prev => {
        const fees = { ...(prev.categoryFees || {}) };
        const catData = { ...(fees[cat] || {}) };
        
        if (catData.reserved !== undefined) {
            delete catData.reserved;
        } else {
            catData.reserved = Math.max(0, prev.baseEntryFee - 5);
        }
        
        return { 
            ...prev, 
            categoryFees: {
                ...fees,
                [cat]: catData
            } 
        };
    });
  };

  const updateReserved = (catString: string, val: number) => {
    const cat = catString as ShooterCategory;
    setLocalSettings(prev => ({
        ...prev,
        categoryFees: {
            ...prev.categoryFees,
            [cat]: { ...(prev.categoryFees[cat] || {}), reserved: val }
        }
    }));
  };

  const handlePrizeAdd = () => {
    const newPrize: TournamentPrize = {
      id: crypto.randomUUID(),
      label: 'Nuovo Premio',
      category: 'Generale' as any,
      position: 1,
      value: 0,
      enabled: true
    };
    setLocalSettings(prev => ({ ...prev, prizes: [...(prev.prizes || []), newPrize] }));
    toast.info('Nuovo premio aggiunto');
  };

  const handlePrizeRemove = (id: string) => {
    setLocalSettings(prev => ({ ...prev, prizes: (prev.prizes || []).filter(p => p.id !== id) }));
  };

  const handleApply = () => {
    // Synchronize redundant date fields
    const updatedSettings = {
      ...localSettings,
      date: localSettings.startDate ? new Date(localSettings.startDate).toLocaleDateString('it-IT') : localSettings.date,
      eventDate: localSettings.startDate || localSettings.eventDate
    };
    onUpdate(updatedSettings);
    toast.success('Impostazioni aggiornate');
  };

  return (
    <div className="h-full overflow-y-auto high-density-scroll p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleApply}
            className="flex-1 py-4 bg-sky-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-sky-500 transition-all active:scale-[0.98]"
          >
            <Save size={20} /> Applica Modifiche
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-8 py-4 bg-red-950/20 text-red-500 border border-red-900/50 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-900/40 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Trash2 size={20} /> Elimina Gara
            </button>
          )}
        </div>

        <section className="bg-card-bg p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-sky-400 flex items-center gap-2 border-b border-slate-800 pb-4">
                <History className="text-sky-500" size={16} /> Configurazione Parametri
            </h3>
            <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nome Competizione</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200"
                            value={localSettings.name}
                            onChange={e => setLocalSettings({...localSettings, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Metodo Classifica</label>
                        <select
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200 text-xs font-bold uppercase"
                            value={localSettings.rankingMode || 'hits'}
                            onChange={e => setLocalSettings({...localSettings, rankingMode: e.target.value as any})}
                        >
                            <option value="hits">Punteggio (Eliche Colpite)</option>
                            <option value="manual">Manuale (Solo Posizione)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tipologia Gara</label>
                        <select
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200 text-xs font-bold uppercase"
                            value={localSettings.managedType}
                            onChange={e => setLocalSettings({...localSettings, managedType: e.target.value as any})}
                        >
                            <option value="proprietaria">Proprietaria</option>
                            <option value="delegata">Delegata (Esterna)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Torneo Associato</label>
                        <select
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-200 text-xs font-bold uppercase"
                            value={localSettings.tournamentId || ''}
                            onChange={e => {
                                const tId = e.target.value || undefined;
                                setLocalSettings({
                                    ...localSettings, 
                                    tournamentId: tId,
                                    isOneShot: tId ? false : localSettings.isOneShot
                                });
                            }}
                        >
                            <option value="">Nessuno</option>
                            {tournaments.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Data Inizio</label>
                        <input
                            type="date"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200"
                            value={localSettings.startDate || ''}
                            onChange={e => setLocalSettings({...localSettings, startDate: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Orario Inizio</label>
                        <input
                            type="time"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200"
                            value={localSettings.startTime || ''}
                            onChange={e => setLocalSettings({...localSettings, startTime: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Località / Campo</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-200"
                            value={localSettings.location || ''}
                            onChange={e => setLocalSettings({...localSettings, location: e.target.value})}
                            placeholder="Esempio: Campo di Tiro 'Le Querce'..."
                        />
                    </div>
                </div>
                <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Configurazione Serie</label>
                    <div className="flex flex-wrap gap-4 items-center bg-slate-900/30 p-4 rounded-xl border border-slate-800">
                        <div className="space-y-1.5 shrink-0">
                            <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block px-1">Num. Serie</label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                className="w-20 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono font-bold text-sky-400 focus:ring-2 focus:ring-sky-500 outline-none"
                                value={localSettings.seriesCount}
                                onChange={e => {
                                    const series = Math.max(1, parseInt(e.target.value) || 1);
                                    const newSeriesTargets = [...localSettings.seriesTargets];
                                    if (series > localSettings.seriesCount) {
                                        for (let i = localSettings.seriesCount; i < series; i++) {
                                            newSeriesTargets.push(localSettings.targetsPerSeries || 5);
                                        }
                                    } else {
                                        newSeriesTargets.splice(series);
                                    }
                                    const newTotalTargets = newSeriesTargets.reduce((a, b) => a + b, 0);
                                    setLocalSettings({
                                        ...localSettings, 
                                        seriesCount: series, 
                                        seriesTargets: newSeriesTargets,
                                        totalTargets: newTotalTargets,
                                        fieldServiceCost: (localSettings.targetUnitCost || 0) * newTotalTargets
                                    });
                                }}
                            />
                        </div>
                        <div className="space-y-1.5 shrink-0">
                            <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block px-1">Totale Bersagli</label>
                            <div className="w-20 px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-center font-mono font-bold text-emerald-400">
                                {localSettings.totalTargets || 0}
                            </div>
                        </div>
                        <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
                            {localSettings.seriesTargets.map((targets, idx) => (
                                <div key={idx} className="space-y-1.5 shrink-0">
                                    <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block text-center">S{idx + 1}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        className="w-12 px-1 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-center font-mono font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={targets}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 0;
                                            const newTargets = [...localSettings.seriesTargets];
                                            newTargets[idx] = val;
                                            const newTotalTargets = newTargets.reduce((a, b) => a + b, 0);
                                            setLocalSettings({
                                                ...localSettings, 
                                                seriesTargets: newTargets,
                                                totalTargets: newTotalTargets,
                                                fieldServiceCost: (localSettings.targetUnitCost || 0) * newTotalTargets
                                            });
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-card-bg p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-4">
                    <Landmark className="text-emerald-500" size={16} /> Aspetti Economici
                </h3>
                <div className="flex flex-col gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Iscrizione Base (€)</label>
                        <input
                            type="number"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 font-mono"
                            value={localSettings.baseEntryFee}
                            onChange={e => setLocalSettings({...localSettings, baseEntryFee: parseFloat(e.target.value) || 0})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Costo Marca Elica (€)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 font-mono"
                            value={localSettings.targetUnitCost || 0}
                            onChange={e => {
                                const cost = parseFloat(e.target.value) || 0;
                                setLocalSettings({
                                    ...localSettings, 
                                    targetUnitCost: cost,
                                    fieldServiceCost: cost * (localSettings.totalTargets || 0)
                                });
                            }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">Montepremi Lordo (€)</label>
                        <input
                            type="number"
                            readOnly
                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-amber-900/30 rounded-lg text-amber-500 font-mono font-bold cursor-not-allowed shadow-inner"
                            value={localSettings.totalPrizePool}
                            title="Calcolato automaticamente dalla tabella premi"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">Totale Costo Servizio Campo (€)</label>
                        <div className="w-full px-4 py-2.5 bg-slate-900/50 border border-amber-900/30 rounded-lg text-amber-500 font-mono font-bold flex items-center">
                            {((localSettings.targetUnitCost || 0) * (localSettings.totalTargets || 0)).toFixed(2)}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className={`p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between transition-opacity ${localSettings.tournamentId ? 'opacity-50' : ''}`}>
                            <label className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Gara One-Shot</span>
                                <span className="text-[9px] text-slate-600 uppercase font-bold italic">Se attiva, la gara è considerata evento singolo isolato</span>
                            </label>
                             <button
                                onClick={() => !localSettings.tournamentId && setLocalSettings({...localSettings, isOneShot: !localSettings.isOneShot})}
                                className={`w-12 h-6 rounded-full transition-all relative ${localSettings.isOneShot ? 'bg-sky-500' : 'bg-slate-700'} ${localSettings.tournamentId ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                disabled={!!localSettings.tournamentId}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.isOneShot ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-card-bg p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2 border-b border-slate-800 pb-4">
                    <Users className="text-amber-500" size={16} /> Costi per Categoria
                </h3>
                <div className="space-y-4">
                    {CATEGORIES.map(cat => (
                        <div key={cat} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-900/30 p-3 rounded-xl border border-slate-800 group hover:border-amber-500/30 transition-all">
                            <div className="md:col-span-4">
                                <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{cat}</span>
                            </div>
                            <div className="md:col-span-8">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-bold text-amber-500/70 uppercase tracking-widest px-1">Tariffa Categoria</label>
                                    <div className="flex gap-2">
                                        {localSettings.categoryFees?.[cat]?.reserved !== undefined ? (
                                            <div className="flex-1 flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500/50">€</span>
                                                    <input 
                                                        type="number"
                                                        className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-amber-900/40 rounded text-xs text-amber-400 font-mono outline-none focus:border-amber-500 shadow-inner"
                                                        value={localSettings.categoryFees[cat].reserved}
                                                        onChange={e => updateReserved(cat, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                                
                                                <button 
                                                    onClick={() => toggleReserved(cat)}
                                                    className="p-2 text-slate-500 hover:text-red-500 transition-colors bg-slate-800 rounded border border-slate-700 h-8 self-end"
                                                    title="Rimuovi tariffa specifica"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => toggleReserved(cat)}
                                                className="w-full py-2 border border-dashed border-slate-700 rounded text-slate-500 hover:border-amber-500/50 hover:bg-amber-500/5 hover:text-amber-500 transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                <Plus size={14} className="group-hover/btn:rotate-90 transition-transform" /> 
                                                <span className="text-[9px] font-black uppercase tracking-widest">Imposta Quota Categoria</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>

        <section className="bg-card-bg p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-sky-400 flex items-center gap-2">
                    <Trophy className="text-sky-500" size={16} /> Tabella Premi Programmata
                </h3>
                <button
                    onClick={handlePrizeAdd}
                    className="flex items-center gap-2 bg-slate-800 text-sky-400 px-4 py-2 rounded-lg border border-slate-700 hover:border-sky-500/50 transition-all font-black text-[9px] uppercase tracking-widest"
                >
                    <Plus size={14} /> Nuovo Premio
                </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
                {localSettings.prizes.map((prize, idx) => (
                    <div key={prize.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#1E293B] p-4 rounded-xl border border-slate-800">
                        <div className="md:col-span-3">
                            <select
                                className="w-full text-xs font-black uppercase bg-slate-900 border border-slate-700 rounded px-2 py-2 text-slate-200"
                                value={prize.label}
                                onChange={e => {
                                    const newPrizes = [...localSettings.prizes];
                                    newPrizes[idx].label = e.target.value;
                                    setLocalSettings({...localSettings, prizes: newPrizes});
                                }}
                            >
                                <option value="Programma">Programma</option>
                                <option value="Riservato">Riservato</option>
                                <option value="Barrage">Barrage</option>
                                <option value="Nuovo Premio">Altro</option>
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <select
                                className="w-full text-xs font-black bg-slate-900 border border-slate-700 rounded px-2 py-2 text-slate-200"
                                value={prize.category}
                                onChange={e => {
                                    const newPrizes = [...localSettings.prizes];
                                    newPrizes[idx].category = e.target.value as any;
                                    setLocalSettings({...localSettings, prizes: newPrizes});
                                }}
                            >
                                <option value="Generale">Generale</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <input
                                type="number"
                                className="w-full text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded px-2 py-2 text-slate-400"
                                value={prize.position}
                                onChange={e => {
                                    const newPrizes = [...localSettings.prizes];
                                    newPrizes[idx].position = parseInt(e.target.value) || 1;
                                    setLocalSettings({...localSettings, prizes: newPrizes});
                                }}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <input
                                type="number"
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded font-mono font-black text-emerald-400 text-sm"
                                value={prize.value}
                                onChange={e => {
                                    const newPrizes = [...localSettings.prizes];
                                    newPrizes[idx].value = parseFloat(e.target.value) || 0;
                                    setLocalSettings({...localSettings, prizes: newPrizes});
                                }}
                            />
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                            <button onClick={() => handlePrizeRemove(prize.id)} className="p-2 text-slate-700 hover:text-red-500">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
      </div>
    </div>
  );
}
