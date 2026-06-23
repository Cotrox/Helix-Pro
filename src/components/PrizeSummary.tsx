import { RefreshCcw, Landmark, Download, Star, FileDown, Info, User, Trash2, Edit2, X, Check, AlertCircle, Award, Search, Filter } from 'lucide-react';
import { Shooter, Registration, Score, CompetitionSettings, Tournament, CATEGORIES, ShooterCategory } from '../types';
import { useMemo, useState, useEffect } from 'react';
import { downloadFile } from '../services/storageService';
import { exportFullReportToPDF } from '../services/pdfService';
import { toast } from 'sonner';
import { calculatePrizeAssignments, AssignedWinner } from '../utils/prizeUtils';

interface Props {
  shooters: Shooter[];
  registrations: Registration[];
  scores: Score[];
  settings: CompetitionSettings;
  tournaments: Tournament[];
  manualPrizes?: { prizeId: string; winners: string[] }[];
  reintegroOverrides?: Record<string, boolean>;
  onUpdateManualPrizes?: (manualPrizes: { prizeId: string; winners: string[] }[]) => void;
  onUpdateReintegroOverrides?: (overrides: Record<string, boolean>) => void;
}

export default function PrizeSummary({ 
  shooters, 
  registrations, 
  scores, 
  settings, 
  tournaments, 
  manualPrizes = [],
  reintegroOverrides = {},
  onUpdateManualPrizes,
  onUpdateReintegroOverrides
}: Props) {
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingManualPrizes, setEditingManualPrizes] = useState<{ prizeId: string; winners: string[] }[]>(manualPrizes || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ShooterCategory[]>([]);

  useEffect(() => {
    setEditingManualPrizes(manualPrizes || []);
  }, [manualPrizes]);

  const assignedWinners = useMemo(() => {
    return calculatePrizeAssignments(shooters, registrations, scores, settings, tournaments, reintegroOverrides);
  }, [settings, registrations, scores, tournaments, shooters, reintegroOverrides]);

  const currentTournament = tournaments.find(t => t.id === settings.tournamentId);
  const prizes = (currentTournament?.advancedPrizes && currentTournament.active)
    ? currentTournament.advancedPrizes.filter(p => p.enabled)
    : (settings.prizes || []).map((p, idx) => ({ ...p, label: p.label || `Premio ${idx + 1}` }));

  // Manual prizes logic
  const isManualMode = manualPrizes && manualPrizes.length > 0;
  
  const manualAssignedWinners: AssignedWinner[] = useMemo(() => {
    if (!isManualMode) return [];
    
    const results: AssignedWinner[] = [];
    manualPrizes.forEach(mp => {
      const prize = prizes.find(p => p.id === mp.prizeId);
      if (!prize) return;
      
      const winnersCount = mp.winners.length;
      if (winnersCount === 0) return;
      
      const prizeTotalValue = prize.value;
      const valuePerShooter = prizeTotalValue / winnersCount;
      
      mp.winners.forEach(shooterId => {
        const shooter = shooters.find(s => s.id === shooterId);
        if (!shooter) return;
        
        const reg = registrations.find(r => r.shooterId === shooterId);
        const score = scores.find(sc => sc.shooterId === shooterId);
        const seriesTotal = score?.seriesScores.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
        const total = score ? (score.manualTotal !== null ? score.manualTotal : seriesTotal) : 0;
        
        // Reintegro logic for manual prizes
        const totalPossibleReintegro = reg?.reintegroAmount ?? 0;
        const isReintegroManuallyDisabled = reintegroOverrides[shooterId] === false;

        const reintegroToApply = (!isReintegroManuallyDisabled && totalPossibleReintegro > 0) ? totalPossibleReintegro : 0;

        results.push({
          prize: prize,
          prizeValue: valuePerShooter,
          winner: shooter,
          points: total,
          isShared: winnersCount > 1,
          sharedWith: winnersCount,
          label: `${prize.position}°`,
          reintegro: reintegroToApply,
          final: Math.max(0, valuePerShooter - reintegroToApply)
        });
      });
    });
    
    return results;
  }, [isManualMode, manualPrizes, prizes, shooters, registrations, scores, settings.categoryFees]);

  const displayWinners = isManualMode ? manualAssignedWinners : assignedWinners;

  const shooterTotals = useMemo(() => {
    const totals = new Map<string, { 
      shooter: Shooter; 
      grossTotal: number; 
      reintegroPossible: number;
      wonPrizes: { label: string; value: number }[];
    }>();

    displayWinners.forEach(w => {
      if (!w.winner) return;
      const current = totals.get(w.winner.id) || { 
        shooter: w.winner, 
        grossTotal: 0, 
        reintegroPossible: registrations.find(r => r.shooterId === w.winner!.id)?.reintegroAmount || 0,
        wonPrizes: []
      };
      
      const catStr = w.prize.category as string;
      const isCategoryPrize = catStr !== 'Assoluto' && catStr !== 'Generale';
      const displayLabel = isCategoryPrize 
        ? `Premio ${w.label} ${w.prize.category}` 
        : ((w.prize as any).type || (w.prize as any).label);

      current.grossTotal += w.prizeValue;
      current.wonPrizes.push({ label: displayLabel, value: w.prizeValue });
      totals.set(w.winner.id, current);
    });

    return Array.from(totals.values()).map(item => {
      const isReintegroManuallyDisabled = reintegroOverrides[item.shooter.id] === false;
      const reintegroToApply = (!isReintegroManuallyDisabled && item.reintegroPossible > 0) ? item.reintegroPossible : 0;
      return {
        ...item,
        reintegroApplied: reintegroToApply,
        finalNet: Math.max(0, item.grossTotal - reintegroToApply)
      };
    }).sort((a, b) => b.finalNet - a.finalNet);
  }, [displayWinners, registrations, reintegroOverrides]);

  const filteredRegistrations = useMemo(() => {
    let result = [...(registrations || [])].filter(Boolean);
    if (searchQuery) {
      result = result.filter(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        if (!shooter) return false;
        return `${shooter.lastName} ${shooter.firstName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    }
    if (selectedCategories.length > 0) {
      result = result.filter(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        return shooter && selectedCategories.includes(shooter.category);
      });
    }
    return result;
  }, [registrations, shooters, searchQuery, selectedCategories]);

  const filteredDisplayWinners = useMemo(() => {
    let result = [...displayWinners];
    if (searchQuery) {
      result = result.filter(w => {
        if (!w.winner) return false;
        return `${w.winner.lastName} ${w.winner.firstName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    }
    if (selectedCategories.length > 0) {
      result = result.filter(w => {
        return w.winner && selectedCategories.includes(w.winner.category);
      });
    }
    return result;
  }, [displayWinners, searchQuery, selectedCategories]);

  const filteredShooterTotals = useMemo(() => {
    let result = [...shooterTotals];
    if (searchQuery) {
      result = result.filter(item => {
        return `${item.shooter.lastName} ${item.shooter.firstName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    }
    if (selectedCategories.length > 0) {
      result = result.filter(item => {
        return selectedCategories.includes(item.shooter.category);
      });
    }
    return result;
  }, [shooterTotals, searchQuery, selectedCategories]);

  const totalPayout = shooterTotals.reduce((acc, w) => acc + w.finalNet, 0);
  const totalReintegroSum = shooterTotals.reduce((acc, w) => acc + w.reintegroApplied, 0);

  const exportPrizes = () => {
    try {
      const exportData = {
        dettaglio_premi: displayWinners.map(w => {
          const catStr = w.prize.category as string;
          const isCategoryPrize = catStr !== 'Assoluto' && catStr !== 'Generale';
          const displayLabel = isCategoryPrize 
            ? `Premio ${w.label} ${w.prize.category}` 
            : ((w.prize as any).type || (w.prize as any).label);

          return {
            tipo: displayLabel,
            categoria: w.prize.category,
            posizione: w.label,
            punti: w.points ?? 0,
            valore_premio: w.prizeValue,
            vincitore: w.winner ? {
              cognome: w.winner.lastName,
              nome: w.winner.firstName,
              categoria: w.winner.category
            } : null
          };
        }),
        totali_tiratori: shooterTotals.map(item => ({
          tiratore: `${item.shooter.lastName} ${item.shooter.firstName}`,
          categoria: item.shooter.category,
          totale_lordo: item.grossTotal,
          reintegro_applicato: item.reintegroApplied,
          totale_netto: item.finalNet
        })),
        metodo: isManualMode ? 'manuale' : 'automatico',
        data_generazione: new Date().toISOString()
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      downloadFile(dataStr, `premi_${settings.name.replace(/\s+/g, '_')}.json`, 'application/json');
      toast.success('Dati premi esportati correttamente (.json)');
    } catch (error) {
      toast.error('Errore durante l\'esportazione');
    }
  };

  const handleRecalculate = () => {
    const hasManual = manualPrizes.length > 0;
    const hasOverrides = Object.keys(reintegroOverrides).length > 0;

    if (hasManual || hasOverrides) {
      if (onUpdateManualPrizes) onUpdateManualPrizes([]);
      if (onUpdateReintegroOverrides) onUpdateReintegroOverrides({});
      setEditingManualPrizes([]);
      toast.success('Premi ricalcolati e resettati in base alla classifica ufficiale');
    } else {
      toast.info('Assegnazione già allineata alla classifica attuale');
    }
  };

  const handleExportPDF = () => {
    const detailHeaders = ['Tipo', 'Categoria/Label', 'Vincitore', 'Punti', 'Valore Premio'];
    const detailData = displayWinners.map(w => {
      const catStr = w.prize.category as string;
      const isCategoryPrize = catStr !== 'Assoluto' && catStr !== 'Generale';
      const displayLabel = isCategoryPrize 
        ? `Premio ${w.label} ${w.prize.category}` 
        : ((w.prize as any).type || (w.prize as any).label);

      return [
        displayLabel,
        `${w.prize.category} - ${w.label}`,
        w.winner ? `${w.winner.lastName} ${w.winner.firstName}` : 'Posto Vacante',
        w.points ? w.points.toString() : '0',
        `€${w.prizeValue.toFixed(2)}`
      ];
    });

    const totalHeaders = ['Tiratore', 'Categoria', 'Dettaglio Premi', 'Totale Lordo', 'Reintegro', 'Netto Final'];
    const totalData = shooterTotals.map(item => [
      `${item.shooter.lastName} ${item.shooter.firstName}`,
      item.shooter.category,
      item.wonPrizes.map(p => `${p.label} (€${p.value.toFixed(2)})`).join('\n'),
      `€${item.grossTotal.toFixed(2)}`,
      item.reintegroApplied > 0 ? `-€${item.reintegroApplied.toFixed(2)}` : '€0.00',
      `€${item.finalNet.toFixed(2)}`
    ]);
    
    exportFullReportToPDF(
      'Riepilogo Premi e Totali',
      [
        { title: 'Dettaglio Ripartizione Premi', headers: detailHeaders, data: detailData },
        { title: 'Riepilogo Totale per Tiratore', headers: totalHeaders, data: totalData }
      ],
      `premi_${settings.name.replace(/\s+/g, '_')}.pdf`,
      settings
    );
    
    toast.success('PDF generato correttamente');
  };

  const handleAddShooterToManualPrize = (prizeId: string, shooterId: string) => {
    setEditingManualPrizes(prev => {
      const existing = prev.find(p => p.prizeId === prizeId);
      if (existing) {
        if (existing.winners.includes(shooterId)) return prev;
        return prev.map(p => p.prizeId === prizeId ? { ...p, winners: [...p.winners, shooterId] } : p);
      }
      return [...prev, { prizeId, winners: [shooterId] }];
    });
  };

  const handleRemoveShooterFromManualPrize = (prizeId: string, shooterId: string) => {
    setEditingManualPrizes(prev => 
      prev.map(p => p.prizeId === prizeId ? { ...p, winners: p.winners.filter(id => id !== shooterId) } : p)
    );
  };

  const handleConfirmManualAssignment = () => {
    if (onUpdateManualPrizes) {
      onUpdateManualPrizes(editingManualPrizes.filter(p => p.winners.length > 0));
      setShowManualModal(false);
      toast.success('Assegnazione manuale confermata');
    }
  };

  const handleResetManualMode = () => {
    if (onUpdateManualPrizes) {
      onUpdateManualPrizes([]);
      setEditingManualPrizes([]);
      toast.success('Tornato alla gestione automatizzata');
    }
  };

  const toggleShooterReintegro = (shooterId: string) => {
    if (!onUpdateReintegroOverrides) return;
    const current = reintegroOverrides[shooterId] !== false; // default to true if not present
    onUpdateReintegroOverrides({
      ...reintegroOverrides,
      [shooterId]: !current
    });
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 bg-brand-bg h-full overflow-y-auto high-density-scroll">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl gap-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Landmark className="text-sky-500" size={20} /> Hub Finanziario
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 italic">Ripartizione montepremi e reintegri</p>
        </div>
        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
          {/* Row 1: Ricalcolo & Assegna Premi Manualmente */}
          <div className="flex flex-wrap gap-2 w-full justify-end">
            <button
              onClick={handleRecalculate}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-emerald-600/30 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
              title="Ricalcola e resetta d'ufficio"
            >
              <RefreshCcw size={14} /> Ricalcolo
            </button>
            {!isManualMode ? (
              <button
                onClick={() => {
                  setEditingManualPrizes(manualPrizes || []);
                  setShowManualModal(true);
                }}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-sky-600/20 text-sky-400 border border-sky-500/30 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-sky-600/30 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
              >
                <Award size={14} /> Assegna Premi Manualmente
              </button>
            ) : (
              <div className="flex gap-2 flex-1 sm:flex-none">
                <button
                  onClick={() => {
                    setEditingManualPrizes(manualPrizes || []);
                    setShowManualModal(true);
                  }}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
                >
                  <Edit2 size={14} /> Modifica
                </button>
                <button
                  onClick={handleResetManualMode}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-red-900/20 text-red-500 border border-red-500/30 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-red-900/30 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
                >
                  <Trash2 size={14} /> Elimina Manual
                </button>
              </div>
            )}
          </div>
          {/* Row 2: PDF & JSON */}
          <div className="flex gap-2 w-full justify-end">
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
            >
              <FileDown size={14} /> PDF
            </button>
            <button
              onClick={exportPrizes}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-4 sm:px-6 py-2.5 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl"
              title="Esporta Premi (.json)"
            >
              <Download size={14} /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Legend section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-sky-400 mb-4 flex items-center gap-2">
          <Info size={14} /> Criteri di Assegnazione Premi (Legenda Regolamento)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[9px] sm:text-[10px] leading-relaxed">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Art. 1 – Premi di Programma:</span> Assegnati in base alle eliche colpite. In caso di parità, i premi delle posizioni interessate sono sommati e divisi equamente tra tutti i tiratori a pari merito (senza spareggi in denaro, salvo diversa indicazione).
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Art. 2 – Premi Riservati:</span> Assegnati solo ai tiratori della categoria. In caso di pari merito, l'intero fondo premi destinato alla categoria viene sommato e suddiviso in parti uguali tra gli aventi diritto (es. fondo totale di €170 diviso tra 4 tiratori pari a €42,50 ciascuno).
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Art. 3 – Cumulo dei Premi:</span> I premi di programma e riservati non sono cumulabili, salvo l'integrazione prevista dall'Art. 4. Il tiratore con premio di programma inferiore al 1° premio riservato di categoria ha diritto all'integrazione.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Art. 4 – Integrazione e Scorrimento:</span> Se il premio di programma percepito è inferiore al 1° riservato di categoria, viene integrato fino a tale valore attingendo dal fondo riservato. Il residuo del fondo e i successivi premi scorrono ai tiratori di categoria successivi in classifica (es. caso Master: €88 di integrazione su €90 lascia €2 che si sommano al 2° premio, che diventa di €82). Se pari o superiore, non si ha diritto a integrazioni o premi riservati.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Art. 5 – Premi Riservati Non Assegnati:</span> Se in una categoria non viene raggiunto il numero minimo di partecipanti, il relativo montepremi riservato non viene assegnato e si trasferisce integralmente al montepremi generale della manifestazione.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <p className="text-slate-400 uppercase tracking-tight">
                <span className="text-white font-bold">Gestione Reintegri:</span> Il reintegro (differenza tra quota iscrizione standard e agevolata) viene detratto dal premio netto finale. Viene applicato una sola volta per atleta, prioritariamente sul primo premio vinto.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-500 mb-2 tracking-[0.2em]">Montepremi Lordo</span>
          <span className="text-2xl sm:text-3xl font-black text-white italic font-mono tracking-tighter">€{settings.totalPrizePool.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-500 mb-2 tracking-[0.2em]">Netto Erogato Atleti</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 italic font-mono tracking-tighter">€{totalPayout.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-sky-600/90 p-6 sm:p-8 rounded-2xl shadow-2xl shadow-sky-900/30 flex flex-col items-center justify-center text-center text-white relative overflow-hidden">
          <RefreshCcw className="mb-2 opacity-50 absolute -right-4 -top-4" size={64} />
          <span className="text-[9px] sm:text-[10px] uppercase font-black opacity-70 tracking-[0.2em] relative z-10 transition-colors">Reintegro Totale Società</span>
          <span className="text-2xl sm:text-3xl font-black italic font-mono tracking-tighter relative z-10">€{totalReintegroSum.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Cerca per nome o cognome..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:border-sky-500/50 outline-none transition"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsFilterModalOpen(true)}
          className={`px-5 rounded-xl border flex items-center gap-2 transition-all ${
            selectedCategories.length > 0
              ? 'bg-sky-500 border-sky-400 text-white shadow-lg'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <Filter size={18} />
          <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Filtra</span>
        </button>
      </div>

      <div className="bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-x-auto no-scrollbar">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center min-w-[700px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Dettaglio Iscrizioni e Quote</h3>
          <span className="text-[10px] font-mono text-slate-500 uppercase">Totale Registrazioni: {filteredRegistrations.length}</span>
        </div>
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-[#2D3A4F]">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-6 py-4 border-b border-slate-700">Tiratore</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Standard</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Riservato/Agevolato</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Sconto Extra</th>
              <th className="px-6 py-4 border-b border-slate-700 text-right text-emerald-400">Totale Pagato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredRegistrations.sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0)).map(reg => {
              const shooter = shooters.find(s => s.id === reg.shooterId);
              const extraDiscountAmount = reg.extraDiscount 
                ? (reg.extraDiscount.type === 'fixed' ? reg.extraDiscount.value : (settings.baseEntryFee * reg.extraDiscount.value / 100))
                : 0;
              
              return (
                <tr key={reg.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4 border-none">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-200 uppercase tracking-tight text-xs">{shooter?.lastName} {shooter?.firstName}</span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic">{shooter?.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-none text-center font-mono text-xs text-slate-500">
                    €{settings.baseEntryFee.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 border-none text-center font-mono text-xs text-amber-500/70">
                    {reg.actualFee + extraDiscountAmount < settings.baseEntryFee 
                      ? `-€${(settings.baseEntryFee - (reg.actualFee + extraDiscountAmount)).toFixed(2)}` 
                      : '-'}
                  </td>
                  <td className="px-6 py-4 border-none text-center font-mono text-xs text-sky-500/70">
                    {extraDiscountAmount > 0 ? `-€${extraDiscountAmount.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 border-none text-right font-mono font-black text-emerald-400">
                    €{reg.actualFee.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[#1E293B] border-t border-slate-700">
            <tr className="font-black uppercase italic text-[10px]">
              <td colSpan={4} className="px-6 py-4 text-slate-500 text-right tracking-[0.2em]">Totale Incassato Iscrizioni:</td>
              <td className="px-6 py-4 text-emerald-400 text-right text-lg font-mono">
                €{registrations.reduce((acc, r) => acc + (r.paid ? r.actualFee : 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-x-auto no-scrollbar relative">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center min-w-[800px]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-sky-400">Dettaglio Ripartizione Premi</h3>
              {isManualMode && (
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-[0.2em] rounded">
                  Gestione Manuale Attiva
                </span>
              )}
            </div>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic">
              {isManualMode ? "Assegnazione definita manualmente dal direttore di tiro." : "N.B. Il reintegro premio compensa l'agevolazione di categoria."}
            </p>
          </div>
        </div>
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-[#2D3A4F]">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-6 py-4 border-b border-slate-700">Premio / Posizione</th>
              <th className="px-6 py-4 border-b border-slate-700">Vincitore Assegnato</th>
              <th className="px-6 py-4 border-b border-slate-700 text-right">Valore Premio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredDisplayWinners.map((w, idx) => (
              <tr key={idx} className="hover:bg-slate-800/20 transition-colors group">
                <td className="px-6 py-4 border-none">
                   <div className="flex flex-col">
                    <span className="font-black text-slate-200 uppercase tracking-tight text-xs group-hover:text-white transition-colors">
                      { (w.prize.category as string) !== 'Assoluto' && (w.prize.category as string) !== 'Generale' 
                        ? `Premio ${w.label} ${w.prize.category}` 
                        : ((w.prize as any).type || (w.prize as any).label)}
                    </span>
                    <span className="text-[8px] text-sky-500 font-bold uppercase tracking-widest">
                      {w.prize.category} • {w.label} Pos.
                      {w.isShared && <span className="ml-2 text-amber-500 italic">(Diviso tra {w.sharedWith})</span>}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 border-none">
                  {w.winner ? (
                    <div className="flex flex-col">
                      <span className="font-black text-slate-300 uppercase text-[13px] tracking-tight">{w.winner.lastName} {w.winner.firstName}</span>
                      <span className="text-[9px] flex items-center gap-1 font-bold text-slate-500 uppercase italic">
                        <span className="text-emerald-500">{w.winner.category}</span> • <Star size={10} className="text-amber-500" /> 
                        {settings.rankingMode === 'manual' 
                          ? (registrations.find(r => r.shooterId === w.winner.id)?.manualRank ? `POS: ${registrations.find(r => r.shooterId === w.winner.id)?.manualRank}°` : 'N/A')
                          : `${w.points} HIT TOTALI`
                        }
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600 italic text-[10px] font-bold uppercase tracking-widest">Posto vacante</span>
                  )}
                </td>
                <td className="px-6 py-4 border-none text-right">
                  <span className="text-xl font-black text-sky-400 font-mono tracking-tighter">€{w.prizeValue.toFixed(2)}</span>
                </td>
              </tr>
            ))}
            {filteredDisplayWinners.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.2em] italic">
                      Nessun premio configurato o assegnato per questa sessione.
                   </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW SECTION: Shooter Totals and Final Payouts */}
      <div className="bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-x-auto no-scrollbar relative mb-12">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center min-w-[700px]">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Riepilogo Totale per Tiratore</h3>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic">
              Totale dei premi accumulati e applicazione del reintegro (una sola volta).
            </p>
          </div>
        </div>
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-[#1E293B]">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-6 py-4 border-b border-slate-700">Tiratore</th>
              <th className="px-6 py-4 border-b border-slate-700">Dettaglio Premi</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Totale Lordo Premi</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Reintegro</th>
              <th className="px-6 py-4 border-b border-slate-700 text-right">Netto da Erogare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredShooterTotals.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 border-none">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-200 uppercase tracking-tight text-xs">{item.shooter.lastName} {item.shooter.firstName}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{item.shooter.category}</span>
                  </div>
                </td>
                <td className="px-6 py-4 border-none">
                   <div className="flex flex-col gap-1">
                    {item.wonPrizes.map((p, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-between gap-4 text-[9px] font-bold">
                        <span className="text-slate-400 uppercase truncate max-w-[150px]">{p.label}</span>
                        <span className="text-sky-500 font-mono">€{p.value.toFixed(2)}</span>
                      </div>
                    ))}
                   </div>
                </td>
                <td className="px-6 py-4 border-none text-center font-mono text-xs text-slate-400 font-bold">
                  €{item.grossTotal.toFixed(2)}
                </td>
                <td className="px-6 py-4 border-none text-center">
                  {item.reintegroPossible > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-mono text-xs font-bold ${item.reintegroApplied > 0 ? 'text-amber-500' : 'text-slate-600'}`}>
                        {item.reintegroApplied > 0 ? `-€${item.reintegroApplied.toFixed(2)}` : '€ 0.00'}
                      </span>
                      <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                        <button
                          onClick={() => toggleShooterReintegro(item.shooter.id)}
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all ${
                            reintegroOverrides[item.shooter.id] !== false
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          SÌ
                        </button>
                        <button
                          onClick={() => toggleShooterReintegro(item.shooter.id)}
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all ${
                            reintegroOverrides[item.shooter.id] === false
                              ? 'bg-red-600 text-white shadow-lg'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          NO
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-xs font-bold text-slate-800 italic">
                      Non applicabile
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 border-none text-right">
                  <span className="text-xl font-black text-emerald-400 font-mono tracking-tighter">€{item.finalNet.toFixed(2)}</span>
                </td>
              </tr>
            ))}
            {filteredShooterTotals.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.2em] italic">
                   Nessun tiratore a premio.
                </td>
              </tr>
            )}
          </tbody>
          {filteredShooterTotals.length > 0 && (
            <tfoot className="bg-[#1E293B] border-t border-slate-700">
              <tr className="font-black uppercase italic text-[10px]">
                <td colSpan={4} className="px-6 py-4 text-slate-500 text-right tracking-[0.2em]">Totale Erogato agli Atleti (Netto):</td>
                <td className="px-6 py-4 text-emerald-400 text-right text-lg font-mono">
                  €{totalPayout.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Manual Assignment Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                   <Landmark className="text-sky-500" size={24} /> Assegnazione Manuale Premi
                </h3>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest italic">Personalizza i vincitori per ogni premio</p>
              </div>
              <button 
                onClick={() => setShowManualModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-4">
              <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <p className="text-xs text-amber-200/80 leading-relaxed font-bold uppercase tracking-tight">
                Attenzione: configurando i premi manualmente, il sistema disattiverà il calcolo automatico della classifica premi. 
                I premi assegnati qui appariranno in una tabella dedicata nel Report PDF Integrale, indicando l'intervento manuale.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 high-density-scroll bg-brand-bg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prizes.map((prize) => {
                  const manualAssign = editingManualPrizes.find(p => p.prizeId === prize.id);
                  const winnersCount = manualAssign?.winners?.length || 0;
                  const valueEach = winnersCount > 0 ? prize.value / winnersCount : prize.value;

                  return (
                    <div key={prize.id} className="bg-card-bg border border-slate-800 rounded-2xl p-5 shadow-lg group hover:border-sky-500/30 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-black text-slate-200 uppercase tracking-tight text-sm">
                            { (prize.category as string) !== 'Assoluto' && (prize.category as string) !== 'Generale'
                              ? `Premio ${prize.position}° ${prize.category}`
                              : prize.label}
                          </h4>
                          <p className="text-[10px] text-sky-500 font-bold uppercase tracking-widest">{prize.category} • {prize.position}° Pos.</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter">€{prize.value.toFixed(2)}</p>
                          {winnersCount > 1 && (
                            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">€{valueEach.toFixed(2)} / atleta</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        {manualAssign?.winners.map((shooterId) => {
                          const shooter = shooters.find(s => s.id === shooterId);
                          return (
                            <div key={shooterId} className="flex items-center justify-between bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 group/item">
                              <div className="flex items-center gap-3">
                                <User size={14} className="text-slate-500" />
                                <span className="text-[11px] font-black text-slate-300 uppercase truncate max-w-[120px]">
                                  {shooter?.lastName} {shooter?.firstName}
                                </span>
                              </div>
                              <button 
                                onClick={() => handleRemoveShooterFromManualPrize(prize.id, shooterId)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {winnersCount === 0 && (
                          <div className="py-4 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                             <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest italic">Nessun vincitore assegnato</p>
                          </div>
                        )}
                      </div>

                      <select 
                        className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddShooterToManualPrize(prize.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        value=""
                      >
                        <option value="">+ Aggiungi Tiratore a Premio</option>
                        {shooters
                          .filter(s => registrations.some(r => r.shooterId === s.id))
                          .sort((a,b) => a.lastName.localeCompare(b.lastName))
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.lastName} {s.firstName} ({s.category})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-4">
              <button 
                onClick={() => setShowManualModal(false)}
                className="flex-1 bg-slate-800 text-slate-400 border border-slate-700 px-6 py-4 rounded-2xl hover:bg-slate-700 hover:text-white transition font-black text-[10px] uppercase tracking-widest"
              >
                Annulla
              </button>
              <button 
                onClick={handleConfirmManualAssignment}
                className="flex-[2] bg-emerald-600 text-white px-6 py-4 rounded-2xl hover:bg-emerald-500 transition font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"
              >
                <Check size={18} /> Conferma Inserimento Manuale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Filter className="text-sky-500" size={18} /> Filtra Categorie
              </h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] high-density-scroll bg-brand-bg">
              {/* Categories */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categorie</label>
                  <button 
                    onClick={() => setSelectedCategories([])}
                    className="text-[9px] text-sky-500 font-bold uppercase hover:underline"
                  >
                    Resetta
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <label key={cat} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                      selectedCategories.includes(cat) ? 'bg-sky-500/10 border-sky-500/50 text-sky-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}>
                      <input 
                        type="checkbox"
                        className="hidden"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => {
                          setSelectedCategories(prev => 
                            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                          );
                        }}
                      />
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                        selectedCategories.includes(cat) ? 'bg-sky-500 border-sky-400 bg-sky-500' : 'border-slate-700'
                      }`}>
                        {selectedCategories.includes(cat) && <Check size={10} className="text-white font-bold" />}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-tight">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
              <button 
                onClick={() => setIsFilterModalOpen(false)}
                className="w-full py-3 bg-sky-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-500 transition"
              >
                Applica Filtri
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

