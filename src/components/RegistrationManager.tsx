import { UserPlus, Trash, CheckCircle2, Circle, ListOrdered, FileDown, Layers, Plus, Pencil, Save, X, RotateCcw, ChevronUp, ChevronDown, Printer, Search, Filter, ArrowUpDown, GripVertical } from 'lucide-react';
import { Shooter, Registration, CompetitionSettings, Tournament, Session, CATEGORIES, ShooterCategory } from '../types';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { exportToPDF, generateBibsPDF } from '../services/pdfService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  shooters: Shooter[];
  registrations: Registration[];
  settings: CompetitionSettings;
  tournaments: Tournament[];
  sessions: Session[];
  onUpdate: (registrations: Registration[]) => void;
}

type SortCriteria = 'order' | 'shooter';
type PaymentFilter = 'all' | 'paid' | 'unpaid';

export default function RegistrationManager({ shooters, registrations, settings, tournaments, sessions, onUpdate }: Props) {
  const [selectedShooterId, setSelectedShooterId] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [discountModal, setDiscountModal] = useState<{ regId: string, type: 'fixed' | 'percentage', value: number, reintegro: boolean } | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ShooterCategory[]>([]);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('order');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  // Order Management state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderMode, setOrderMode] = useState<'drag' | 'input' | 'pattern'>('drag');
  const [inputPositions, setInputPositions] = useState<Record<string, string>>({});
  const [selectedPattern, setSelectedPattern] = useState<'shift' | 'halfFlipA' | 'halfFlipB' | 'reverse' | null>(null);

  useEffect(() => {
    if (isOrderModalOpen) {
      const initial: Record<string, string> = {};
      (registrations || []).forEach(r => {
        initial[r.id] = (r.shootingOrder || '').toString();
      });
      setInputPositions(initial);
      setSelectedPattern(null);
    }
  }, [isOrderModalOpen, registrations]);

  const currentTournament = useMemo(() => 
    tournaments.find(t => t.id === settings.tournamentId), 
    [tournaments, settings.tournamentId]
  );

  const availableShooters = useMemo(() => 
    shooters.filter(s => !(registrations || []).filter(Boolean).some(r => r.shooterId === s.id)),
    [shooters, registrations]
  );

  const filteredBulkShooters = useMemo(() => 
    availableShooters.filter(s => 
      (`${s.lastName} ${s.firstName} ${s.category}`).toLowerCase().includes(bulkSearch.toLowerCase())
    ),
    [availableShooters, bulkSearch]
  );

  // 1. Helper function for calculation that can be used everywhere
  const getShooterCosts = (shooterId: string, extraDiscount?: { type: 'fixed' | 'percentage', value: number, reintegro?: boolean }) => {
    const shooter = shooters.find(s => s.id === shooterId);
    if (!shooter) return { listFee: 0, catFee: 0, effectiveCategoryFee: 0, actualFee: 0, reintegroAmount: 0 };
    
    const catFees = settings.categoryFees?.[shooter.category];
    const catStandardFee = settings.baseEntryFee; 
    const listFee = catStandardFee;
    
    // The user wants category specific fee if set, otherwise base fee.
    // "Se aggiungo per una categoria Y un prezzo riservato di N allora la categoria Y pagherà N"
    const hasCategoryOverride = catFees?.reserved !== undefined;
    const effectiveCategoryFee = hasCategoryOverride ? catFees!.reserved! : catStandardFee;
    
    let finalFee = effectiveCategoryFee;

    // Subscription discount
    let hasSubscriptionDiscount = false;
    if (currentTournament && currentTournament.subscriptionDiscount.value > 0) {
      const isSubscribedInPrev = sessions.some(s => 
        s.id !== settings.name && // Don't count current session if we're technically in it
        s.settings.tournamentId === currentTournament.id && 
        s.registrations.some(r => r.shooterId === shooterId)
      );
      if (isSubscribedInPrev) {
        hasSubscriptionDiscount = true;
        const discount = currentTournament.subscriptionDiscount;
        if (discount.type === 'fixed') {
          finalFee -= discount.value;
        } else {
          finalFee *= (1 - discount.value / 100);
        }
      }
    }

    // Extra discount
    if (extraDiscount && extraDiscount.value > 0) {
      if (extraDiscount.type === 'fixed') {
        finalFee -= extraDiscount.value;
      } else {
        finalFee *= (1 - extraDiscount.value / 100);
      }
    }

    const actualFee = Math.max(0, finalFee);
    
    // Rule: reintegro is exactly "sconto extra" + "costo agevolato (diff category fee)"
    const costoAgevolato = Math.max(0, catStandardFee - effectiveCategoryFee);
    let extraDiscountAmount = 0;
    if (extraDiscount && extraDiscount.value > 0) {
      if (extraDiscount.type === 'fixed') {
        extraDiscountAmount = extraDiscount.value;
      } else {
        extraDiscountAmount = effectiveCategoryFee * (extraDiscount.value / 100);
      }
    }
    
    const reintegroAmount = costoAgevolato + extraDiscountAmount;
    
    return { listFee, catFee: catStandardFee, effectiveCategoryFee, actualFee, reintegroAmount, hasSubscriptionDiscount };
  };

  const getDynamicCosts = (reg: Registration) => {
    return getShooterCosts(reg.shooterId, reg.extraDiscount);
  };

  const syncCosts = () => {
    const updatedRegs = (registrations || []).filter(Boolean).map(reg => {
      const { catFee, actualFee, reintegroAmount } = getDynamicCosts(reg);
      
      return {
        ...reg,
        actualFee,
        reintegroAmount,
        needsReintegro: reintegroAmount > 0,
        hasDiscount: actualFee < catFee
      };
    });
    
    if (JSON.stringify(updatedRegs) !== JSON.stringify(registrations)) {
      onUpdate(updatedRegs);
    }
  };

  useEffect(() => {
    syncCosts();
  }, [settings, shooters, tournaments, sessions]);

  const handleAddRegistration = () => {
    if (!selectedShooterId) return;
    const shooter = shooters.find(s => s.id === selectedShooterId);
    if (!shooter) return;

    const { actualFee, catFee, reintegroAmount } = getShooterCosts(selectedShooterId);

    const newRegistration: Registration = {
      id: crypto.randomUUID(),
      shooterId: selectedShooterId,
      paid: false,
      hasDiscount: actualFee < catFee,
      isReserved: shooter.isReserved || false,
      actualFee,
      needsReintegro: reintegroAmount > 0,
      reintegroAmount,
      spareggioCost: 0,
      shootingOrder: registrations.length + 1
    };

    onUpdate([...registrations, newRegistration]);
    setSelectedShooterId('');
    toast.success(`${shooter.lastName} ${shooter.firstName} iscritto alla gara`);
  };

  const moveRegistration = (id: string, direction: 'up' | 'down') => {
    const sorted = [...(registrations || [])].filter(Boolean).sort((a, b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));
    const index = sorted.findIndex(r => r.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      const newOrder = [...sorted];
      const temp = newOrder[index].shootingOrder;
      newOrder[index].shootingOrder = newOrder[index-1].shootingOrder;
      newOrder[index-1].shootingOrder = temp;
      onUpdate(newOrder);
    } else if (direction === 'down' && index < sorted.length - 1) {
      const newOrder = [...sorted];
      const temp = newOrder[index].shootingOrder;
      newOrder[index].shootingOrder = newOrder[index+1].shootingOrder;
      newOrder[index+1].shootingOrder = temp;
      onUpdate(newOrder);
    }
  };

  const handleMassRegister = () => {
    if (bulkSelection.length === 0) return;

    const newRegs = bulkSelection.map((sid, idx) => {
      const shooter = shooters.find(s => s.id === sid)!;
      const { actualFee, catFee, reintegroAmount } = getShooterCosts(sid);

      return {
        id: crypto.randomUUID(),
        shooterId: sid,
        paid: false,
        hasDiscount: actualFee < catFee,
        isReserved: shooter.isReserved || false,
        actualFee,
        needsReintegro: reintegroAmount > 0,
        reintegroAmount,
        spareggioCost: 0,
        shootingOrder: registrations.length + idx + 1
      };
    });

    onUpdate([...registrations, ...newRegs]);
    setIsBulkAdding(false);
    setBulkSelection([]);
    toast.success(`${newRegs.length} tiratori iscritti in massa`);
  };

  const toggleBulkSelection = (id: string) => {
    setBulkSelection(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const generateShootingOrder = () => {
    if ((registrations || []).length === 0) return;

    let newRegs = [...(registrations || [])].filter(Boolean);
    
    // Check if we need the tournament specific logic
    const prevTournamentSession = currentTournament 
      ? sessions.filter(s => s.settings.tournamentId === currentTournament.id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
      : null;

    if (currentTournament && prevTournamentSession && prevTournamentSession.id !== settings.name /* simple check for same session */) {
      const prevRegs = [...prevTournamentSession.registrations].sort((a,b) => a.shootingOrder - b.shootingOrder);
      const midpoint = Math.ceil(prevRegs.length/2);
      
      const specialOrder: string[] = [];
      for (let i = midpoint - 1; i < prevRegs.length; i++) {
        specialOrder.push(prevRegs[i].shooterId);
      }
      for (let i = midpoint - 2; i >= 0; i--) {
        specialOrder.push(prevRegs[i].shooterId);
      }

      const inBoth = newRegs.filter(r => specialOrder.includes(r.shooterId));
      const notInBoth = newRegs.filter(r => !specialOrder.includes(r.shooterId));

      const sortedInBoth = inBoth.sort((a, b) => {
        return specialOrder.indexOf(a.shooterId) - specialOrder.indexOf(b.shooterId);
      });

      const finalOrder = [...sortedInBoth, ...notInBoth];
      newRegs = finalOrder.map((r, idx) => ({ ...r, shootingOrder: idx + 1 }));
      
      toast.success('Ordine di Tiro generato con logica Torneo (Seconda Gara)');
    } else {
      for (let i = newRegs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newRegs[i], newRegs[j]] = [newRegs[j], newRegs[i]];
      }
      newRegs = newRegs.map((r, idx) => ({ ...r, shootingOrder: idx + 1 }));
      toast.success('Ordine di Tiro generato casualmente');
    }

    onUpdate(newRegs);
  };

  const handleExportPDF = () => {
    const headers = ['Pettorale', 'Tiratore', 'Categoria', 'Costo Standard', 'Sconto Cat.', 'Sconto Extra', 'Costo Iscr.', 'Serv. Campo', 'TOTALE'];
    const sortedRegs = [...(registrations || [])].filter(Boolean).sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));
    const data = sortedRegs.map(reg => {
      const shooter = shooters.find(s => s.id === reg.shooterId);
      const fieldServiceCost = settings.fieldServiceCost || ((settings.targetUnitCost || 0) * (settings.totalTargets || 0));
      
      const costs = getDynamicCosts(reg);
      const catDiscount = costs.catFee - (costs.effectiveCategoryFee);
      const extraDiscount = (reg.extraDiscount && reg.extraDiscount.value > 0) 
        ? (reg.extraDiscount.type === 'fixed' ? reg.extraDiscount.value : (costs.effectiveCategoryFee * reg.extraDiscount.value / 100))
        : 0;

      return [
        (reg.shootingOrder || '-').toString(),
        shooter ? `${shooter.lastName} ${shooter.firstName}` : 'N/A',
        shooter?.category || 'N/A',
        `€${costs.catFee.toFixed(2)}`,
        `€${catDiscount.toFixed(2)}`,
        `€${extraDiscount.toFixed(2)}`,
        `€${reg.actualFee.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        `€${fieldServiceCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        `€${(reg.actualFee + fieldServiceCost).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
      ];
    });

    exportToPDF('Elenco Iscritti Gara', headers, data, `iscrizioni_${settings.name.replace(/\s+/g, '_')}.pdf`, settings);
    toast.success('PDF iscrizioni generato');
  };

  const removeRegistration = (id: string) => {
    const reg = registrations.find(r => r.id === id);
    const shooter = shooters.find(s => s.id === reg?.shooterId);
    onUpdate(registrations.filter(r => r.id !== id));
    toast.info(`Iscrizione di ${shooter?.lastName} rimossa`);
  };

  const togglePaid = (id: string) => {
    const reg = registrations.find(r => r.id === id);
    onUpdate(registrations.map(r => r.id === id ? { ...r, paid: !r.paid } : r));
    if (reg) {
      toast.success(reg.paid ? 'Pagamento annullato' : 'Saldato correttamente');
    }
  };

  const handleSaveExtraDiscount = () => {
    if (!discountModal) return;
    onUpdate(registrations.map(r => 
      r.id === discountModal.regId 
        ? { ...r, extraDiscount: { type: discountModal.type, value: discountModal.value, reintegro: discountModal.reintegro } } 
        : r
    ));
    setDiscountModal(null);
    toast.success('Sconto extra applicato');
  };

  const resetOrder = () => {
    const resetRegs = [...registrations].sort((a, b) => a.id.localeCompare(b.id)).map((r, idx) => ({
      ...r,
      shootingOrder: idx + 1
    }));
    onUpdate(resetRegs);
    toast.success('Ordine rimpistinato (per iscrizione)');
  };

  const handleConfirmInputOrder = () => {
    const N = registrations.length;
    const parsed: Record<string, number> = {};

    for (const reg of registrations) {
      const valStr = inputPositions[reg.id];
      if (valStr === undefined || valStr === null || valStr.trim() === '') {
        toast.error('Inserisci una posizione valida per tutti i tiratori');
        return;
      }
      const val = parseInt(valStr, 10);
      if (isNaN(val) || val.toString() !== valStr.trim()) {
        toast.error('Le posizioni inserite devono essere numeri interi');
        return;
      }
      if (val < 1 || val > N) {
        toast.error(`Le posizioni devono essere comprese tra 1 e ${N}`);
        return;
      }
      parsed[reg.id] = val;
    }

    const values = Object.values(parsed);
    const unique = new Set(values);
    if (unique.size !== values.length) {
      toast.error('Ci sono posizioni duplicate. Ogni tiratore deve avere una posizione univoca');
      return;
    }

    const updatedRegs = registrations.map(reg => ({
      ...reg,
      shootingOrder: parsed[reg.id]
    }));

    updatedRegs.sort((a, b) => a.shootingOrder - b.shootingOrder);
    onUpdate(updatedRegs);
    toast.success('Ordine di tiro aggiornato con successo');
    setIsOrderModalOpen(false);
  };

  const handleApplyPattern = () => {
    if (!selectedPattern) {
      toast.error('Seleziona un pattern prima di confermare');
      return;
    }

    const sortedRegs = [...registrations].sort((a, b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));
    if (sortedRegs.length === 0) return;

    let newRegs = [...sortedRegs];

    switch (selectedPattern) {
      case 'shift': {
        newRegs = [...sortedRegs.slice(1), sortedRegs[0]];
        break;
      }
      case 'halfFlipA': {
        const mid = Math.ceil(sortedRegs.length / 2);
        newRegs = [...sortedRegs.slice(mid), ...sortedRegs.slice(0, mid)];
        break;
      }
      case 'halfFlipB': {
        const mid = Math.ceil(sortedRegs.length / 2);
        const firstHalf = sortedRegs.slice(0, mid);
        const secondHalf = sortedRegs.slice(mid);
        newRegs = [...secondHalf, ...[...firstHalf].reverse()];
        break;
      }
      case 'reverse': {
        newRegs = [...sortedRegs].reverse();
        break;
      }
    }

    const updated = newRegs.map((r, idx) => ({
      ...r,
      shootingOrder: idx + 1
    }));

    onUpdate(updated);
    toast.success('Pattern applicato con successo');
    setIsOrderModalOpen(false);
  };

  const handleDragEndOrder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = registrations.findIndex((r) => r.id === active.id);
      const newIndex = registrations.findIndex((r) => r.id === over.id);
      
      const newArray = arrayMove(registrations, oldIndex, newIndex).map((r, idx) => ({
        ...r,
        shootingOrder: idx + 1
      }));
      onUpdate(newArray);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredRegistrations = useMemo(() => {
    let result = [...(registrations || [])].filter(Boolean);

    // 1. Filter by search query
    if (searchQuery) {
      result = result.filter(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        if (!shooter) return false;
        return (shooter.firstName + ' ' + shooter.lastName).toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // 2. Filter by category
    if (selectedCategories.length > 0) {
      result = result.filter(reg => {
        const shooter = shooters.find(s => s.id === reg.shooterId);
        return shooter && selectedCategories.includes(shooter.category);
      });
    }

    // 3. Filter by payment
    if (paymentFilter !== 'all') {
      result = result.filter(reg => paymentFilter === 'paid' ? reg.paid : !reg.paid);
    }

    // 4. Sort
    if (sortCriteria === 'order') {
      result.sort((a, b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));
    } else {
      result.sort((a, b) => {
        const sA = shooters.find(s => s.id === a.shooterId);
        const sB = shooters.find(s => s.id === b.shooterId);
        if (!sA || !sB) return 0;
        return (sA.lastName + ' ' + sA.firstName).localeCompare(sB.lastName + ' ' + sB.firstName);
      });
    }

    return result;
  }, [registrations, shooters, searchQuery, selectedCategories, paymentFilter, sortCriteria]);

  return (
    <div className="p-4 sm:p-8 space-y-6 bg-brand-bg h-full overflow-y-auto high-density-scroll">
      {/* Search and Filters Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-card-bg p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl gap-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="text-sky-500" size={20} /> Iscrizioni
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 italic">Gestione tiratori gara attiva</p>
        </div>
        <div className="flex flex-col gap-3 w-full xl:w-auto">
          {/* Row 1: Registration Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full">
            <div className="flex-1 sm:flex-none sm:w-[250px]">
              <select
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                value={selectedShooterId}
                onChange={e => setSelectedShooterId(e.target.value)}
              >
                <option value="" className="text-slate-600 italic">Seleziona...</option>
                {availableShooters.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900">{s.lastName} {s.firstName} ({s.category})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddRegistration}
              className="flex-1 sm:flex-none justify-center bg-sky-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-sky-500 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-sky-900/20 flex items-center gap-2"
            >
              <UserPlus size={16} /> Iscrivi
            </button>
            <button
              onClick={() => setIsBulkAdding(true)}
              className="flex-1 sm:flex-none justify-center bg-emerald-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-emerald-500 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 flex items-center gap-2"
            >
              <Layers size={16} /> Massa
            </button>
            <button
              onClick={() => setIsOrderModalOpen(true)}
              className="flex-1 sm:flex-none justify-center bg-amber-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-amber-500 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-amber-900/20 flex items-center gap-2"
            >
              <ListOrdered size={16} /> Ordine
            </button>
          </div>

          {/* Row 2: Export Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full">
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none justify-center bg-slate-800 text-slate-200 border border-slate-700 px-4 sm:px-6 py-2 rounded-lg hover:bg-slate-700 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2"
            >
              <FileDown size={16} /> PDF
            </button>
            <button
              onClick={() => generateBibsPDF(shooters, registrations, settings)}
              className="flex-1 sm:flex-none justify-center bg-slate-800 text-amber-500 border border-slate-700 px-4 sm:px-6 py-2 rounded-lg hover:border-amber-500/50 transition font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2"
              title="Pettorali"
            >
              <Printer size={16} /> Pettorali
            </button>
          </div>
        </div>
      </div>

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
              selectedCategories.length > 0 || paymentFilter !== 'all' || sortCriteria !== 'order'
                ? 'bg-sky-500 border-sky-400 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Filter size={18} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Filtra</span>
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Filter className="text-sky-500" size={18} /> Filtri e Ordinamento
              </h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] high-density-scroll">
              {/* Payment Filter */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Stato Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'paid', 'unpaid'] as PaymentFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setPaymentFilter(f)}
                      className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                        paymentFilter === f 
                          ? 'bg-sky-500 border-sky-400 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {f === 'all' ? 'Tutti' : f === 'paid' ? 'Pagati' : 'Da Pagare'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Criteria */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Criterio Ordinamento Elenco</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSortCriteria('order')}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center justify-center gap-2 ${
                      sortCriteria === 'order' 
                        ? 'bg-sky-500 border-sky-400 text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <ListOrdered size={12} /> Per Ordine di Tiro
                  </button>
                  <button
                    onClick={() => setSortCriteria('shooter')}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center justify-center gap-2 ${
                      sortCriteria === 'shooter' 
                        ? 'bg-sky-500 border-sky-400 text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <ArrowUpDown size={12} /> Per Tiratore (A-Z)
                  </button>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categorie</label>
                  <button 
                    onClick={() => setSelectedCategories([])}
                    className="text-[9px] text-sky-500 font-bold uppercase"
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
                        selectedCategories.includes(cat) ? 'bg-sky-500 border-sky-500' : 'border-slate-700'
                      }`}>
                        {selectedCategories.includes(cat) && <CheckCircle2 size={10} className="text-white" />}
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

      {/* Order Management Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <ListOrdered className="text-amber-500" size={18} /> Gestione Ordine di Tiro
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Personalizza o rigenera la sequenza</p>
              </div>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { generateShootingOrder(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-amber-600/10 hover:border-amber-500/50 transition-all group"
                >
                  <ArrowUpDown className="text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-amber-500 text-center">Genera Casuale / Torneo</span>
                </button>
                <button 
                  onClick={() => { resetOrder(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-sky-600/10 hover:border-sky-500/50 transition-all group"
                >
                  <RotateCcw className="text-sky-500 group-hover:rotate-[-45deg] transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-sky-500 text-center">Ripristina Default (Iscrizione)</span>
                </button>
              </div>

              {/* Reordering Mode Tabs */}
              <div className="flex border border-slate-800 bg-slate-950/30 p-1 rounded-xl gap-1">
                {(['drag', 'input', 'pattern'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setOrderMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      orderMode === mode 
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-md font-black' 
                        : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/30 font-bold'
                    }`}
                  >
                    {mode === 'drag' ? 'Drag & Drop' : mode === 'input' ? 'Riordina da Input' : 'Riordina da Pattern'}
                  </button>
                ))}
              </div>

              {orderMode === 'drag' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Riordina Manualmente (Drag & Drop)</label>
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-2 max-h-[300px] overflow-y-auto high-density-scroll">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndOrder}
                    >
                      <SortableContext 
                        items={registrations.map(r => r.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1">
                          {registrations.map(reg => (
                            <SortableItem key={reg.id} reg={reg} shooter={shooters.find(s => s.id === reg.shooterId)} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}

              {orderMode === 'input' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Inserisci le posizioni numeriche</label>
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-2 max-h-[300px] overflow-y-auto high-density-scroll space-y-1">
                    {[...registrations].sort((a, b) => (a.shootingOrder || 0) - (b.shootingOrder || 0)).map((reg, idx) => {
                      const shooter = shooters.find(s => s.id === reg.shooterId);
                      return (
                        <div 
                          key={reg.id} 
                          className="flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-amber-500 font-mono border border-slate-700 shadow-inner">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-slate-200 uppercase truncate">
                              {shooter?.lastName} {shooter?.firstName}
                            </div>
                            <div className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">
                              {shooter?.category}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Posizione:</span>
                            <input
                              type="text"
                              value={inputPositions[reg.id] || ''}
                              onChange={e => setInputPositions(prev => ({ ...prev, [reg.id]: e.target.value }))}
                              placeholder={(idx + 1).toString()}
                              className="w-14 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-xs font-mono font-bold text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orderMode === 'pattern' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Seleziona Pattern di Riordinamento</label>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto high-density-scroll pr-1">
                    {[
                      {
                        id: 'shift',
                        name: 'Slittamento Circolare (Shift)',
                        desc: 'Ogni tiratore avanza di una posizione nella lista. Chi era primo diventa l\'ultimo.',
                        example: 'Esempio: [1, 2, 3, 4, 5, 6] → [2, 3, 4, 5, 6, 1]'
                      },
                      {
                        id: 'halfFlipA',
                        name: 'Inversione per Blocchi Alpha (Half-Flip-A)',
                        desc: 'La lista viene divisa in due metà; le due metà si scambiano di posto.',
                        example: 'Esempio: [1, 2, 3, 4, 5, 6] → [4, 5, 6, 1, 2, 3]'
                      },
                      {
                        id: 'halfFlipB',
                        name: 'Inversione per Blocchi Beta (Half-Flip-B)',
                        desc: 'La lista viene divisa in due metà; si scambiano di posto e la prima metà viene invertita.',
                        example: 'Esempio: [1, 2, 3, 4, 5, 6] → [4, 5, 6, 3, 2, 1]'
                      },
                      {
                        id: 'reverse',
                        name: 'Inversione Speculare Totale (Reverse)',
                        desc: 'L\'ordine di tiro viene completamente invertito.',
                        example: 'Esempio: [1, 2, 3, 4, 5, 6] → [6, 5, 4, 3, 2, 1]'
                      }
                    ].map(pattern => (
                      <button
                        key={pattern.id}
                        onClick={() => setSelectedPattern(pattern.id as any)}
                        className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                          selectedPattern === pattern.id 
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-black uppercase tracking-wider">{pattern.name}</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            selectedPattern === pattern.id ? 'border-amber-500 bg-amber-500' : 'border-slate-700'
                          }`}>
                            {selectedPattern === pattern.id && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-1 leading-normal">{pattern.desc}</p>
                        <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-400 rounded px-1.5 py-0.5 mt-2 self-start uppercase font-bold tracking-tight">
                          {pattern.example}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-3">
              {orderMode === 'drag' ? (
                <button 
                  onClick={() => setIsOrderModalOpen(false)}
                  className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition"
                >
                  Chiudi
                </button>
              ) : orderMode === 'input' ? (
                <>
                  <button 
                    onClick={() => setIsOrderModalOpen(false)}
                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition"
                  >
                    Chiudi
                  </button>
                  <button 
                    onClick={handleConfirmInputOrder}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition shadow-lg shadow-amber-900/20 font-black"
                  >
                    Conferma Ordine
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsOrderModalOpen(false)}
                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition"
                  >
                    Chiudi
                  </button>
                  <button 
                    onClick={handleApplyPattern}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition shadow-lg shadow-amber-900/20 font-black"
                  >
                    Conferma Pattern
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isBulkAdding && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
             <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Iscrizione Multipla</h3>
                <button onClick={() => setIsBulkAdding(false)} className="text-slate-500 hover:text-white">Esci</button>
             </div>
             <div className="p-4 bg-slate-950/50 border-b border-slate-800">
                <input 
                  type="text"
                  placeholder="Cerca tiratore..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs"
                  value={bulkSearch}
                  onChange={e => setBulkSearch(e.target.value)}
                />
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-2 high-density-scroll">
                {filteredBulkShooters.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => toggleBulkSelection(s.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                      bulkSelection.includes(s.id) 
                        ? 'bg-emerald-500/10 border-emerald-500/40' 
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                      bulkSelection.includes(s.id) ? 'bg-emerald-500 border-emerald-500 text-slate-900' : 'border-slate-700'
                    }`}>
                      {bulkSelection.includes(s.id) && <CheckCircle2 size={12} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-slate-200 uppercase">{s.lastName} {s.firstName}</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black">{s.category} {s.isReserved && <span className="text-amber-500 italic ml-2">● RISERVATO</span>}</div>
                    </div>
                    <div className="text-xs font-mono text-slate-500 font-bold">
                       €{getShooterCosts(s.id).actualFee.toFixed(2)}
                    </div>
                  </div>
                ))}
             </div>
             <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{bulkSelection.length} Tiratori Selezionati</span>
                <button 
                  onClick={handleMassRegister}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition shadow-xl disabled:opacity-30"
                  disabled={bulkSelection.length === 0}
                >
                  Iscrivi Ora
                </button>
             </div>
          </div>
        </div>
      )}

      {discountModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Plus className="text-sky-500" size={18} /> Imposta Sconto Extra
                </h3>
                <button onClick={() => setDiscountModal(null)} className="text-slate-500 hover:text-white transition">
                  <X size={20} />
                </button>
            </div>
            <div className="p-8 space-y-6">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tipologia Sconto</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDiscountModal({ ...discountModal, type: 'fixed' })}
                      className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        discountModal.type === 'fixed' 
                          ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/20' 
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Valore Fisso (€)
                    </button>
                    <button
                      onClick={() => setDiscountModal({ ...discountModal, type: 'percentage' })}
                      className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        discountModal.type === 'percentage' 
                          ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/20' 
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Percentuale (%)
                    </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Valore Sconto</label>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-500 font-mono font-bold">{discountModal.type === 'fixed' ? '€' : '%'}</span>
                      </div>
                      <input
                        type="number"
                        value={discountModal.value === 0 ? '' : discountModal.value}
                        onChange={e => setDiscountModal({ ...discountModal, value: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-4 text-white text-lg font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="w-32 space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-tight block text-center">Reintegro</label>
                       <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-1">
                          <button 
                            onClick={() => setDiscountModal({ ...discountModal, reintegro: true })}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${discountModal.reintegro ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            Si
                          </button>
                          <button 
                            onClick={() => setDiscountModal({ ...discountModal, reintegro: false })}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!discountModal.reintegro ? 'bg-red-500 text-white' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            No
                          </button>
                       </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter text-center italic">Lo sconto verrà sottratto alla quota già calcolata. 
                  <span className="text-amber-500/80 block mt-1">N.B. Se impostato su 'Sì', lo sconto extra sarà recuperato se il tiratore va a premio.</span></p>
               </div>
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-3">
              <button
                onClick={() => setDiscountModal(null)}
                className="flex-1 px-4 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveExtraDiscount}
                className="flex-[2] py-3 bg-sky-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-500 transition shadow-xl shadow-sky-900/20 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Conferma Sconto
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card-bg rounded-xl border border-slate-800 shadow-2xl overflow-x-auto no-scrollbar">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-[#2D3A4F]">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-6 py-4 border-b border-slate-700 w-24">Ordine</th>
              <th className="px-6 py-4 border-b border-slate-700">Tiratore</th>
              <th className="px-6 py-4 border-b border-slate-700">Riservato/Agevolato</th>
              <th className="px-6 py-4 border-b border-slate-700">Sconto Extra</th>
              <th className="px-6 py-4 border-b border-slate-700">Servizio Campo</th>
              <th className="px-6 py-4 border-b border-slate-700">Dettaglio Costi</th>
              <th className="px-6 py-4 border-b border-slate-700 text-center">Pagato</th>
              <th className="px-6 py-4 border-b border-slate-700 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredRegistrations.map(reg => {
              const shooter = shooters.find(s => s.id === reg.shooterId);
              return (
                <tr key={reg.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-6 py-4 border-none">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => moveRegistration(reg.id, 'up')}
                          className="p-0.5 text-slate-600 hover:text-sky-500 hover:bg-sky-500/10 rounded transition-colors"
                          title="Sposta su"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button 
                          onClick={() => moveRegistration(reg.id, 'down')}
                          className="p-0.5 text-slate-600 hover:text-sky-500 hover:bg-sky-500/10 rounded transition-colors"
                          title="Sposta giù"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <span className="text-xl font-mono font-black text-slate-200 italic group-hover:text-amber-500 transition-colors w-6">{reg.shootingOrder || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-none font-bold text-slate-200 group-hover:text-white transition-colors">
                    <div className="text-sm tracking-tight uppercase">{shooter?.lastName} {shooter?.firstName}</div>
                    <div className="text-[8px] text-slate-600 font-mono italic flex items-center gap-2">
                       {shooter?.category} • REG_ID: {String(reg.id).slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${getDynamicCosts(reg).catFee > getDynamicCosts(reg).effectiveCategoryFee ? 'text-amber-500' : 'text-slate-600'}`}>
                        -€{(getDynamicCosts(reg).catFee - getDynamicCosts(reg).effectiveCategoryFee).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setDiscountModal({ 
                        regId: reg.id, 
                        type: reg.extraDiscount?.type || 'fixed', 
                        value: reg.extraDiscount?.value || 0,
                        reintegro: reg.extraDiscount?.reintegro ?? true
                      })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                        (reg.extraDiscount && reg.extraDiscount.value > 0)
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 hover:bg-sky-500/20' 
                          : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {(reg.extraDiscount && reg.extraDiscount.value > 0) ? <Pencil size={12} /> : <Plus size={12} />}
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {(reg.extraDiscount && reg.extraDiscount.value > 0)
                          ? `${reg.extraDiscount.type === 'fixed' ? '€' : ''}${reg.extraDiscount.value}${reg.extraDiscount.type === 'percentage' ? '%' : ''}` 
                          : 'Aggiungi'
                        }
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        €{(settings.fieldServiceCost || ((settings.targetUnitCost || 0) * (settings.totalTargets || 0))).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-end">
                      <div className="flex flex-col -space-y-0.5 items-end">
                        {(getDynamicCosts(reg).catFee !== getDynamicCosts(reg).actualFee) && (
                          <span className="text-[10px] font-bold text-slate-500/50 line-through leading-none">Standard: €{(getDynamicCosts(reg).catFee).toFixed(2)}</span>
                        )}
                        <span className="font-mono font-black text-emerald-400 text-base leading-none mt-1">
                          €{(getDynamicCosts(reg).actualFee + (settings.fieldServiceCost || ((settings.targetUnitCost || 0) * (settings.totalTargets || 0)))).toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                        <span 
                          title="Servizio Campo"
                          className="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 font-black uppercase tracking-tighter italic border border-indigo-500/20 rounded cursor-help"
                        >
                          S.C.
                        </span>
                        {getDynamicCosts(reg).effectiveCategoryFee < getDynamicCosts(reg).catFee && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 font-black uppercase tracking-tighter italic border border-amber-500/20 rounded">
                            Tiratore Riservato
                          </span>
                        )}
                        {(getDynamicCosts(reg) as any).hasSubscriptionDiscount && (
                           <span className="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 font-black uppercase tracking-tighter italic border border-indigo-500/20 rounded">
                             Torneo (-{currentTournament?.subscriptionDiscount.value}{currentTournament?.subscriptionDiscount.type === 'percentage' ? '%' : '€'})
                           </span>
                        )}
                        {reg.extraDiscount && reg.extraDiscount.value > 0 && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-sky-500/10 text-sky-400 font-black uppercase tracking-tighter italic border border-sky-500/20 rounded">
                            Extra (-{reg.extraDiscount.type === 'fixed' ? '€' : ''}{reg.extraDiscount.value}{reg.extraDiscount.type === 'percentage' ? '%' : ''})
                          </span>
                        )}
                      </div>
                      {getDynamicCosts(reg).reintegroAmount > 0 && (
                        <div className="text-[7px] text-slate-600 font-bold uppercase mt-1 tracking-tighter flex items-center gap-1">
                          <RotateCcw size={8} /> Reintegro Premio: €{getDynamicCosts(reg).reintegroAmount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => togglePaid(reg.id)}
                      className="transition-transform active:scale-90"
                    >
                      {reg.paid ? (
                        <div className="flex items-center gap-1.5 justify-center text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 size={12} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Saldato</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-center text-slate-600 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 group-hover:border-slate-500 transition-colors">
                          <Circle size={12} strokeWidth={1} />
                          <span className="text-[8px] font-black uppercase tracking-widest">In Sospeso</span>
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRegistration(reg.id);
                      }}
                      className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 active:scale-95 flex items-center justify-center ml-auto"
                      title="Elimina iscrizione"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredRegistrations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-slate-600 uppercase font-black text-[10px] tracking-[0.3em] italic">
                   {searchQuery || selectedCategories.length > 0 ? 'Nessun risultato trovato dai filtri' : 'Nessun tiratore iscritto alla gara corrente'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableItem({ reg, shooter }: { reg: Registration, shooter?: Shooter }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: reg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      className="flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 group transition-colors"
    >
      <div {...listeners} className="p-2 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </div>
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-amber-500 font-mono border border-slate-700 shadow-inner">
        {reg.shootingOrder}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black text-slate-200 uppercase truncate">
          {shooter?.lastName} {shooter?.firstName}
        </div>
        <div className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">
          {shooter?.category}
        </div>
      </div>
    </div>
  );
}
