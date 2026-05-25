import { useState, useMemo } from 'react';
import { 
  Target, 
  Plus, 
  Trophy, 
  Database,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Grid,
  Copy,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Tournament, Session } from '../types';

interface Props {
  tournaments: Tournament[];
  sessions: Session[];
  onSelect: (id: string) => void;
  onCreate: (managedType: 'proprietaria' | 'delegata') => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ContestManager({ 
  tournaments, 
  sessions, 
  onSelect, 
  onCreate,
  onClone,
  onDelete
}: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {
      'Libere': []
    };

    tournaments.forEach(t => {
      groups[t.id] = [];
    });

    sessions.forEach(s => {
      if (s.settings.tournamentId && groups[s.settings.tournamentId]) {
        groups[s.settings.tournamentId].push(s);
      } else {
        groups['Libere'].push(s);
      }
    });

    return groups;
  }, [tournaments, sessions]);

  return (
    <div className="p-8 space-y-12 bg-brand-bg h-full overflow-y-auto high-density-scroll pb-32">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Dashboard Competizioni</h3>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Target className="text-sky-500" size={32} /> Gestione Gare
          </h2>
        </div>
        <div className="flex gap-3 relative">
          {isCreating ? (
            <div className="flex gap-2 animate-in slide-in-from-right-4">
              <button 
                onClick={() => { onCreate('proprietaria'); setIsCreating(false); }}
                className="bg-sky-600 text-white px-4 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2"
              >
                <Grid size={14} /> Proprietaria
              </button>
              <button 
                onClick={() => { onCreate('delegata'); setIsCreating(false); }}
                className="bg-amber-600 text-white px-4 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2"
              >
                <ExternalLink size={14} /> Delegata (Esterna)
              </button>
              <button 
                onClick={() => setIsCreating(false)}
                className="bg-slate-800 text-slate-400 px-4 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest border border-slate-700"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-500 transition font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/20"
            >
              <Plus size={18} /> Nuova Gara
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {/* Render Tornei Sections */}
        {tournaments.map(tournament => {
          const tournamentSessions = groupedSessions[tournament.id];
          if (tournamentSessions.length === 0) return null;

          return (
            <section key={tournament.id} className="space-y-6">
              <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <Trophy className="text-amber-500" size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-black text-white uppercase tracking-tight">{tournament.name}</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{tournamentSessions.length} Gare Collegate</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournamentSessions.map(s => (
                  <SessionCard 
                    key={s.id} 
                    session={s} 
                    onSelect={() => onSelect(s.id)} 
                    onDelete={() => setSessionToDelete(s)} 
                    onClone={() => onClone(s.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Render Libere Section */}
        {groupedSessions['Libere'].length > 0 && (
          <section className="space-y-6">
             <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <div className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/20">
                    <Grid className="text-sky-500" size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-black text-white uppercase tracking-tight">Gare Libere (One-Shot)</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pianificazioni singole</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedSessions['Libere'].map(s => (
                  <SessionCard 
                    key={s.id} 
                    session={s} 
                    onSelect={() => onSelect(s.id)} 
                    onDelete={() => setSessionToDelete(s)} 
                    onClone={() => onClone(s.id)}
                  />
                ))}
              </div>
          </section>
        )}

        {sessions.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl opacity-40">
             <Database className="mx-auto mb-4 text-slate-600" size={48} />
             <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nessuna gara registrata</p>
             <button onClick={() => setIsCreating(true)} className="mt-4 text-sky-400 font-bold text-xs uppercase hover:underline">
               Crea la tua prima competizione
             </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Deletion */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Conferma Eliminazione</h3>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Eliminare questa gara?</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Stai per eliminare definitivamente <span className="text-white font-bold italic">"{sessionToDelete.settings.name}"</span>. 
                  Tutti i risultati, le iscrizioni e i barrage verranno rimossi. L'azione non è reversibile.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setSessionToDelete(null)}
                className="flex-1 bg-slate-800 text-slate-400 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition"
              >
                Annulla
              </button>
              <button 
                onClick={() => {
                  onDelete(sessionToDelete.id);
                  setSessionToDelete(null);
                }}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 hover:bg-red-500 transition"
              >
                Sì, Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionCardProps {
  session: Session;
  onSelect: () => void;
  onDelete: () => void;
  onClone: () => void;
}

function SessionCard({ session, onSelect, onDelete, onClone }: SessionCardProps) {
  const isDelegated = (session.settings.managedType || 'proprietaria') === 'delegata';
  
  return (
    <div className={`bg-card-bg rounded-2xl border ${session.status === 'active' ? 'border-sky-500/30' : 'border-slate-800'} p-6 hover:border-sky-500/50 transition-all flex flex-col justify-between group shadow-xl hover:-translate-y-1`}>
      <div className="space-y-4">
        <div className="flex justify-between items-start">
            <span className={`px-2.5 py-1 ${isDelegated ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'} border text-[8px] font-black uppercase tracking-widest rounded-md`}>
                {isDelegated ? 'DELEGATA (EXT)' : 'PROPRIETARIA'}
            </span>
            <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onClone(); }} className="text-slate-600 hover:text-sky-400 transition" title="Clona Gara">
                    <Copy size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-600 hover:text-red-500 transition" title="Elimina Gara">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
        <div>
            <h4 className="text-base font-black text-white uppercase tracking-tight group-hover:text-sky-400 transition-colors truncate">{session.settings.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {session.settings.startDate ? new Date(session.settings.startDate).toLocaleDateString('it-IT') : (session.settings.eventDate || session.settings.date)}
              </span>
              {session.status === 'completed' && <ShieldCheck size={12} className="text-emerald-500" />}
            </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-800/50 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-600 uppercase">Tiratori</span>
            <span className="text-xs font-bold text-slate-300">{session.registrations.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-600 uppercase">Valore</span>
            <span className="text-xs font-bold text-emerald-400">€{session.settings.totalPrizePool}</span>
          </div>
        </div>
        <button 
          onClick={onSelect}
          className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-sky-600 hover:text-white transition-all shadow-lg"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
