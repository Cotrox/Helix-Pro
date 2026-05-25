/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  Settings as SettingsIcon, 
  History, 
  Download, 
  Upload,
  Layers,
  Database,
  Target,
  Menu,
  X,
  ArrowRight
} from 'lucide-react';

import { Shooter, Session, CompetitionSettings, CATEGORIES, Tournament } from './types';
import { api } from './services/api';
import { downloadFile, STORAGE_KEYS } from './services/storageService';

import Dashboard from './components/Dashboard';
import ShooterRegistry from './components/ShooterRegistry';
import ContestManager from './components/ContestManager';
import ContestDetail from './components/ContestDetail';
import TournamentView from './components/TournamentView';

const INITIAL_SETTINGS: CompetitionSettings = {
  name: "Nuova Gara",
  startDate: new Date().toISOString().split('T')[0],
  startTime: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
  date: new Date().toLocaleDateString('it-IT'),
  eventDate: new Date().toISOString().split('T')[0],
  seriesCount: 2,
  targetsPerSeries: 5,
  seriesTargets: [5, 5],
  totalTargets: 10,
  baseEntryFee: 50,
  categoryFees: {} as any,
  combinedEntryFee: false,
  discountedFees: CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 50 }), {} as any),
  totalPrizePool: 1000,
  targetUnitCost: 2.5,
  fieldServiceCost: 0,
  drawResolution: 'd_ufficio',
  managedType: 'proprietaria',
  rankingMode: 'hits',
  prizes: [],
  isOneShot: true
};

const createNewSession = (settings: CompetitionSettings = INITIAL_SETTINGS): Session => ({
  id: crypto.randomUUID(),
  settings: { ...settings, name: settings.name || "Nuova Gara" },
  registrations: [],
  scores: [],
  barrages: [],
  status: 'active',
  createdAt: new Date().toISOString()
});

export default function App() {
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [systemHistory, setSystemHistory] = useState<{ timestamp: string, shooters: Shooter[], sessions: Session[], tournaments: Tournament[] }[]>(() => {
    const saved = localStorage.getItem('helix_pro_system_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [rollbackConfirmIdx, setRollbackConfirmIdx] = useState<number | null>(null);

  // Derived state
  const currentSession = React.useMemo(() => 
    sessions.find(s => s.id === selectedSessionId) || (sessions.length > 0 ? sessions[0] : null),
  [sessions, selectedSessionId]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialDetailTab, setInitialDetailTab] = useState<string | undefined>(undefined);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('helix_pro_splash_shown');
    }
    return true;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('helix_pro_splash_shown', 'true');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedShooters, loadedSessions, loadedTournaments]: [any[], any[], any[]] = await Promise.all([
          api.fetchShooters(),
          api.fetchSessions(),
          api.fetchTournaments()
        ]);
        
        // Sanitize IDs to strings
        const sanitizedShooters = loadedShooters.map(s => ({ ...s, id: String(s.id) }));
        const sanitizedSessions = loadedSessions.map(s => ({ 
          ...s, 
          id: String(s.id),
          registrations: (s.registrations || []).filter(Boolean).map((r: any) => ({ ...r, id: String(r.id), shooterId: String(r.shooterId) })),
          scores: (s.scores || []).filter(Boolean).map((sc: any) => ({ ...sc, shooterId: String(sc.shooterId) })),
          barrages: (s.barrages || []).filter(Boolean).map((b: any) => ({ 
            ...b, 
            id: String(b.id),
            participants: (b.participants || []).filter(Boolean).map((p: any) => String(p))
          }))
        }));
        const sanitizedTournaments = loadedTournaments.map(t => ({ ...t, id: String(t.id) }));

        setShooters(sanitizedShooters);
        setSessions(sanitizedSessions);
        setTournaments(sanitizedTournaments);
        
        // Use ID for selection
        const savedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT);
        if (savedCurrent) {
          const parsed = JSON.parse(savedCurrent);
          const found = sanitizedSessions.find(s => s.id === parsed.id);
          if (found) {
            setSelectedSessionId(found.id);
          } else if (sanitizedSessions.length > 0) {
            setSelectedSessionId(sanitizedSessions[0].id);
          }
        } else if (sanitizedSessions.length > 0) {
          setSelectedSessionId(sanitizedSessions[0].id);
        }
      } catch (error) {
        toast.error('Errore nel caricamento dei dati dal server');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Persistence to Server
  useEffect(() => {
    if (isInitialMount.current) {
        if (!isLoading) isInitialMount.current = false;
        return;
    }
    
    const saveData = async () => {
        try {
            await Promise.all([
                api.saveShooters(shooters),
                api.saveSessions(sessions),
                api.saveTournaments(tournaments)
            ]);
            if (currentSession) {
              localStorage.setItem(STORAGE_KEYS.CURRENT, JSON.stringify(currentSession));
            } else {
              localStorage.removeItem(STORAGE_KEYS.CURRENT);
            }
        } catch (error) {
            console.error('Save failed', error);
        }
    };
    
    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [shooters, sessions, tournaments, currentSession, isLoading]);

  // Snapshot on mount (first access of browser session)
  useEffect(() => {
    if (!isLoading && shooters.length > 0 && !sessionStorage.getItem('helix_pro_snapshot_taken')) {
        const newSnapshot = {
            timestamp: new Date().toISOString(),
            shooters: JSON.parse(JSON.stringify(shooters)),
            sessions: JSON.parse(JSON.stringify(sessions)),
            tournaments: JSON.parse(JSON.stringify(tournaments))
        };
        setSystemHistory(prev => [newSnapshot, ...prev].slice(0, 3));
      sessionStorage.setItem('helix_pro_snapshot_taken', 'true');
    }
  }, [isLoading, shooters.length]);

  // Persist history
  useEffect(() => {
    localStorage.setItem('helix_pro_system_history', JSON.stringify(systemHistory));
  }, [systemHistory]);

  const handleUpdateSessionById = (id: string, updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleRollbackSystem = (index: number) => {
    const snapshot = systemHistory[index];
    if (!snapshot) return;

    setShooters(snapshot.shooters);
    setSessions(snapshot.sessions);
    setTournaments(snapshot.tournaments);
    
    // Remove the applied snapshot and everything before it to keep it clean? 
    // Actually the user said "tornando ai dati precedenti", usually it's better to keep it but users might want to clear it.
    // I'll keep it for now but the UI will show it can be reverted.
    toast.success('Sistema ripristinato alla versione del ' + new Date(snapshot.timestamp).toLocaleString('it-IT'));
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const remaining = prev.filter((s: Session) => s.id !== id);
      
      if (selectedSessionId === id) {
        if (remaining.length > 0) {
          setSelectedSessionId(remaining[0].id);
        } else {
          setSelectedSessionId(null);
          setActiveTab('contests');
        }
      }

      return remaining;
    });
    
    toast.success('Gara eliminata correttamente');
  };

  const handleSwitchSession = (sessionId: string, subTab?: string) => {
    setSelectedSessionId(sessionId);
    setInitialDetailTab(subTab);
    setActiveTab('contests');
    const session = sessions.find(s => s.id === sessionId);
    if (session) toast.success(`Gara selezionata: ${session.settings.name}`);
  };

  const handleCreateNewSession = (managedType: 'proprietaria' | 'delegata') => {
    const newSession = createNewSession({
      ...INITIAL_SETTINGS,
      managedType
    });
    setSessions(prev => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    toast.success(`Nuova gara ${managedType} creata`);
  };

  const handleCloneSession = (sessionId: string) => {
    const sessionToClone = sessions.find(s => s.id === sessionId);
    if (!sessionToClone) return;

    const clonedSession: Session = {
      ...sessionToClone,
      id: crypto.randomUUID(),
      settings: {
        ...sessionToClone.settings,
        name: `${sessionToClone.settings.name} (Copia)`,
        date: new Date().toLocaleDateString('it-IT')
      },
      registrations: sessionToClone.registrations.map(r => ({ ...r, id: crypto.randomUUID(), paid: false })),
      scores: [],
      barrages: [],
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setSessions([clonedSession, ...sessions]);
    toast.success(`Gara clonata: ${clonedSession.settings.name}`);
  };

  const exportState = () => {
    try {
      const data = {
        shooters,
        sessions,
        tournaments,
        selectedSessionId
      };
      downloadFile(JSON.stringify(data, null, 2), `helix_pro_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success('Backup scaricato correttamente');
    } catch (error) {
      toast.error('Errore durante l\'export');
    }
  };

  const importState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.shooters) setShooters(data.shooters);
        if (data.sessions) setSessions(data.sessions);
        if (data.tournaments) setTournaments(data.tournaments);
        if (data.selectedSessionId) setSelectedSessionId(data.selectedSessionId);
        toast.success('Dati importati con successo');
      } catch (err) {
        toast.error('Errore nell\'importazione del file');
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'dashboard', label: 'Pannello', icon: LayoutDashboard },
    { id: 'shooters', label: 'Anagrafica', icon: Users },
    { id: 'tournaments', label: 'Tornei', icon: Layers },
    { id: 'contests', label: 'Gare', icon: SettingsIcon },
  ];

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-brand-bg flex flex-col items-center justify-center space-y-4">
        <Database className="text-sky-500 animate-pulse" size={48} />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] animate-pulse">Inizializzazione Database...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-brand-bg text-slate-200 font-sans overflow-hidden">
      <Toaster position="top-right" richColors theme="dark" />
      
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] bg-[#0F172A] flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none"></div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center gap-8 relative z-10"
            >
              <div className="w-32 h-32 bg-gradient-to-br from-sky-400 to-sky-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-sky-500/30 rotate-12 group">
                <Target size={64} className="text-white -rotate-12 transition-transform duration-500" strokeWidth={2.5} />
              </div>
              <div className="text-center space-y-3">
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
                  Helix <span className="text-sky-400">Pro</span>
                </h1>
                <div className="flex items-center gap-2 justify-center">
                   <div className="h-px w-8 bg-slate-800"></div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Management System</p>
                   <div className="h-px w-8 bg-slate-800"></div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-16 flex flex-col items-center gap-4"
            >
               <div className="flex gap-1">
                 {[0, 1, 2].map((i) => (
                   <motion.div
                     key={i}
                     animate={{ opacity: [0.2, 1, 0.2] }}
                     transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                     className="w-1.5 h-1.5 rounded-full bg-sky-500"
                   />
                 ))}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140]"
          />
        )}
      </AnimatePresence>

      {/* Left Navigation Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-card-bg border-r border-slate-800 flex flex-col z-[150] shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-sky rounded flex items-center justify-center font-black text-white shadow-lg shadow-sky-900/20">
              <Target size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white leading-none uppercase italic">Helix Pro</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Management System</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto high-density-scroll">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'contests') setSelectedSessionId(null);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id 
                ? 'bg-sky-600/20 text-sky-400 border border-sky-500/20 shadow-sm' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-sky-400' : 'text-slate-500'} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage</span>
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Local Active</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportState} 
              className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-400 hover:bg-slate-800 hover:text-white px-2 py-2.5 rounded border border-slate-700 transition uppercase tracking-tighter"
              title="Backup Completo"
            >
              <Download size={12} /> BACKUP
            </button>
            <label 
              className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-400 hover:bg-slate-800 hover:text-white px-2 py-2.5 rounded border border-slate-700 cursor-pointer transition uppercase tracking-tighter"
              title="Importa Backup"
            >
              <Upload size={12} /> IMPORT
              <input type="file" className="hidden" onChange={importState} accept=".json" />
            </label>
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="px-2.5 py-2.5 bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition rounded border border-slate-700 transition-all flex items-center justify-center"
              title="Storico Sistema"
            >
              <History size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Header / Stats Bar */}
        <header className="h-20 bg-brand-bg border-b border-slate-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-sm lg:text-xl font-bold text-white tracking-tight truncate max-w-[150px] lg:max-w-none">
                {currentSession ? currentSession.settings.name : "Nessuna Gara Attiva"}
              </h1>
              {currentSession && (
                <p className="text-[10px] lg:text-xs text-slate-400 flex items-center gap-1 lg:gap-2 font-medium">
                  <span className="flex items-center gap-1">
                    <History size={10} className="lg:w-3 lg:h-3" /> {currentSession.settings.startDate ? new Date(currentSession.settings.startDate).toLocaleDateString('it-IT') : (currentSession.settings.eventDate || currentSession.settings.date)}
                  </span>
                  <span className="text-slate-700 hidden sm:inline">|</span>
                  <span className="text-sky-400 font-bold hidden sm:inline">{currentSession.registrations.length} Tiratori</span>
                </p>
              )}
            </div>
          </div>
          
          {currentSession && (
            <div className="flex items-center gap-4 lg:gap-8">
              <div className="text-right hidden sm:block">
                <p className="text-[8px] lg:text-[10px] text-slate-500 uppercase font-black tracking-widest">Montepremi</p>
                <p className="text-sm lg:text-xl font-mono font-bold text-emerald-400 italic font-mono">€ {currentSession.settings.totalPrizePool.toLocaleString('it-IT')}</p>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${currentSession.status === 'active' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-600'} animate-pulse`}></div>
                <span className="text-[8px] lg:text-[10px] font-bold uppercase text-slate-500 tracking-tighter">Live ID: {currentSession.id.slice(0, 4)}</span>
              </div>
            </div>
          )}
        </header>

        {/* Content View */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto high-density-scroll relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'dashboard' && (
                currentSession ? (
                  <Dashboard 
                    currentSession={currentSession} 
                    sessions={sessions}
                    onUpdateStatus={handleUpdateSessionById}
                    onNavigate={handleSwitchSession}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-700">
                      <LayoutDashboard size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Benvenuto su Helix Pro</h3>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto uppercase font-bold tracking-widest leading-relaxed">
                        Inizia creando la tua prima gara o importando un backup.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('contests')}
                      className="bg-sky-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-sky-900/20 hover:bg-sky-500 transition-all flex items-center gap-3"
                    >
                      Vai a Gestione Gare <ArrowRight size={16} />
                    </button>
                  </div>
                )
              )}
              {activeTab === 'shooters' && (
                <ShooterRegistry shooters={shooters} onUpdate={setShooters} />
              )}
              {activeTab === 'tournaments' && (
                <TournamentView
                  tournaments={tournaments}
                  onUpdateTournaments={setTournaments}
                  sessions={sessions}
                  shooters={shooters}
                />
              )}
              {activeTab === 'contests' && (
                selectedSessionId ? (
                  <ContestDetail 
                    key={selectedSessionId}
                    session={sessions.find(s => s.id === selectedSessionId)!}
                    shooters={shooters}
                    tournaments={tournaments}
                    allSessions={sessions}
                    initialTab={initialDetailTab}
                    onUpdateSession={(updates) => handleUpdateSessionById(selectedSessionId, updates)}
                    onDeleteSession={() => handleDeleteSession(selectedSessionId)}
                    onBack={() => setSelectedSessionId(null)}
                  />
                ) : (
                  <ContestManager 
                    tournaments={tournaments}
                    sessions={sessions}
                    onSelect={handleSwitchSession}
                    onCreate={handleCreateNewSession}
                    onClone={handleCloneSession}
                    onDelete={handleDeleteSession}
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Console Footer */}
        <footer className="h-10 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex gap-6 text-[9px] text-slate-500 font-bold uppercase tracking-widest">
            <span className="hover:text-slate-300 cursor-help transition-colors">[F1] AIUTO</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">[S] SALVA JSON</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">[R] REFRESH</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">Local DB Synced</span>
          </div>
        </footer>
      </main>

      {/* History / Rollback Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center">
                  <History className="text-sky-500" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Storico Sistema</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Backup automatici all'accesso</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowHistoryModal(false); setRollbackConfirmIdx(null); }}
                className="p-2 text-slate-500 hover:text-white transition bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {rollbackConfirmIdx !== null ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-4">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mx-auto">
                      <History size={24} />
                    </div>
                    <div className="text-center space-y-2">
                       <h4 className="text-sm font-black text-white uppercase tracking-widest">Conferma Ripristino</h4>
                       <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                         Stai per ripristinare il sistema alla versione del <br/>
                         <span className="text-amber-500 font-black">
                           {new Date(systemHistory[rollbackConfirmIdx].timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                         </span>
                       </p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                         Tutti i dati correnti (tiratori, gare, tornei) verranno sovrascritti e non sarà possibile annullare l'operazione.
                       </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setRollbackConfirmIdx(null)}
                      className="py-4 bg-slate-800 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={() => {
                        handleRollbackSystem(rollbackConfirmIdx);
                        setShowHistoryModal(false);
                        setRollbackConfirmIdx(null);
                      }}
                      className="py-4 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/40"
                    >
                      Sì, Ripristina
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {systemHistory.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                      <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-700">
                        <History size={24} />
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nessun backup disponibile</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {systemHistory.map((h, idx) => (
                        <div 
                          key={idx}
                          className="group flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/5 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-[10px] font-black text-sky-500 font-mono border border-slate-700 shadow-inner">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-200 uppercase tracking-tight">
                                {new Date(h.timestamp).toLocaleDateString('it-IT')}
                              </p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                Ore {new Date(h.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} • {h.sessions.length} Gare
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setRollbackConfirmIdx(idx)}
                            className="px-4 py-2 bg-sky-600/10 text-sky-400 border border-sky-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-sky-600 hover:text-white transition-all shadow-lg active:scale-95"
                          >
                            Dettagli
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl">
                    <p className="text-[9px] text-sky-500/80 font-medium leading-relaxed italic">
                      * Il sistema salva automaticamente uno stato completo ad ogni primo accesso della sessione browser.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-950/30 border-t border-slate-800">
               <button 
                onClick={() => { setShowHistoryModal(false); setRollbackConfirmIdx(null); }}
                className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
