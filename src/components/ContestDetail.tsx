import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  UserPlus, 
  Target, 
  Trophy, 
  Award, 
  Landmark, 
  ArrowLeft,
  ChevronDown,
  Zap,
  Pause,
  CheckCircle2,
  FileDown,
  Upload,
  Download
} from 'lucide-react';
import { Shooter, Session, Tournament, SessionStatus } from '../types';
import RegistrationManager from './RegistrationManager';
import ScoringMatrix from './ScoringMatrix';
import RankingsView from './RankingsView';
import PrizeSummary from './PrizeSummary';
import BarrageView from './BarrageView';
import ContestSettings from './ContestSettings';
import { exportFullReportToPDF, PDFSection } from '../services/pdfService';
import { toast } from 'sonner';
import { calculatePrizeAssignments } from '../utils/prizeUtils';
import { useRef } from 'react';

interface Props {
  session: Session;
  shooters: Shooter[];
  tournaments: Tournament[];
  allSessions: Session[];
  initialTab?: string;
  onUpdateSession: (updates: Partial<Session>) => void;
  onDeleteSession?: () => void;
  onBack: () => void;
}

export default function ContestDetail({ 
  session, 
  shooters, 
  tournaments, 
  allSessions,
  initialTab,
  onUpdateSession, 
  onDeleteSession,
  onBack 
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab || 'registration');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSession = () => {
    try {
      const dataStr = JSON.stringify(session, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BACKUP_GARA_${session.settings.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Dati gara esportati con successo');
    } catch (error) {
      toast.error('Errore durante l\'esportazione');
    }
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        // Basic validation - check if it looks like a session
        if (!importedData.id || !importedData.settings || !Array.isArray(importedData.registrations)) {
          throw new Error('Formato file non valido');
        }

        // We keep the current session ID to avoid creating a "new" session that doesn't exist in parent state
        // OR we just overwrite everything except maybe ID if needed.
        // The safest is to use the imported data but ensure we notify parent of all changes.
        onUpdateSession({
          settings: importedData.settings,
          registrations: importedData.registrations,
          scores: importedData.scores || [],
          barrages: importedData.barrages || [],
          status: importedData.status || 'active'
        });

        toast.success('Dati gara ripristinati con successo');
      } catch (error) {
        console.error(error);
        toast.error('Errore durante l\'importazione: formato non valido');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const subTabs = [
    { id: 'registration', label: 'Iscrizioni', icon: UserPlus },
    { id: 'scoring', label: 'Punteggi', icon: Target },
    { id: 'rankings', label: 'Classifiche', icon: Trophy },
    { id: 'barrages', label: 'Barrage', icon: Award },
    { id: 'prizes', label: 'Riepilogo Premi', icon: Landmark },
    { id: 'settings', label: 'Configurazione', icon: SettingsIcon },
  ];

  const handleFullReport = () => {
    try {
      const sections: PDFSection[] = [];
      const fieldServicePerShooter = (session.settings.targetUnitCost || 0) * (session.settings.totalTargets || 0);

      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('it-IT');
      };

      // 1. Informazioni Generali
      const infoHeaders = ['Dato', 'Valore'];
      const seriesDetails = session.settings.seriesTargets && session.settings.seriesTargets.length > 0
        ? `( | ${session.settings.seriesTargets.join(' | ')} | )`
        : `(${session.settings.seriesCount} serie da ${session.settings.targetsPerSeries})`;

      const infoData = [
        ['Nome Gara', session.settings.name],
        ['Data Evento', formatDate(session.settings.eventDate || session.settings.date)],
        ['Località', session.settings.location || 'N/A'],
        ['Tipo Gestione', (session.settings.managedType || 'proprietaria') === 'delegata' ? 'Delegata' : 'Proprietaria'],
        ['Tiri Totali (Serie)', `${session.settings.totalTargets} ${seriesDetails}`],
        ['Iscrizione Base', `€${session.settings.baseEntryFee.toFixed(2)}`],
        ['Costo Servizio Campo', `€${fieldServicePerShooter.toFixed(2)} (${session.settings.targetUnitCost} €/target)`],
        ['Montepremi Totale', `€${session.settings.totalPrizePool.toLocaleString('it-IT')}`],
        ['Stato Gara', session.status === 'active' ? 'ATTIVA' : session.status === 'completed' ? 'CONCLUSA' : 'IN ATTESA'],
        ['Tiratori Iscritti', session.registrations.length.toString()],
      ];
      sections.push({ title: '1. Informazioni Generali Gara', headers: infoHeaders, data: infoData });

      // Helper to calculate total barrage hits for a shooter
      const getShooterBarrageHits = (shooterId: string) => {
        if (!session.barrages || session.barrages.length === 0) return 0;
        return session.barrages.reduce((sum, b) => {
          if (b.participants.includes(shooterId)) {
            const rawScores = b.scores[shooterId];
            const pScores = Array.isArray(rawScores) ? rawScores : (typeof rawScores === 'number' ? [rawScores] : [0]);
            const total = pScores.reduce((acc, val) => acc + (val || 0), 0);
            return sum + total;
          }
          return sum;
        }, 0);
      };

      // 2. Iscrizioni
      // ... (keep current registrations logic, but let's see if we should reuse rankedList later)
      const regHeaders = ['Pett.', 'Tiratore', 'Categoria', 'Sconto Cat.', 'Sconto Extra', 'Quota Iscr.', 'Serv. Campo', 'TOTALE'];
      
      let totalCatDiscount = 0;
      let totalExtraDiscount = 0;
      let totalActualFee = 0;
      let totalFieldService = 0;
      let totalOverallCost = 0;

      const regData = [...session.registrations].sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0)).map(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        const totalCost = reg.actualFee + fieldServicePerShooter;
        
        // Calculate Category Discount
        const shooterCat = shooter?.category || 'Men';
        const catFee = (session.settings.categoryFees && shooterCat in session.settings.categoryFees)
          ? session.settings.categoryFees[shooterCat as keyof typeof session.settings.categoryFees]?.reserved ?? session.settings.baseEntryFee
          : session.settings.baseEntryFee;
        const catDiscount = Math.max(0, session.settings.baseEntryFee - catFee);
        
        // Extra Discount
        let extraDiscountVal = 0;
        if (reg.extraDiscount) {
          if (reg.extraDiscount.type === 'fixed') {
             extraDiscountVal = reg.extraDiscount.value;
          } else {
             extraDiscountVal = (catFee * reg.extraDiscount.value) / 100;
          }
        }

        totalCatDiscount += catDiscount;
        totalExtraDiscount += extraDiscountVal;
        totalActualFee += reg.actualFee;
        totalFieldService += fieldServicePerShooter;
        totalOverallCost += totalCost;

        return [
          (reg.shootingOrder || '-').toString(),
          shooter ? `${shooter.lastName} ${shooter.firstName}` : 'N/A',
          shooter?.category || 'N/A',
          `€${catDiscount.toFixed(2)}`,
          `€${extraDiscountVal.toFixed(2)}`,
          `€${reg.actualFee.toFixed(2)}`,
          `€${fieldServicePerShooter.toFixed(2)}`,
          `€${totalCost.toFixed(2)}`
        ];
      });

      // Add Totals row
      regData.push([
        '',
        'TOTALI',
        '',
        `€${totalCatDiscount.toFixed(2)}`,
        `€${totalExtraDiscount.toFixed(2)}`,
        `€${totalActualFee.toFixed(2)}`,
        `€${totalFieldService.toFixed(2)}`,
        `€${totalOverallCost.toFixed(2)}`
      ]);

      sections.push({ title: '2. Registro Iscrizioni e Contabilità', headers: regHeaders, data: regData });

      // 3. Punteggi
      const scoreHeaders = ['Pett.', 'Tiratore', ...Array.from({ length: session.settings.seriesCount }, (_, i) => `S${i + 1}`), 'Totale'];
      const scoreData = [...session.registrations].sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0)).map(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        const score = session.scores.find(sc => sc.shooterId === reg.shooterId);
        const seriesValues = Array.from({ length: session.settings.seriesCount }, (_, i) => {
          const val = score?.seriesScores[i];
          return val !== null && val !== undefined ? val.toString() : '-';
        });
        const seriesTotal = score?.seriesScores.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
        const total = score?.manualTotal !== null && score?.manualTotal !== undefined ? score.manualTotal : seriesTotal;
        
        return [
          (reg.shootingOrder || '-').toString(),
          shooter ? `${shooter.lastName} ${shooter.firstName}` : 'N/A',
          ...seriesValues,
          total.toString()
        ];
      });
      sections.push({ title: '3. Dettaglio Punteggi per Serie', headers: scoreHeaders, data: scoreData });

      // Calculate Prize Assignments EARLY so we can use them in rankings
      const isManualPrizes = session.manualPrizes && session.manualPrizes.length > 0;
      let assignedWinners: any[] = [];
      if (isManualPrizes) {
        // Manual prizes logic
        const currentTournament = tournaments.find(t => t.id === session.settings.tournamentId);
        const prizes = (currentTournament?.advancedPrizes && currentTournament.active)
          ? currentTournament.advancedPrizes.filter(p => p.enabled)
          : (session.settings.prizes || []).map((p, idx) => ({ ...p, label: p.label || `Premio ${idx + 1}` }));

        session.manualPrizes!.forEach(mp => {
          const prize = prizes.find(p => p.id === mp.prizeId);
          if (!prize) return;
          const winnersCount = mp.winners.length;
          const valuePerShooter = prize.value / winnersCount;
          
          mp.winners.forEach(shooterId => {
            const shooter = shooters.find(s => s.id === shooterId);
            if (!shooter) return;
            const reg = session.registrations.find(r => r.shooterId === shooterId);
            const score = session.scores.find(sc => sc.shooterId === shooterId);
            const seriesTotal = score?.seriesScores.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
            const total = score ? (score.manualTotal !== null ? score.manualTotal : seriesTotal) : 0;
            
            const totalPossibleReintegro = reg?.reintegroAmount ?? 0;
            const isReintegroManuallyDisabled = session.reintegroOverrides?.[shooterId] === false;
            const reintegroToApply = (!isReintegroManuallyDisabled && totalPossibleReintegro > 0) ? totalPossibleReintegro : 0;

            assignedWinners.push({
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
      } else {
        assignedWinners = calculatePrizeAssignments(
          shooters, 
          session.registrations, 
          session.scores, 
          session.settings, 
          tournaments,
          session.reintegroOverrides || {}
        );
      }

      // 4. Classifica
      const isManual = session.settings.rankingMode === 'manual';
      const rankingsHeaders = ['Pos.', 'Atleta', 'Categoria', isManual ? 'Posizione' : 'Punti', 'Spar.', 'Premio'];
      const rankedList = session.registrations.map(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        const score = session.scores.find(sc => sc.shooterId === reg.shooterId);
        const seriesTotal = score?.seriesScores.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
        const total = score ? (score.manualTotal !== null ? score.manualTotal : seriesTotal) : 0;
        
        // Sum manual spareggio AND barrage hits
        const manualSpareggio = score?.spareggioScore || 0;
        const barrageHitsTotal = getShooterBarrageHits(reg.shooterId);
        const totalSpareggio = manualSpareggio + barrageHitsTotal;
        
        return { shooter, total, spareggio: totalSpareggio, registration: reg };
      }).sort((a, b) => {
        if (isManual) {
          const rA = a.registration.manualRank ?? 99999;
          const rB = b.registration.manualRank ?? 99999;
          return rA - rB;
        }
        const tA = a.total ?? 0;
        const tB = b.total ?? 0;
        if (tB !== tA) return tB - tA;
        return (b.spareggio || 0) - (a.spareggio || 0);
      });

      const rankingsData = rankedList.map((d, idx) => {
        const hasPrize = assignedWinners.some(w => w.winner?.id === d.shooter?.id);
        return [
          isManual ? (d.registration.manualRank ? `${d.registration.manualRank}°` : '-') : `${idx + 1}°`,
          `${d.shooter?.lastName} ${d.shooter?.firstName}`,
          d.shooter?.category || '',
          isManual ? (d.registration.manualRank ? `${d.registration.manualRank}°` : '-') : (d.total ?? 0).toString(),
          (d.spareggio || 0).toString(),
          hasPrize ? 'P' : ''
        ];
      });
      sections.push({ title: '4. Classifica Generale Finale', headers: rankingsHeaders, data: rankingsData });

      // NEW SECTION: Breakdown Per Categoria
      try {
        const categories = [...new Set(shooters.map(s => s.category))].sort();
        categories.forEach((cat, idx) => {
          const catRanked = rankedList.filter(d => d.shooter?.category === cat);
          if (catRanked.length > 0) {
            const catHeaders = ['Pos.', 'Atleta', 'Punti', 'Spar.'];
            const catData = catRanked.map((d, cIdx) => [
               `${cIdx + 1}°`,
               `${d.shooter?.lastName} ${d.shooter?.firstName}`,
               (d.total ?? 0).toString(),
               (d.spareggio || 0).toString()
            ]);
            sections.push({ 
              title: `4.${idx + 1}. Classifica: ${cat}`, 
              headers: catHeaders, 
              data: catData 
            });
          }
        });
      } catch (err) {
        console.error("Error generating category breakdown", err);
      }

      // 5. Riepilogo Premi Assegnati
      const prizesHeaders = ['Premio', 'Categoria/Pos.', 'Vincitore', 'Cat. Atleta', 'Lordo', 'Reintegro', 'Netto'];
      const prizesData = assignedWinners.map(w => [
        (w.prize as any).type || (w.prize as any).label || 'N/A',
        `${w.prize.category} - ${w.label}`,
        w.winner ? `${w.winner.lastName} ${w.winner.firstName}` : 'N/A',
        w.winner?.category || 'N/A',
        `€${(w.prizeValue || w.prize.value).toFixed(2)}`,
        `€${w.reintegro.toFixed(2)}`,
        `€${w.final.toFixed(2)}`
      ]);

      if (prizesData.length === 0) {
        prizesData.push(['-', '-', 'Nessun premio assegnato', '-', '€0.00', '€0.00', '€0.00']);
      }

      sections.push({ 
        title: isManualPrizes ? '5. Riepilogo Premi (Assegnazione Manuale Direttore di Tiro)' : '5. Riepilogo Premi Assegnati', 
        headers: prizesHeaders, 
        data: prizesData 
      });

      // 6. Totali Tiratori a Premio
      const totalsMap = new Map<string, { 
        shooter: Shooter; 
        grossTotal: number; 
        reintegroPossible: number;
        wonPrizes: { label: string; value: number }[];
      }>();

      assignedWinners.forEach(w => {
        if (!w.winner) return;
        const current = totalsMap.get(w.winner.id) || { 
          shooter: w.winner, 
          grossTotal: 0, 
          reintegroPossible: session.registrations.find(r => r.shooterId === w.winner!.id)?.reintegroAmount || 0,
          wonPrizes: [] as { label: string; value: number }[]
        };
        
        const catStr = w.prize.category as string;
        const isCategoryPrize = catStr !== 'Assoluto' && catStr !== 'Generale';
        const displayLabel = isCategoryPrize 
          ? `Premio ${w.label} ${w.prize.category}` 
          : ((w.prize as any).type || (w.prize as any).label);

        current.grossTotal += w.prizeValue;
        current.wonPrizes.push({ label: displayLabel, value: w.prizeValue });
        totalsMap.set(w.winner.id, current);
      });

      const shooterTotals = Array.from(totalsMap.values()).map(item => {
        const isReintegroManuallyDisabled = session.reintegroOverrides?.[item.shooter.id] === false;
        const reintegroToApply = (!isReintegroManuallyDisabled && item.reintegroPossible > 0) ? item.reintegroPossible : 0;
        return {
          ...item,
          reintegroApplied: reintegroToApply,
          finalNet: Math.max(0, item.grossTotal - reintegroToApply)
        };
      }).sort((a, b) => b.finalNet - a.finalNet);

      const shooterTotalHeaders = ['Tiratore', 'Categoria', 'Dettaglio Premi', 'Lordo', 'Reintegro', 'Netto Final'];
      const shooterTotalData = shooterTotals.map(item => [
        `${item.shooter.lastName} ${item.shooter.firstName}`,
        item.shooter.category,
        item.wonPrizes.map(p => `${p.label} (€${p.value.toFixed(2)})`).join('\n'),
        `€${item.grossTotal.toFixed(2)}`,
        item.reintegroApplied > 0 ? `-€${item.reintegroApplied.toFixed(2)}` : '€0.00',
        `€${item.finalNet.toFixed(2)}`
      ]);

      if (shooterTotalData.length > 0) {
        sections.push({ 
          title: '6. Riepilogo Totale per Tiratore', 
          headers: shooterTotalHeaders, 
          data: shooterTotalData 
        });
      }

      // 7. Barrage
      if (session.barrages && session.barrages.length > 0) {
        session.barrages.forEach((b, bIdx) => {
          const bHeaders = ['Atleta', ...Array.from({ length: b.seriesCount }, (_, i) => `Serie ${i + 1}`), 'Totale'];
          const bData = b.participants.map(pId => {
            const shooter = shooters.find(s => s.id === pId);
            const seriesScores = b.scores[pId] || [];
            const total = seriesScores.reduce((acc, val) => acc + val, 0);
            return [
              shooter ? `${shooter.lastName} ${shooter.firstName}` : 'N/A',
              ...seriesScores.map(v => v.toString()),
              total.toString()
            ];
          });
          sections.push({ title: `7.${bIdx + 1}. Barrage: ${b.name}`, headers: bHeaders, data: bData });
        });
      }


      exportFullReportToPDF(
        "REPORT INTEGRALE",
        sections,
        `report_completo_${session.settings.name.replace(/\s+/g, '_')}.pdf`,
        session.settings
      );
      toast.success('Report integrale generato con successo');
    } catch (error) {
      console.error(error);
      toast.error('Errore durante la generazione del report');
    }
  };

  const getStatusDisplay = (status: SessionStatus) => {
    switch (status) {
      case 'active': return { label: 'Attiva', icon: Zap, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'waiting': return { label: 'In Attesa', icon: Pause, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'completed': return { label: 'Conclusa', icon: CheckCircle2, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const status = getStatusDisplay(session.status);

  return (
    <div className="flex flex-col h-full bg-brand-bg overflow-hidden print:bg-white print:text-black">
      {/* HEADER SECTION - TWO ROWS */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-800 shadow-lg print:hidden">
        {/* TOP ROW: Tournament Info & Status */}
        <div className="h-auto py-3 lg:h-16 flex items-center px-4 lg:px-8 border-b border-white/5 justify-between gap-4">
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <button 
              onClick={onBack}
              className="p-2 lg:p-2.5 text-slate-400 hover:text-white transition bg-slate-800 rounded-xl border border-slate-700 shadow-md active:scale-95 flex items-center gap-2 group shrink-0"
              title="Indietro"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform lg:w-[18px] lg:h-[18px]" />
            </button>
            
            <div className="flex flex-col min-w-0 overflow-visible">
              <div className="flex items-center gap-3 lg:gap-4 overflow-visible">
                <h2 className="text-sm lg:text-base font-black text-white uppercase tracking-tight truncate max-w-[150px] sm:max-w-[250px] shrink-0">{session.settings.name}</h2>
                <div className="relative shrink-0 z-[120]">
                  <button 
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className={`flex items-center gap-1 lg:gap-2 px-2 py-1 lg:px-3 lg:py-1.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest border transition-all shadow-md ${status.color}`}
                  >
                    <status.icon size={10} className="lg:w-[11px] lg:h-[11px]" />
                    <span className="inline">{status.label}</span>
                    <ChevronDown size={10} className="lg:w-[11px] lg:h-[11px]" />
                  </button>
                  
                  {showStatusMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[130] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {(['active', 'waiting', 'completed'] as SessionStatus[]).map(s => {
                        const sd = getStatusDisplay(s);
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              onUpdateSession({ status: s });
                              setShowStatusMenu(false);
                            }}
                            className="w-full flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800/50 last:border-0"
                          >
                            <sd.icon size={14} className={sd.color.split(' ')[0]} />
                            {sd.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.1em] leading-none flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shadow-lg shadow-current/20 ${(session.settings.managedType || 'proprietaria') === 'delegata' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  {(session.settings.managedType || 'proprietaria') === 'delegata' ? 'Delegata' : 'Proprietaria'}
                </p>
                {(session.settings.startDate || session.settings.startTime) && (
                  <p className="text-[9px] text-slate-700 font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-slate-800/50 rounded-full"></span>
                    {session.settings.startDate && <span>{new Date(session.settings.startDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                    {session.settings.startTime && <span className="opacity-60">{session.settings.startTime}</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 shrink-0 pl-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportSession} 
              accept=".json" 
              className="hidden" 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 lg:p-3 bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition rounded-xl border border-slate-700 shadow-md group/btn relative overflow-visible"
              title="Importazione Gara (.json)"
            >
              <Upload size={16} className="group-hover/btn:scale-110 transition-transform lg:w-[18px] lg:h-[18px]" />
              <div className="absolute top-full right-0 mt-3 px-3 py-2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl border border-slate-700 whitespace-nowrap z-[120] translate-y-1 group-hover/btn:translate-y-0">
                <span className="flex items-center gap-2">
                  <Upload size={12} className="text-sky-400" />
                  Importa backup (.json)
                </span>
              </div>
            </button>

            <button 
              onClick={handleExportSession}
              className="p-2.5 lg:p-3 bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition rounded-xl border border-slate-700 shadow-md group/btn relative overflow-visible"
              title="Esportazione Gara (.json)"
            >
              <Download size={16} className="group-hover/btn:scale-110 transition-transform lg:w-[18px] lg:h-[18px]" />
              <div className="absolute top-full right-0 mt-3 px-3 py-2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl border border-slate-700 whitespace-nowrap z-[120] translate-y-1 group-hover/btn:translate-y-0">
                <span className="flex items-center gap-2">
                  <Download size={12} className="text-amber-400" />
                  Esporta backup (.json)
                </span>
              </div>
            </button>

            <button 
              onClick={handleFullReport}
              className="p-2.5 lg:p-3 bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition rounded-xl border border-slate-700 shadow-md group/btn relative overflow-visible"
              title="Report PDF"
            >
              <FileDown size={16} className="group-hover/btn:scale-110 transition-transform lg:w-[18px] lg:h-[18px]" />
              {/* Tooltip */}
              <div className="absolute top-2/3 right-0 mt-3 px-3 py-2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl border border-slate-700 whitespace-nowrap z-[120] translate-y-1 group-hover/btn:translate-y-0">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  Report Integrale
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* BOTTOM ROW: Navigation Tabs */}
        <div className="h-14 flex items-center px-4 lg:px-8 justify-between bg-slate-900/50">
          <div className="flex gap-1 lg:gap-2 overflow-x-auto no-scrollbar py-2 -mb-2 w-full">
            {subTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-3 lg:px-4 h-9 lg:h-10 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all duration-300 group/tab shrink-0 ${
                  activeSubTab === tab.id 
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
                title={tab.label}
              >
                <tab.icon size={12} className="lg:w-[14px] lg:h-[14px]" />
                <span className="whitespace-nowrap">{tab.label}</span>
                
                {activeSubTab === tab.id && (
                  <div className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'scoring' && (
          <ScoringMatrix 
            shooters={shooters} 
            registrations={session.registrations} 
            scores={session.scores}
            settings={session.settings}
            onUpdate={newScores => onUpdateSession({ scores: newScores })} 
            onUpdateRegistrations={regs => onUpdateSession({ registrations: regs })}
          />
        )}
        {activeSubTab === 'registration' && (
          <RegistrationManager 
            shooters={shooters} 
            registrations={session.registrations} 
            settings={session.settings}
            tournaments={tournaments}
            sessions={allSessions}
            onUpdate={regs => onUpdateSession({ registrations: regs })} 
          />
        )}
        {activeSubTab === 'rankings' && (
          <RankingsView 
            shooters={shooters} 
            registrations={session.registrations} 
            scores={session.scores}
            settings={session.settings}
            onUpdateScores={newScores => onUpdateSession({ scores: newScores })}
          />
        )}
        {activeSubTab === 'barrages' && (
          <BarrageView 
            shooters={shooters}
            registrations={session.registrations}
            scores={session.scores}
            settings={session.settings}
            barrages={session.barrages || []}
            onUpdateBarrages={newBarrages => onUpdateSession({ barrages: newBarrages })}
          />
        )}
        {activeSubTab === 'prizes' && (
          <PrizeSummary 
             shooters={shooters} 
             registrations={session.registrations} 
             scores={session.scores}
             settings={session.settings}
             tournaments={tournaments}
             manualPrizes={session.manualPrizes}
             reintegroOverrides={session.reintegroOverrides}
             onUpdateManualPrizes={mps => onUpdateSession({ manualPrizes: mps })}
             onUpdateReintegroOverrides={ovs => onUpdateSession({ reintegroOverrides: ovs })}
          />
        )}
        {activeSubTab === 'settings' && (
          <ContestSettings 
            settings={session.settings}
            tournaments={tournaments}
            onUpdate={newSettings => onUpdateSession({ settings: newSettings })}
            onDelete={onDeleteSession}
          />
        )}
      </div>
    </div>
  );
}
