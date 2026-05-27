import { Trash2, Edit2, Download, UserPlus, Users, FileUp, Search, X, BarChart2, TrendingUp, Trophy, Target, Percent, Calendar, AlertCircle } from 'lucide-react';
import { Shooter, CATEGORIES, ShooterCategory, Session, Tournament } from '../types';
import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';

interface Props {
  shooters: Shooter[];
  onUpdate: (shooters: Shooter[]) => void;
  sessions?: Session[];
  tournaments?: Tournament[];
}

export default function ShooterRegistry({ shooters, onUpdate, sessions = [], tournaments = [] }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<Shooter>>({ category: 'Men' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeStatsShooterId, setActiveStatsShooterId] = useState<string | null>(null);

  const statsData = useMemo(() => {
    if (!activeStatsShooterId) return null;
    
    const shooter = shooters.find(s => s.id === activeStatsShooterId);
    if (!shooter) return null;

    // 1. Gather all registrations and scores for this shooter
    const participations = sessions
      .map(s => {
        const reg = s.registrations.find(r => r.shooterId === activeStatsShooterId);
        const score = s.scores.find(sc => sc.shooterId === activeStatsShooterId);
        return { session: s, registration: reg, score };
      })
      .filter(p => p.registration !== undefined); // only where registered

    const totalRaces = participations.length;
    
    // 2. Count tournament participations
    const registeredSessionIds = new Set(participations.map(p => p.session.id));
    const tournamentIds = new Set(
      sessions
        .filter(s => s.settings.tournamentId && registeredSessionIds.has(s.id) && tournaments.some(t => t.id === s.settings.tournamentId))
        .map(s => s.settings.tournamentId)
    );
    const totalTournaments = tournamentIds.size;

    // 3. Count hits (centri), shots (lanciati), and errors (padelle)
    let totalHits = 0;
    let totalShots = 0;
    let maxScore = 0;
    
    const raceHistory = participations.map(({ session, score }) => {
      const hits = score
        ? (score.manualTotal !== null
            ? score.manualTotal
            : score.seriesScores.reduce((acc: number, val: number | null) => acc + (val || 0), 0))
        : 0;

      totalHits += hits;
      const targets = session.settings.totalTargets || 0;
      totalShots += targets;
      
      if (hits > maxScore) {
        maxScore = hits;
      }

      return {
        id: session.id,
        name: session.settings.name,
        date: session.settings.startDate || session.settings.date,
        hits,
        total: targets,
        accuracy: targets > 0 ? ((hits / targets) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalErrors = totalShots - totalHits;
    const accuracy = totalShots > 0 ? ((totalHits / totalShots) * 100).toFixed(1) : '0';
    
    // 4. Series statistics
    let totalSeries = 0;
    let totalSeriesHits = 0;
    participations.forEach(({ score }) => {
      if (score) {
        score.seriesScores.forEach(val => {
          if (val !== null) {
            totalSeries += 1;
            totalSeriesHits += val;
          }
        });
      }
    });
    const avgHitsPerSeries = totalSeries > 0 ? (totalSeriesHits / totalSeries).toFixed(1) : '0';

    return {
      shooter,
      totalRaces,
      totalTournaments,
      totalHits,
      totalShots,
      totalErrors,
      accuracy,
      maxScore,
      avgHitsPerSeries,
      raceHistory
    };
  }, [activeStatsShooterId, shooters, sessions]);

  // 1. Alphabetical sorting and filtering
  const filteredAndSortedShooters = useMemo(() => {
    return shooters
      .filter(s => {
        const query = searchQuery.toLowerCase();
        return (
          s.firstName.toLowerCase().includes(query) ||
          s.lastName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const lastCompare = a.lastName.localeCompare(b.lastName);
        if (lastCompare !== 0) return lastCompare;
        return a.firstName.localeCompare(b.firstName);
      });
  }, [shooters, searchQuery]);

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName) {
      toast.error('Nome e cognome sono obbligatori');
      return;
    }

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const category = formData.category as ShooterCategory || 'Men';

    // 4. Duplicate check
    const isDuplicate = shooters.some(s => 
      s.id !== editingId && 
      s.firstName.toLowerCase() === firstName.toLowerCase() &&
      s.lastName.toLowerCase() === lastName.toLowerCase() &&
      s.category === category
    );

    if (isDuplicate) {
      toast.error('Esiste già un tiratore con lo stesso nome, cognome e categoria');
      return;
    }

    if (editingId) {
      onUpdate(shooters.map(s => s.id === editingId ? { ...s, ...formData, firstName, lastName, category } as Shooter : s));
      toast.success('Atleta aggiornato correttamente');
    } else {
      const newShooter: Shooter = {
        id: crypto.randomUUID(),
        firstName,
        lastName,
        category,
        phone: formData.phone || '',
        email: formData.email || '',
      };
      onUpdate([...shooters, newShooter]);
      toast.success('Nuovo atleta registrato');
    }
    setEditingId(null);
    setIsAdding(false);
    setFormData({ category: 'Men' });
  };

  const handleDelete = (id: string) => {
    onUpdate(shooters.filter(s => s.id !== id));
    toast.success('Atleta rimosso dal database');
  };

  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(shooters, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ANAGRAFICA_TIRATORI_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Anagrafica esportata correttamente (.json)');
    } catch (error) {
      toast.error('Errore durante l\'esportazione');
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
          throw new Error('Formato non valido');
        }

        const newShooters: Shooter[] = data.map(item => ({
          id: item.id || crypto.randomUUID(),
          firstName: (item.firstName || '').trim(),
          lastName: (item.lastName || '').trim(),
          category: item.category || 'Men',
          phone: item.phone || '',
          email: item.email || '',
          isReserved: !!item.isReserved
        })).filter(s => s.firstName && s.lastName);

        if (newShooters.length > 0) {
          onUpdate(newShooters);
          toast.success(`${newShooters.length} tiratori importati correttamente`);
        } else {
          toast.error('Nessun dato valido trovato nel file JSON');
        }
      } catch (err) {
        toast.error('Errore nell\'importazione: il file non è un JSON valido');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 bg-[#0F172A] min-h-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl gap-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="text-sky-500" size={20} /> Anagrafica Globali
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 italic">Database permanente atleti</p>
        </div>
        <div className="flex flex-col gap-4 w-full lg:w-auto">
          {/* 2. Search functionality - Now on top */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Cerca atleta per nome o cognome..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-10 py-2.5 text-xs font-bold text-slate-200 focus:border-sky-500/50 outline-none transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* 3 buttons in a single row below search */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportJSON} 
              accept=".json" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="justify-center flex items-center gap-2 bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest border border-slate-700 shadow-xl"
              title="Importa Anagrafica (.json)"
            >
              <FileUp size={14} className="hidden sm:block" /> Importa
            </button>
            <button
              onClick={handleExportJSON}
              className="justify-center flex items-center gap-2 bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest border border-slate-700 shadow-xl"
              title="Esporta Anagrafica (.json)"
            >
              <Download size={14} className="hidden sm:block" /> Esporta
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center justify-center gap-2 bg-sky-600 text-white px-3 py-2.5 rounded-lg hover:bg-sky-500 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-sky-900/20"
            >
              <UserPlus size={16} className="hidden sm:block" /> <span className="sm:hidden">Nuovo</span><span className="hidden sm:inline">Nuovo Atleta</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Modal for editing */}
      {(isAdding || editingId) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto high-density-scroll animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                    {editingId ? 'Modifica Atleta' : 'Aggiungi Nuovo Atleta'}
                  </h3>
                  <p className="text-[8px] text-slate-500 uppercase font-black">Compila i dettagli del tiratore</p>
                </div>
                <button 
                  onClick={() => { setIsAdding(false); setEditingId(null); }}
                  className="p-2 text-slate-500 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Cognome</label>
                  <input
                    type="text"
                    placeholder="Inserisci cognome..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500/50 outline-none text-slate-200 placeholder:text-slate-700 transition"
                    value={formData.lastName || ''}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nome</label>
                  <input
                    type="text"
                    placeholder="Inserisci nome..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500/50 outline-none text-slate-200 placeholder:text-slate-700 transition"
                    value={formData.firstName || ''}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Categoria</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500/50 outline-none text-slate-200 transition appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as ShooterCategory })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Telefono</label>
                  <input
                    type="text"
                    placeholder="+39..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500/50 outline-none text-slate-200 placeholder:text-slate-700 transition"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email</label>
                  <input
                    type="email"
                    placeholder="email@esempio.com"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500/50 outline-none text-slate-200 placeholder:text-slate-700 transition"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4 justify-end pt-6 border-t border-slate-800">
                <button
                  onClick={() => { setIsAdding(false); setEditingId(null); }}
                  className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-200 transition"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  className="px-10 py-3 bg-sky-600 text-white rounded-xl hover:bg-sky-500 transition font-black text-[10px] uppercase tracking-widest shadow-xl shadow-sky-900/20"
                >
                  Conferma e Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.5 Modal for Statistics */}
      {activeStatsShooterId && statsData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto high-density-scroll animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
                    <BarChart2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                      Statistiche Atleta
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase font-black">
                      {statsData.shooter.lastName} {statsData.shooter.firstName} • Categoria: {statsData.shooter.category}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveStatsShooterId(null)}
                  className="p-2 text-slate-500 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              {statsData.totalRaces === 0 ? (
                /* Empty state */
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-slate-600">
                    <AlertCircle size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Nessun dato registrato</h4>
                    <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest max-w-xs leading-relaxed">
                      Questo atleta non ha ancora partecipato a gare o tornei. I dati appariranno una volta completata la prima iscrizione.
                    </p>
                  </div>
                </div>
              ) : (
                /* Stats present */
                <div className="space-y-6">
                  {/* Grid cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Accuracy Card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-amber-500/30 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Accuratezza</p>
                        <p className="text-xl font-black text-amber-500 font-mono italic">{statsData.accuracy}%</p>
                      </div>
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                        <svg className="w-12 h-12 rotate-[-90deg]">
                          <circle cx="24" cy="24" r="18" className="stroke-slate-800" strokeWidth="3.5" fill="transparent" />
                          <circle cx="24" cy="24" r="18" className="stroke-amber-500" strokeWidth="3.5" fill="transparent"
                            strokeDasharray={2 * Math.PI * 18}
                            strokeDashoffset={2 * Math.PI * 18 * (1 - parseFloat(statsData.accuracy) / 100)}
                            strokeLinecap="round" />
                        </svg>
                        <Percent className="absolute text-amber-500/55" size={10} />
                      </div>
                    </div>

                    {/* Presenze Card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Presenze</p>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-xl font-black text-sky-400 font-mono italic">{statsData.totalRaces}</p>
                        <span className="text-[8px] font-black uppercase text-sky-500 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                          {statsData.totalTournaments} Tornei
                        </span>
                      </div>
                    </div>

                    {/* Centri/Errori Card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Centri / Errori</p>
                      <div className="flex justify-between items-end mt-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono font-bold text-emerald-400">{statsData.totalHits} C</p>
                          <p className="text-[9px] font-mono text-rose-400">{statsData.totalErrors} E</p>
                        </div>
                        <Target className="text-emerald-500/40" size={18} />
                      </div>
                    </div>

                    {/* Record Personale Card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-purple-500/30 transition-colors">
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Record Gara (PR)</p>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-xl font-black text-purple-400 font-mono italic">{statsData.maxScore}</p>
                        <Trophy className="text-purple-500/40" size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Graph & Stats Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SVG Trend Chart */}
                    <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                          <TrendingUp size={12} className="text-amber-500" /> Trend Punteggi (Accuratezza %)
                        </h4>
                        <span className="text-[8px] font-bold text-slate-650 uppercase font-mono">
                          Ultimi {statsData.raceHistory.length} eventi
                        </span>
                      </div>
                      
                      {statsData.raceHistory.length < 2 ? (
                        <div className="h-[200px] flex items-center justify-center text-center">
                          <p className="text-[9px] text-slate-600 uppercase font-bold italic">
                            Dati insufficienti per generare il grafico. Partecipa ad almeno 2 gare.
                          </p>
                        </div>
                      ) : (
                        <div className="w-full overflow-hidden">
                          <svg className="w-full h-[200px]" viewBox="0 0 500 200" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="gradient-acc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            
                            {/* Grid Y lines */}
                            {[25, 50, 75, 100].map((level) => {
                              const y = 20 + (1 - level / 100) * 140;
                              return (
                                <g key={level}>
                                  <line x1="40" y1={y} x2="480" y2={y} className="stroke-slate-900" strokeWidth="1" strokeDasharray="4 4" />
                                  <text x="30" y={y + 3} className="fill-slate-600 font-mono text-[8px] text-right">{level}%</text>
                                </g>
                              );
                            })}

                            {/* X labels & vertical lines */}
                            {statsData.raceHistory.map((item, idx) => {
                              const x = 40 + (idx / (statsData.raceHistory.length - 1)) * 440;
                              return (
                                <g key={item.id}>
                                  <line x1={x} y1="20" x2={x} y2="160" className="stroke-slate-900" strokeWidth="1" strokeDasharray="2 2" />
                                  <text x={x} y="175" className="fill-slate-600 font-mono text-[7px] text-center" textAnchor="middle">
                                    G{idx + 1}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Area under the line */}
                            <path d={`M 40 160 L ${
                              statsData.raceHistory.map((item, idx) => {
                                const x = 40 + (idx / (statsData.raceHistory.length - 1)) * 440;
                                const accPercent = item.total > 0 ? (item.hits / item.total) * 105 : 0;
                                const y = 20 + (1 - Math.min(accPercent, 100) / 100) * 140;
                                return `${x} ${y}`;
                              }).join(' L ')
                            } L 480 160 Z`} fill="url(#gradient-acc)" />

                            {/* Line path */}
                            <path d={
                              statsData.raceHistory.map((item, idx) => {
                                const x = 40 + (idx / (statsData.raceHistory.length - 1)) * 440;
                                const accPercent = item.total > 0 ? (item.hits / item.total) * 100 : 0;
                                const y = 20 + (1 - accPercent / 100) * 140;
                                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                              }).join(' ')
                            } fill="transparent" className="stroke-amber-500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Bullet points */}
                            {statsData.raceHistory.map((item, idx) => {
                              const x = 40 + (idx / (statsData.raceHistory.length - 1)) * 440;
                              const accPercent = item.total > 0 ? (item.hits / item.total) * 100 : 0;
                              const y = 20 + (1 - accPercent / 100) * 140;
                              return (
                                <g key={`dot-${item.id}`}>
                                  <circle cx={x} cy={y} r="5" className="fill-slate-900 stroke-amber-500" strokeWidth="2" />
                                  <text x={x} y={y - 8} className="fill-white font-mono text-[8px] font-black text-center" textAnchor="middle">
                                    {item.hits}/{item.total}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Historical summary list */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 flex flex-col max-h-[260px] overflow-hidden">
                      <h4 className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1.5 shrink-0">
                        <Calendar size={12} className="text-sky-500" /> Ultime Gare
                      </h4>
                      <div className="overflow-y-auto high-density-scroll flex-1 pr-1 space-y-2">
                        {statsData.raceHistory.slice().reverse().map((item) => (
                          <div key={item.id} className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                            <div className="space-y-0.5 max-w-[150px]">
                              <p className="text-[9px] font-black text-slate-300 uppercase truncate">{item.name}</p>
                              <p className="text-[7px] text-slate-650 font-mono">{new Date(item.date).toLocaleDateString('it-IT')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-mono font-bold text-emerald-400">{item.hits} / {item.total}</p>
                              <p className="text-[8px] font-mono text-slate-500 uppercase font-black">{item.accuracy}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-4 justify-end pt-6 border-t border-slate-800">
                <button
                  onClick={() => setActiveStatsShooterId(null)}
                  className="px-8 py-3 bg-slate-800 text-slate-350 hover:text-white rounded-xl transition font-black text-[10px] uppercase tracking-widest border border-slate-700"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-x-auto no-scrollbar">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-[#2D3A4F]">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-6 py-4 border-b border-slate-700">Tiratore</th>
              <th className="px-6 py-4 border-b border-slate-700">Categoria</th>
              <th className="px-6 py-4 border-b border-slate-700">Recapiti</th>
              <th className="px-6 py-4 border-b border-slate-700 text-right">Amministrazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredAndSortedShooters.map(shooter => (
              <tr key={shooter.id} className="hover:bg-slate-800/40 transition-colors group">
                <td className="px-6 py-4 border-none font-bold text-slate-200 group-hover:text-white transition-colors">
                  <div className="text-sm tracking-tight uppercase font-black">{shooter.lastName} {shooter.firstName}</div>
                  <div className="text-[8px] text-slate-600 font-mono">UID: {String(shooter.id).slice(0, 8)}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-md text-[10px] font-black uppercase tracking-widest italic">
                    {shooter.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-[11px] text-slate-500 font-medium">
                  {shooter.phone && <div className="flex items-center gap-1"><span className="text-slate-700">P:</span> {shooter.phone}</div>}
                  {shooter.email && <div className="flex items-center gap-1 truncate max-w-[200px]"><span className="text-slate-700">E:</span> {shooter.email}</div>}
                </td>
                <td className="px-6 py-4 text-right space-x-1">
                  <button
                    type="button"
                    onClick={() => setActiveStatsShooterId(shooter.id)}
                    className="p-2 text-slate-500 hover:text-amber-500 hover:bg-amber-500/5 rounded-lg transition-all"
                    title="Visualizza statistiche atleta"
                  >
                    <BarChart2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(shooter.id); setFormData(shooter); }}
                    className="p-2 text-slate-600 hover:text-sky-400 hover:bg-sky-500/5 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(shooter.id);
                    }}
                    className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 active:scale-95"
                    title="Elimina dal database"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredAndSortedShooters.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-slate-600 uppercase font-black text-[10px] tracking-[0.3em] italic">
                   {searchQuery ? 'Nessun risultato trovato per la ricerca' : 'Database tiratori vuoto'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
