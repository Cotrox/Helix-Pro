import { Trash2, Edit2, Download, UserPlus, Users, FileUp, Search, X } from 'lucide-react';
import { Shooter, CATEGORIES, ShooterCategory } from '../types';
import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';

interface Props {
  shooters: Shooter[];
  onUpdate: (shooters: Shooter[]) => void;
}

export default function ShooterRegistry({ shooters, onUpdate }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<Shooter>>({ category: 'Men' });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
