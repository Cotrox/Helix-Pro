import { useState } from 'react';
import { Layers, Plus, Trash2, Trophy, Users, FileDown, ShieldCheck, Calculator, Pencil, Download, Upload } from 'lucide-react';
import { Tournament, Session, Shooter, CATEGORIES, TournamentPrize } from '../types';
import { toast } from 'sonner';
import { useRef } from 'react';

interface Props {
  tournaments: Tournament[];
  onUpdateTournaments: (tournaments: Tournament[]) => void;
  sessions: Session[];
  shooters: Shooter[];
}

export default function TournamentView({ tournaments, onUpdateTournaments, sessions, shooters }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialTournament: Omit<Tournament, 'id' | 'createdAt'> = {
    name: '',
    majorityThreshold: 3,
    totalRaces: 4,
    majorityPrizes: [],
    advancedPrizes: [
      { id: crypto.randomUUID(), label: '1° Assoluto', category: 'Assoluto', position: 1, value: 0, enabled: true, info: 'Coppa' }
    ],
    subscriptionDiscount: { type: 'fixed', value: 0 }
  };

  const [newTournament, setNewTournament] = useState<Omit<Tournament, 'id' | 'createdAt'>>(initialTournament);

  const handleCreate = () => {
    if (!newTournament.name) return toast.error('Inserisci un nome per il torneo');
    
    if (editingId) {
      onUpdateTournaments(tournaments.map(t => t.id === editingId ? { ...t, ...newTournament } : t));
      setEditingId(null);
      toast.success('Torneo aggiornato con successo');
    } else {
      const tournament: Tournament = {
        ...newTournament,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      onUpdateTournaments([...tournaments, tournament]);
      toast.success('Torneo creato con successo');
    }
    
    setIsAdding(false);
    setNewTournament(initialTournament);
  };

  const handleEdit = (tournament: Tournament) => {
    setNewTournament({
      name: tournament.name,
      majorityThreshold: tournament.majorityThreshold,
      totalRaces: tournament.totalRaces,
      majorityPrizes: tournament.majorityPrizes || [],
      advancedPrizes: tournament.advancedPrizes || [],
      subscriptionDiscount: tournament.subscriptionDiscount
    });
    setEditingId(tournament.id);
    setIsAdding(true);
  };

  const addPrize = () => {
    const p: TournamentPrize = {
      id: crypto.randomUUID(),
      label: 'Nuovo Premio',
      category: 'Assoluto',
      position: 1,
      value: 0,
      enabled: true
    };
    setNewTournament({
      ...newTournament,
      advancedPrizes: [...(newTournament.advancedPrizes || []), p]
    });
  };

  const removePrize = (id: string) => {
    setNewTournament({
      ...newTournament,
      advancedPrizes: (newTournament.advancedPrizes || []).filter(p => p.id !== id)
    });
  };

  const removeTournament = (id: string) => {
    onUpdateTournaments(tournaments.filter(t => t.id !== id));
    toast.info('Torneo eliminato correttamente');
  };

  const calculateTournamentStats = (tournament: Tournament) => {
    const tournamentSessions = sessions.filter(s => s.settings.tournamentId === tournament.id);
    const shooterStats: Record<string, { hits: number, races: number }> = {};

    tournamentSessions.forEach(session => {
      session.registrations.forEach(reg => {
        const score = session.scores.find(sc => sc.shooterId === reg.shooterId);
        const total = score ? (score.manualTotal !== null ? score.manualTotal : score.seriesScores.reduce((acc: number, val: number | null) => (acc || 0) + (val || 0), 0)) : 0;
        
        if (!shooterStats[reg.shooterId]) {
          shooterStats[reg.shooterId] = { hits: 0, races: 0 };
        }
        shooterStats[reg.shooterId].hits += (total || 0);
        shooterStats[reg.shooterId].races += 1;
      });
    });

    const stats = Object.entries(shooterStats)
      .map(([shooterId, stats]) => ({
        shooterId,
        shooter: shooters.find(s => s.id === shooterId),
        ...stats,
        isEligible: stats.races >= tournament.majorityThreshold
      }))
      .sort((a, b) => b.hits - a.hits);

    // Filter only eligible shooters for prize assignment
    const eligibleStats = stats.filter(s => s.isEligible);
    
    // Assign prizes
    const winners: { prize: TournamentPrize; winner: any }[] = [];
    const usedShooterIds = new Set<string>();

    if (tournament.advancedPrizes) {
      // 1. Sort prizes: Assoluto first, then by position
      const sortedPrizes = [...tournament.advancedPrizes]
        .filter(p => p.enabled)
        .sort((a, b) => {
          if (a.category === 'Assoluto' && b.category !== 'Assoluto') return -1;
          if (a.category !== 'Assoluto' && b.category === 'Assoluto') return 1;
          return a.position - b.position;
        });

      sortedPrizes.forEach(prize => {
        let winner: any = null;
        if (prize.category === 'Assoluto') {
          // Absolute ranking winners
          const pool = eligibleStats.filter(s => !usedShooterIds.has(s.shooterId));
          winner = pool[prize.position - 1] || null;
        } else {
          // Category ranking winners
          const pool = eligibleStats.filter(s => s.shooter?.category === prize.category && !usedShooterIds.has(s.shooterId));
          winner = pool[prize.position - 1] || null;
        }

        if (winner) {
          winners.push({ prize, winner });
          usedShooterIds.add(winner.shooterId);
        }
      });
    }

    return { stats, winners };
  };

  const handleExportPDF = async (tournament: Tournament) => {
    const { stats, winners } = calculateTournamentStats(tournament);
    
    const sections = [
      {
        title: 'Classifica di Maggioranza (Idonei)',
        headers: ['Pos.', 'Atleta', 'Categoria', 'Gare', 'Hits Totali'],
        data: stats.filter(s => s.isEligible).map((s, idx) => [
          `${idx + 1}°`,
          `${s.shooter?.lastName} ${s.shooter?.firstName}`,
          s.shooter?.category || '',
          s.races.toString(),
          s.hits.toString()
        ])
      }
    ];

    if (winners.length > 0) {
      sections.unshift({
        title: 'Vincitori Premi Torneo',
        headers: ['Premio', 'Vincitore', 'Categoria Atleta', 'Hits / Gare', 'Valore'],
        data: winners.map(w => [
          w.prize.label,
          `${w.winner.shooter?.lastName} ${w.winner.shooter?.firstName}`,
          w.winner.shooter?.category || '',
          `${w.winner.hits} / ${w.winner.races}`,
          `€${w.prize.value}`
        ])
      });
    }

    // Also include non-eligible for completeness if user wants? 
    // Usually only eligible are in the "Tournament Report".
    
    const { exportFullReportToPDF } = await import('../services/pdfService');
    exportFullReportToPDF(
      `Report Torneo: ${tournament.name}`,
      sections,
      `torneo_${tournament.name.replace(/\s+/g, '_')}.pdf`
    );
    toast.success('Report PDF generato');
  };

  const handleExportTournament = (tournament: Tournament) => {
    try {
      const dataStr = JSON.stringify(tournament, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BACKUP_TORNEO_${tournament.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Dati torneo esportati con successo');
    } catch (error) {
      toast.error('Errore durante l\'esportazione');
    }
  };

  const handleImportTournament = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        if (!importedData.name || !importedData.majorityThreshold) {
          throw new Error('Formato file non valido');
        }

        // Generate a new ID and creation date to avoid collisions if importing the same file
        const newTournamentImported: Tournament = {
          ...importedData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        };

        onUpdateTournaments([...tournaments, newTournamentImported]);
        toast.success('Torneo importato con successo');
      } catch (error) {
        console.error(error);
        toast.error('Errore durante l\'importazione: formato non valido');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 bg-brand-bg h-full overflow-y-auto high-density-scroll">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl gap-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Layers className="text-amber-500" size={24} /> Tornei & Maggioranza
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mt-1 italic">Eventi multi-gara e fedeltà</p>
        </div>
        {!isAdding && (
          <div className="flex gap-3 w-full sm:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportTournament} 
              accept=".json" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-slate-400 px-4 py-3 rounded-xl hover:bg-slate-700 transition font-black text-xs uppercase tracking-widest border border-slate-700"
              title="Importa Torneo (.json)"
            >
              <Upload size={18} /> Importa
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl hover:bg-amber-500 transition font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-900/20"
            >
              <Plus size={18} /> Nuovo Torneo
            </button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="bg-card-bg p-6 sm:p-10 rounded-2xl border border-amber-500/30 shadow-2xl space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center border-b border-slate-800 pb-6">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2 italic">
              Configurazione Torneo
            </h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white transition">
               Esci
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome dell'Evento</label>
                <input
                  type="text"
                  className="w-full px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-200 font-bold"
                  placeholder="Es: Campionato Provinciale Estivo 2024"
                  value={newTournament.name}
                  onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gare Totali (M)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white font-mono"
                    value={newTournament.totalRaces}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewTournament({ ...newTournament, totalRaces: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Threshold (N)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white font-mono"
                    value={newTournament.majorityThreshold}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewTournament({ ...newTournament, majorityThreshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sconto Abbonamento (per 2^ gara)</label>
                <div className="grid grid-cols-3 gap-3">
                  <select 
                    className="col-span-1 px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold"
                    value={newTournament.subscriptionDiscount?.type}
                    onChange={e => setNewTournament({
                      ...newTournament, 
                      subscriptionDiscount: { ...newTournament.subscriptionDiscount!, type: e.target.value as any }
                    })}
                  >
                    <option value="fixed">€ Fisso</option>
                    <option value="percentage">% Perc</option>
                  </select>
                  <input
                    type="number"
                    className="col-span-2 px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white font-mono"
                    value={newTournament.subscriptionDiscount?.value}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewTournament({
                      ...newTournament, 
                      subscriptionDiscount: { ...newTournament.subscriptionDiscount!, value: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold italic mt-1 uppercase">Applicato automaticamente se il tiratore è presente in più gare</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Premi di Maggioranza</label>
                <button 
                  onClick={addPrize}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase hover:bg-amber-500 hover:text-slate-900 transition-all font-mono"
                >
                   <Plus size={14} /> Aggiungi Premio
                </button>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 high-density-scroll">
                {newTournament.advancedPrizes?.map((prize, idx) => (
                  <div key={prize.id} className="grid grid-cols-12 gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800 items-end group relative transition-colors hover:border-amber-500/30">
                    <div className="col-span-6 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase">Etichetta</label>
                      <input 
                        type="text"
                        value={prize.label}
                        onChange={e => {
                          const updated = [...newTournament.advancedPrizes!];
                          updated[idx] = { ...prize, label: e.target.value };
                          setNewTournament({ ...newTournament, advancedPrizes: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-amber-500"
                        placeholder="1° Assoluto..."
                      />
                    </div>
                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase">Categoria</label>
                      <select 
                        value={prize.category}
                        onChange={e => {
                          const updated = [...newTournament.advancedPrizes!];
                          updated[idx] = { ...prize, category: e.target.value as any };
                          setNewTournament({ ...newTournament, advancedPrizes: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-amber-500"
                      >
                        <option value="Assoluto">Assoluto</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex justify-end pb-1.5">
                       <button onClick={() => removePrize(prize.id)} className="text-slate-600 hover:text-red-500 transition-colors">
                         <Trash2 size={16} />
                       </button>
                    </div>

                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase">Posizione</label>
                      <input 
                        type="number"
                        value={prize.position}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const updated = [...newTournament.advancedPrizes!];
                          updated[idx] = { ...prize, position: parseInt(e.target.value) || 1 };
                          setNewTournament({ ...newTournament, advancedPrizes: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white font-mono text-center outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase">Valore €</label>
                      <input 
                        type="number"
                        value={prize.value}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const updated = [...newTournament.advancedPrizes!];
                          updated[idx] = { ...prize, value: parseFloat(e.target.value) || 0 };
                          setNewTournament({ ...newTournament, advancedPrizes: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-xs text-amber-400 font-mono outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase">Info Extra</label>
                      <input 
                        type="text"
                        value={prize.info || ''}
                        placeholder="Coppa/Targa..."
                        onChange={e => {
                          const updated = [...newTournament.advancedPrizes!];
                          updated[idx] = { ...prize, info: e.target.value };
                          setNewTournament({ ...newTournament, advancedPrizes: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-400 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap justify-end pt-8 border-t border-slate-800 gap-3 sm:gap-4">
             <button
              onClick={() => { setIsAdding(false); setEditingId(null); setNewTournament(initialTournament); }}
              className="flex-1 lg:flex-none px-6 py-4 bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Annulla
            </button>
             <button
              onClick={handleCreate}
              className="flex-[2] lg:flex-none px-6 lg:px-12 py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-900/40 hover:bg-amber-500 transition-all flex items-center justify-center gap-2"
            >
              {editingId ? 'Salva' : 'Crea ed Attiva'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {tournaments.map(tournament => {
          const { stats, winners } = calculateTournamentStats(tournament);
          const sessionsInTournament = sessions.filter(s => s.settings.tournamentId === tournament.id);

          return (
            <div key={tournament.id} className="bg-card-bg rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col group hover:border-amber-500/20 transition-all duration-300">
              <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 bg-[#2D3A4F] gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="p-3 sm:p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-xl group-hover:scale-110 transition-transform shrink-0">
                    <Trophy className="text-amber-500" size={24} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter truncate">{tournament.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 sm:mt-2">
                       <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <Calculator size={12} className="text-sky-500 sm:w-[14px] sm:h-[14px]" /> {tournament.majorityThreshold}/{tournament.totalRaces} Gare
                       </span>
                       <span className="hidden sm:inline text-slate-700">|</span>
                       <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <ShieldCheck size={12} className="text-emerald-500 sm:w-[14px] sm:h-[14px]" /> Sconto: {tournament.subscriptionDiscount.type === 'fixed' ? `€${tournament.subscriptionDiscount.value}` : `${tournament.subscriptionDiscount.value}%`}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                  <button 
                    onClick={() => handleEdit(tournament)}
                    className="p-2.5 text-slate-400 hover:text-white transition bg-slate-800 rounded-xl grow sm:grow-0 flex justify-center"
                    title="Modifica"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => handleExportPDF(tournament)}
                    className="p-2.5 text-slate-400 hover:text-white transition bg-slate-800 rounded-xl grow sm:grow-0 flex justify-center"
                    title="PDF"
                  >
                    <FileDown size={18} />
                  </button>
                  <button 
                    onClick={() => handleExportTournament(tournament)}
                    className="p-2.5 text-slate-400 hover:text-white transition bg-slate-800 rounded-xl grow sm:grow-0 flex justify-center"
                    title="Esporta Torneo (.json)"
                  >
                    <Download size={18} />
                  </button>
                  <button 
                    onClick={() => removeTournament(tournament.id)}
                    className="p-2.5 text-slate-500 hover:text-red-500 transition bg-slate-800 rounded-xl grow sm:grow-0 flex justify-center"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                {/* Winners Section */}
                {winners.length > 0 && (
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                       <Trophy size={14} /> Vincitori Premi Torneo
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {winners.map((win, idx) => (
                        <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group/winner hover:border-amber-500/50 transition-all">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full -mr-8 -mt-8 group-hover/winner:bg-amber-500/10 transition-colors" />
                          <div className="flex justify-between items-start z-10">
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-sky-500 group-hover/winner:scale-110 transition-transform">
                              <ShieldCheck size={16} />
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black text-amber-500 font-mono italic">€{win.prize.value}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-loose">
                              {win.prize.category} • {win.prize.position}° Pos.
                            </p>
                            <h6 className="text-[10px] font-black text-slate-200 uppercase tracking-tight group-hover/winner:text-white transition-colors">
                              {win.prize.label}
                            </h6>
                          </div>
                          <div className="mt-auto pt-3 border-t border-slate-800/50 flex flex-col">
                            <span className="text-xs font-black text-amber-400 uppercase tracking-tighter">
                              {win.winner.shooter?.lastName} {win.winner.shooter?.firstName}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                              {win.winner.hits} Hits / {win.winner.races} Gare
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  <div className="xl:col-span-1 space-y-4">
                     <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <Plus size={14} /> Gare Associate ({sessionsInTournament.length})
                     </h5>
                   <div className="space-y-2">
                     {sessionsInTournament.map(s => (
                       <div key={s.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between group/race">
                          <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{s.settings.name}</span>
                          <span className="text-[8px] bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded font-black">{s.status}</span>
                       </div>
                     ))}
                     {sessionsInTournament.length === 0 && (
                       <p className="text-[9px] text-slate-600 font-bold italic uppercase">Nessuna gara associata. Vai in configurazione gara per collegarla.</p>
                     )}
                   </div>
                </div>

                <div className="xl:col-span-3 space-y-4">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <Users size={14} /> Classifica di Maggioranza
                  </h5>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[600px]">
                       <thead className="bg-[#1a2333]">
                         <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                           <th className="px-5 py-3">Rank</th>
                           <th className="px-5 py-3">Atleta</th>
                           <th className="px-5 py-3 text-center">Gare</th>
                           <th className="px-5 py-3 text-center">Hits Totali</th>
                           <th className="px-5 py-3 text-right">Idoneità</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800/50">
                         {stats.map((s, idx) => (
                           <tr key={s.shooterId} className={`hover:bg-slate-800/30 transition-colors ${!s.isEligible ? 'opacity-40 grayscale' : ''}`}>
                             <td className="px-5 py-4 font-black font-mono text-xs text-slate-500">{idx + 1}°</td>
                             <td className="px-5 py-4">
                               <div className="flex flex-col">
                                 <span className="text-xs font-black text-slate-200 uppercase">{s.shooter?.lastName} {s.shooter?.firstName}</span>
                                 <span className="text-[8px] font-bold text-slate-500 uppercase">{s.shooter?.category}</span>
                               </div>
                             </td>
                             <td className="px-5 py-4 text-center font-black text-sky-400 text-xs">{s.races}</td>
                             <td className="px-5 py-4 text-center font-black text-emerald-400 text-lg font-mono italic">{s.hits}</td>
                             <td className="px-5 py-4 text-right">
                                {s.isEligible ? (
                                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-widest">In Regola</span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-black uppercase tracking-widest">Incompleto</span>
                                )}
                             </td>
                           </tr>
                         ))}
                         {stats.length === 0 && (
                           <tr key="empty-stats">
                             <td colSpan={5} className="px-5 py-12 text-center text-slate-600 text-[10px] font-black uppercase italic tracking-widest">Calcolo in attesa di iscrizioni nelle gare associate</td>
                           </tr>
                         )}
                       </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        })}

        {tournaments.length === 0 && !isAdding && (
          <div className="py-32 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer group" onClick={() => setIsAdding(true)}>
             <Layers className="text-slate-700 group-hover:text-amber-500 transition-colors mb-6" size={64} />
             <p className="text-sm font-black text-slate-600 uppercase tracking-[0.4em] group-hover:text-slate-400 transition-colors">Nessun torneo attivo</p>
             <p className="text-[10px] text-slate-700 uppercase mt-3 font-bold italic tracking-wider max-w-sm">Crea tornei per gestire classifiche cumulative su più gare o attivare sconti abbonamento</p>
          </div>
        )}
      </div>
    </div>
  );
}
