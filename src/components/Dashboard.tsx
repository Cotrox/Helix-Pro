import { 
  Users, 
   Award, 
  History, 
  ExternalLink,
  Zap,
  Pause,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';
import { Session, SessionStatus } from '../types';

interface Props {
  currentSession: Session;
  sessions: Session[];
  onUpdateStatus: (id: string, updates: Partial<Session>) => void;
  onNavigate: (id: string, subTab?: string) => void;
}

export default function Dashboard({ currentSession, sessions, onUpdateStatus, onNavigate }: Props) {
  const allSessions = [...sessions, currentSession]
    .filter((s, i, self) => self.findIndex(t => t.id === s.id) === i)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeWaitingSessions = allSessions.filter(s => s.status === 'active' || s.status === 'waiting');
  const completedSessions = allSessions.filter(s => s.status === 'completed');

  const totalRegistered = allSessions.reduce((acc, s) => acc + s.registrations.length, 0);
  const activePrizePool = activeWaitingSessions.reduce((acc, s) => acc + s.settings.totalPrizePool, 0);

  return (
    <div className="p-4 sm:p-8 space-y-8 lg:space-y-10 animate-in fade-in duration-500 overflow-y-auto h-full high-density-scroll pb-32">
      {/* Quick Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <GlobalStat 
          label="Tiratori Totali" 
          value={totalRegistered.toString()} 
          icon={<Users className="text-sky-400" size={20} />}
          trend="+12%"
        />
        <GlobalStat 
          label="Volume Premi Live" 
          value={`€${activePrizePool.toLocaleString('it-IT')}`} 
          icon={<Award className="text-emerald-400" size={20} />}
          trend="LIVE"
        />
        <GlobalStat 
          label="Sessioni Gestite" 
          value={allSessions.length.toString()} 
          icon={<LayoutDashboard className="text-amber-400" size={20} />}
          trend="TOTAL"
        />
      </div>

      {/* Live & Waiting Sessions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-3 italic">
            <Zap className="text-sky-500 fill-sky-500/20" size={18} /> Monitoraggio Sessioni Real-Time
          </h2>
          <span className="text-[10px] bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full border border-sky-500/20 font-black uppercase tracking-widest">
            {activeWaitingSessions.length} in corso
          </span>
        </div>

        {activeWaitingSessions.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
            <Pause size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nessuna sessione attiva al momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {activeWaitingSessions.map(s => (
              <LiveContestCard 
                key={s.id} 
                session={s} 
                onStatusChange={(status) => onUpdateStatus(s.id, { status })}
                onGoTo={(subTab) => onNavigate(s.id, subTab)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Historical Summary */}
      {completedSessions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 italic">
              <History size={18} /> Cronologia Risultati
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedSessions.slice(0, 6).map(s => (
               <div key={s.id} className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{new Date(s.createdAt).toLocaleDateString()}</span>
                      <CheckCircle2 size={14} className="text-emerald-500/50" />
                    </div>
                    <h4 className="text-sm font-black text-slate-300 uppercase truncate">{s.settings.name}</h4>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                     <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-600 uppercase">Iscritti</span>
                          <span className="text-xs font-bold text-slate-400">{s.registrations.length}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-600 uppercase">Valore</span>
                          <span className="text-xs font-bold text-slate-400">€{s.settings.totalPrizePool}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onUpdateStatus(s.id, { status: 'active' })}
                          className="px-3 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-sky-500/20"
                        >
                          Riapri
                        </button>
                        <button 
                          onClick={() => onNavigate(s.id)}
                          className="p-2 text-slate-600 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <ExternalLink size={16} />
                        </button>
                     </div>
                  </div>
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LiveContestCardProps {
  key?: string;
  session: Session;
  onStatusChange: (status: SessionStatus) => void;
  onGoTo: (subTab?: string) => void;
}

function LiveContestCard({ session, onStatusChange, onGoTo }: LiveContestCardProps) {
  const isWaiting = session.status === 'waiting';

  return (
    <div className={`relative bg-card-bg rounded-3xl border ${isWaiting ? 'border-amber-500/20' : 'border-sky-500/30 shadow-2xl shadow-sky-900/10'} p-5 sm:p-8 group transition-all`}>
      <div className="flex flex-col xl:flex-row justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[7px] sm:text-[8px] font-black uppercase tracking-widest border transition-colors ${
              isWaiting 
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {isWaiting ? 'In Attesa' : 'Live Now'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">{session.settings.managedType}</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight group-hover:text-sky-400 transition-colors">
            {session.settings.name}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-2">
            <ContestSubStat label="Tiratori" value={session.registrations.length} />
            <ContestSubStat label="Serie" value={session.settings.seriesCount} />
            <ContestSubStat label="Bersagli" value={session.settings.totalTargets} />
            <ContestSubStat label="Premium" value={`€${session.settings.totalPrizePool}`} />
          </div>
        </div>

        <div className="flex flex-col gap-3 justify-center shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800 pt-6 xl:pt-0 xl:pl-8 xl:min-w-[180px]">
          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Azioni Rapide</p>
          <div className="grid grid-cols-3 xl:flex xl:flex-col gap-2">
            <StatusButton 
              active={session.status === 'active'} 
              color="emerald" 
              icon={<Zap size={12} />} 
              label="Attiva" 
              onClick={() => onStatusChange('active')} 
            />
            <StatusButton 
              active={session.status === 'waiting'} 
              color="amber" 
              icon={<Pause size={12} />} 
              label="Attesa" 
              onClick={() => onStatusChange('waiting')} 
            />
            <StatusButton 
              active={session.status === 'completed'} 
              color="slate" 
              icon={<CheckCircle2 size={12} />} 
              label="Conclusa" 
              onClick={() => onStatusChange('completed')} 
            />
          </div>
          
          <button 
            onClick={() => onGoTo('settings')}
            className="mt-4 flex items-center justify-between w-full bg-slate-800 text-slate-300 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-sky-600 hover:text-white transition-all shadow-lg"
          >
            Configura <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusButton({ active, color, icon, label, onClick }: { active: boolean, color: string, icon: any, label: string, onClick: () => void }) {
  const colors: any = {
    emerald: active ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5',
    amber: active ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/5',
    slate: active ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-500/5'
  };

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${active ? 'border-transparent shadow-lg' : 'border-slate-800'} ${colors[color]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ContestSubStat({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="space-y-1">
      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">{label}</span>
      <span className="text-sm font-bold text-slate-300">{value}</span>
    </div>
  );
}

function GlobalStat({ label, value, icon, trend }: { label: string, value: string, icon: any, trend?: string }) {
  return (
    <div className="bg-card-bg p-5 sm:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-sky-500/30 transition-all">
      <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <TrendingUp size={64} className="sm:size-[80px]" />
      </div>
      <div className="flex justify-between items-start mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
          {icon}
        </div>
        {trend && (
           <span className="text-[8px] sm:text-[9px] font-black text-emerald-500 flex items-center gap-1">
             {trend}
           </span>
        )}
      </div>
      <div>
        <h4 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</h4>
        <div className="text-xl sm:text-3xl font-black text-white italic tracking-tighter uppercase">{value}</div>
      </div>
    </div>
  );
}

