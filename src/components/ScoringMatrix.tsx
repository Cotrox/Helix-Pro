import { Target, AlertCircle, ArrowLeft, ArrowRight, RotateCcw, FileDown, Layers, Info, X, Trash2 } from 'lucide-react';
import { Shooter, Score, CompetitionSettings, Registration } from '../types';
import { useState } from 'react';
import { exportToPDF, exportStatinoPDF } from '../services/pdfService';
import { toast } from 'sonner';

interface Props {
  shooters: Shooter[];
  registrations: Registration[];
  scores: Score[];
  settings: CompetitionSettings;
  onUpdate: (scores: Score[]) => void;
  onUpdateRegistrations?: (registrations: Registration[]) => void;
}

export default function ScoringMatrix({ shooters, registrations, scores, settings, onUpdate, onUpdateRegistrations }: Props) {
  const [activeCell, setActiveCell] = useState<{shooterId: string, seriesIdx: number | string} | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStatinoModal, setShowStatinoModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [statinoOrientation, setStatinoOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [statinoType, setStatinoType] = useState<'prefilled' | 'empty'>('prefilled');

  const isManualMode = settings.rankingMode === 'manual' && settings.managedType !== 'delegata';

  const handleRankChange = (regId: string, value: string) => {
    if (!onUpdateRegistrations) return;
    const rank = value === '' ? undefined : (parseInt(value) || 1);
    onUpdateRegistrations(registrations.map(r => r.id === regId ? { ...r, manualRank: rank } : r));
  };

  const handleScoreChange = (shooterId: string, seriesIdx: number, value: string) => {
    const seriesMax = (settings.seriesTargets && settings.seriesTargets[seriesIdx]) !== undefined 
      ? settings.seriesTargets[seriesIdx] 
      : (settings.targetsPerSeries || 5);
    
    let scoreVal: number | null = null;
    if (value !== '') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        scoreVal = Math.min(seriesMax, Math.max(0, parsed));
      }
    }
    
    const existingScoreIdx = scores.findIndex(s => s.shooterId === shooterId);
    let newScores = [...scores];

    if (existingScoreIdx >= 0) {
      const existingScore = newScores[existingScoreIdx];
      const updatedSeries = [...existingScore.seriesScores];
      
      while (updatedSeries.length <= seriesIdx || updatedSeries.length < settings.seriesCount) {
        updatedSeries.push(null);
      }
      
      updatedSeries[seriesIdx] = scoreVal;
      newScores[existingScoreIdx] = { 
        ...existingScore, 
        seriesScores: updatedSeries 
      };
    } else {
      const seriesScores = Array(settings.seriesCount).fill(null);
      if (seriesIdx < seriesScores.length) {
        seriesScores[seriesIdx] = scoreVal;
      }
      newScores.push({ 
        shooterId, 
        seriesScores, 
        spareggioScore: null, 
        manualTotal: null 
      });
    }

    onUpdate(newScores);
  };

  const renderMatrixTable = (expanded = false) => (
    <div id="scoring-matrix-table" className={`bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-hidden ${expanded ? 'flex-1 flex flex-col h-full bg-[#0F172A]' : 'flex flex-col h-full'}`}>
      <div className="flex-1 overflow-auto high-density-scroll">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-[#2D3A4F] sticky top-0 z-20 font-sans">
            <tr className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
              <th className="px-4 lg:px-6 py-4 border-b border-slate-700 w-16 lg:w-24 bg-[#2D3A4F] sticky left-0 z-30 text-center">Pett.</th>
              <th className="px-4 lg:px-6 py-4 border-b border-slate-700 w-32 lg:w-64 bg-[#2D3A4F] sticky left-16 lg:left-24 z-30 border-l border-slate-700/50">Tiratore</th>
              {isManualMode ? (
                <th className="px-4 py-4 border-b border-slate-700 text-center min-w-[150px]">Posizione Classifica</th>
              ) : (
                Array.from({length: settings.seriesCount}).map((_, i) => (
                  <th key={i} className="px-4 py-4 border-b border-slate-700 text-center min-w-[100px]">Serie {i+1}</th>
                ))
              )}
              <th className="px-4 lg:px-6 py-4 border-b border-slate-700 text-right bg-[#2D3A4F] sticky right-0 z-30 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.4)] text-emerald-400 font-black">
                {isManualMode ? 'Stato' : 'Totale Hit'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {(registrations || []).filter(Boolean).map(reg => {
              const shooter = shooters.find(s => s.id === reg.shooterId);
              if (!shooter) return null;
              return (
                <tr key={reg.id} className="hover:bg-slate-800/40 group transition-colors">
                  <td className="px-4 lg:px-6 py-4 border-none bg-[#1E293B] font-black text-amber-500 font-mono text-center sticky left-0 z-10 group-hover:bg-slate-800 transition-colors">
                    {reg.shootingOrder || '-'}
                  </td>
                  <td className="px-4 lg:px-6 py-4 border-none border-l border-slate-800/50 bg-[#1E293B] font-bold text-slate-200 sticky left-16 lg:left-24 z-10 group-hover:bg-slate-800 transition-colors">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-black tracking-tight uppercase group-hover:text-white transition-colors truncate">{shooter.lastName} {shooter.firstName}</span>
                      <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest italic">{shooter.category}</span>
                    </div>
                  </td>
                  {isManualMode ? (
                    <td className="p-1.5 text-center bg-sky-900/10">
                       <input
                          id={`rank-input-${reg.id}`}
                          type="number"
                          value={reg.manualRank ?? ''}
                          onFocus={(e) => {
                            e.target.select();
                            setActiveCell({shooterId: shooter.id, seriesIdx: 'rank'});
                          }}
                          onBlur={() => setActiveCell(null)}
                          onChange={e => {
                            handleRankChange(reg.id, e.target.value);
                          }}
                          className={`w-full h-11 text-center rounded-md border transition-all font-mono font-bold text-lg
                            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                            ${activeCell?.shooterId === shooter.id && activeCell?.seriesIdx === 'rank' ? 'bg-slate-800 border-sky-500 text-white shadow-lg ring-2 ring-sky-500/20' : 
                              reg.manualRank ? 'bg-sky-900/30 border-sky-500/30 text-sky-400' : 'bg-transparent border-slate-800 text-slate-600 focus:bg-slate-800'}
                          `}
                          placeholder="Pos."
                        />
                    </td>
                  ) : (
                    Array.from({length: settings.seriesCount}).map((_, idx) => {
                      const val = getScoreValue(shooter.id, idx);
                      const isActive = activeCell?.shooterId === shooter.id && activeCell?.seriesIdx === idx;
                      return (
                        <td key={idx} className={`p-1.5 text-center transition-all ${val !== null ? 'bg-emerald-900/10' : 'bg-slate-900/20'}`}>
                          <input
                            id={`score-input-${shooter.id}-${idx}`}
                            type="number"
                            value={val === null ? '' : val}
                            onFocus={(e) => {
                              e.target.select();
                              setActiveCell({shooterId: shooter.id, seriesIdx: idx});
                            }}
                            onBlur={() => setActiveCell(null)}
                            onChange={e => {
                              handleScoreChange(shooter.id, idx, e.target.value);
                            }}
                            className={`w-full h-11 text-center rounded-md border transition-all font-mono font-bold text-lg
                              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                              ${isActive ? 'bg-slate-800 border-sky-500 text-white shadow-lg ring-2 ring-sky-500/20' : 
                                val !== null ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-transparent border-slate-800 text-slate-600 focus:bg-slate-800'}
                            `}
                            placeholder="-"
                          />
                        </td>
                      );
                    })
                  )}
                  <td className="px-4 lg:px-6 py-4 text-right bg-[#1E293B] sticky right-0 z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.4)] group-hover:bg-slate-800 transition-colors">
                    <div className="flex items-center justify-end gap-2">
                       <div className="flex flex-col items-end">
                        <span className="text-lg lg:text-2xl font-black text-sky-400 font-mono tracking-tighter">
                          {isManualMode 
                            ? (reg.manualRank ? `${reg.manualRank}°` : '---')
                            : getShooterTotal(shooter.id)
                          }
                        </span>
                        <span className="text-[7px] lg:text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">
                          {isManualMode ? 'Posiz.' : 'Hits'}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleExportPDF = () => {
    const headers = ['Tiratore', 'Categoria', ...Array.from({length: settings.seriesCount}).map((_, i) => `S${i+1}`), 'Totale'];
    const data: any[][] = (registrations || []).filter(Boolean).map(reg => {
      const shooter = shooters.find(s => s.id === reg.shooterId);
      if (!shooter) return null;
      return [
        `${shooter.lastName} ${shooter.firstName}`,
        shooter.category,
        ...Array.from({length: settings.seriesCount}).map((_, i) => (getScoreValue(shooter.id, i) ?? '-').toString()),
        isManualMode ? (reg.manualRank ? `${reg.manualRank}°` : '-') : getShooterTotal(shooter.id).toString()
      ];
    }).filter((r): r is any[] => r !== null);

    exportToPDF('Matrice Punteggi', headers, data, `punteggi_${settings.name.replace(/\s+/g, '_')}.pdf`, settings);
    toast.success('PDF punteggi generato');
  };

  const handleClearScores = () => {
    // Clear scores
    onUpdate([]);
    
    // Clear ranks if manual mode
    if (onUpdateRegistrations) {
      const clearedRegistrations = registrations.map(r => ({
        ...r,
        manualRank: undefined
      }));
      onUpdateRegistrations(clearedRegistrations);
    }
    
    toast.success('Tutti i punteggi sono stati svuotati');
    setShowClearConfirmModal(false);
  };

  const handleExportStatino = () => {
    // Columns: Pettorale|Tiratore|Categoria|Serie 1| ... | Serie N | Totale
    const headers = [
      'Pettorale', 
      'Tiratore', 
      'Categoria', 
      ...Array.from({length: settings.seriesCount}).map((_, i) => `Serie ${i+1}`),
      'Totale'
    ];

    let data: string[][];

    if (statinoType === 'empty') {
      // Fill full page for manual entries
      const rowCount = statinoOrientation === 'portrait' ? 24 : 12;
      data = Array.from({ length: rowCount }).map(() => [
        ' ', 
        ' ', 
        ' ',
        ...Array.from({length: settings.seriesCount}).map(() => ''),
        ' '
      ]);
    } else {
      const sortedRegs = [...(registrations || [])].filter(Boolean).sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));
      data = sortedRegs.map(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        const seriesColumns = Array.from({length: settings.seriesCount}).map(() => '');

        return [
          (reg.shootingOrder || '-').toString(),
          (shooter ? `${shooter.lastName} ${shooter.firstName}` : 'N/A'),
          (shooter?.category || 'N/A'),
          ...seriesColumns,
          ' '
        ];
      });
    }

    exportStatinoPDF(headers, data, `statino_DT_${settings.name.replace(/\s+/g, '_')}.pdf`, settings, statinoOrientation);
    toast.success(`Statino DT (${statinoOrientation === 'portrait' ? 'Verticale' : 'Orizzontale'}) ${statinoType === 'empty' ? 'Vuoto' : 'Precompilato'} generato`);
    setShowStatinoModal(false);
  };

  function getScoreValue(shooterId: string, seriesIdx: number) {
    const s = scores.find(sc => sc.shooterId === shooterId);
    return s?.seriesScores[seriesIdx] ?? null;
  }

  function getShooterTotal(shooterId: string) {
    const s = scores.find(sc => sc.shooterId === shooterId);
    if (!s) return 0;
    if (s.manualTotal !== null) return s.manualTotal;
    return s.seriesScores.reduce((acc: number, val) => acc + (val ?? 0), 0);
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 flex flex-col h-full bg-[#0F172A] overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white uppercase tracking-wider">
            <Target className="text-sky-500" size={20} /> Matrix Punteggi
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mt-1 italic">Gestione hit per sessione</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
           <button
            onClick={() => setShowClearConfirmModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-950/20 text-red-500 border border-red-900/50 px-3 sm:px-6 py-2 rounded-lg hover:bg-red-900/40 transition font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-xl"
            title="Svuota tutti i punteggi caricati in questa sessione"
          >
            <Trash2 size={14} /> Svuota
          </button>
           <button
            onClick={() => setShowStatinoModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-amber-400 border border-slate-700 px-3 sm:px-6 py-2 rounded-lg hover:border-amber-500/50 transition font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-xl"
            title="Genera lo statino per il Direttore di Tiro"
          >
            <FileDown size={14} /> Statino
          </button>
           <button
            onClick={() => setIsExpanded(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-3 sm:px-6 py-2 rounded-lg hover:bg-slate-700 transition font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-xl"
          >
            <Layers size={14} /> Vista
          </button>
           <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-emerald-500 transition font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-xl"
          >
            <FileDown size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {registrations.length > 0 ? (
          renderMatrixTable()
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 p-12 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
            <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-600 border border-slate-700 shadow-xl">
               <AlertCircle size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-white font-black uppercase tracking-widest text-sm">Nessun iscritto</p>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Aggiungi partecipanti per visualizzare la matrice</p>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col p-4 md:p-8 animate-in fade-in duration-200">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                 <Target className="text-sky-500" size={32} /> Scoring Fullscreen Mode
              </h3>
              <button 
                onClick={() => setIsExpanded(false)}
                className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 transition shadow-2xl flex items-center gap-2"
              >
                 Chiudi Vista <ArrowRight size={20} />
              </button>
           </div>
           {renderMatrixTable(true)}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto border border-red-500/20 shadow-inner">
                <Trash2 size={40} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-widest">Svuota Punteggi</h3>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed uppercase tracking-wider">
                  Stai per <span className="text-red-500 font-black">svuotare tutti i punteggi</span> e le classifiche manuali di questa gara.
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-950/50 p-4 rounded-xl border border-slate-800 mt-4 leading-relaxed">
                  L'operazione rimuoverà definitivamente tutti i valori inseriti nella matrice. Vuoi procedere?
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={() => setShowClearConfirmModal(false)}
                  className="py-4 bg-slate-800 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Annulla
                </button>
                <button 
                  onClick={handleClearScores}
                  className="py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-900/40"
                >
                  Sì, Svuota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statino Orientation Modal */}
      {showStatinoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <FileDown className="text-amber-500" size={18} /> Configurazione Statino Direttore di Tiro
              </h3>
              <button onClick={() => setShowStatinoModal(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl flex gap-4 items-start">
                <Info size={24} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Nota per il Direttore</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Lo <span className="text-white">Statino</span> è il documento utilizzato sul campo per segnare i piatti rotti. 
                    Assicurati di scegliere l'orientamento corretto in base al numero di serie previste per la gara.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Orientamento Pagina</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setStatinoOrientation('portrait')}
                      className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        statinoOrientation === 'portrait' ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      Verticale
                    </button>
                    <button
                      onClick={() => setStatinoOrientation('landscape')}
                      className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        statinoOrientation === 'landscape' ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      Orizzontale
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tipologia Contenuto</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setStatinoType('prefilled')}
                      className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        statinoType === 'prefilled' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      Precompilato
                    </button>
                    <button
                      onClick={() => setStatinoType('empty')}
                      className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        statinoType === 'empty' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      Vuoto (Manuale)
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button 
                  onClick={handleExportStatino}
                  className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-amber-900/40 hover:bg-amber-500 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <FileDown size={22} /> Genera Statino PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Access Legend / Helper */}
      <div className="bg-slate-900/50 p-3 lg:p-4 border border-slate-800 rounded-xl flex flex-col lg:flex-row justify-between items-center px-4 lg:px-8 gap-4">
         <div className="flex flex-wrap lg:flex-nowrap gap-4 lg:gap-8 text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest items-center">
            <span className="flex items-center gap-2"><ArrowLeft size={10} className="lg:w-3 lg:h-3" /> TAB</span>
            <span className="flex items-center gap-2"><ArrowRight size={10} className="lg:w-3 lg:h-3" /> KBD</span>
            <span className="flex items-center gap-2"><RotateCcw size={10} className="lg:w-3 lg:h-3" /> EDIT</span>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[8px] lg:text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 lg:px-3 py-1 rounded">Autosave</span>
         </div>
      </div>
    </div>
  );
}
