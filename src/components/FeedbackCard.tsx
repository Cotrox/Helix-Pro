import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Plus, 
  FileText, 
  ChevronDown, 
  Pencil, 
  Trash2, 
  X, 
  Info,
  AlertCircle,
  Lightbulb,
  Inbox
} from 'lucide-react';
import { Feedback } from '../types';
import { exportFeedbackToPDF } from '../services/pdfService';
import { toast } from 'sonner';

interface FeedbackCardProps {
  feedbacks: Feedback[];
  onUpdate: React.Dispatch<React.SetStateAction<Feedback[]>>;
}

export default function FeedbackCard({ feedbacks, onUpdate }: FeedbackCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  
  // Form values
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'Problema' | 'Suggerimento'>('Problema');
  const [formDescription, setFormDescription] = useState('');

  // Delete states
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openAddModal = () => {
    setFormTitle('');
    setFormType('Problema');
    setFormDescription('');
    setEditingFeedback(null);
    setIsFormOpen(true);
  };

  const openEditModal = (feedback: Feedback, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid expanding/collapsing the card
    setFormTitle(feedback.title);
    setFormType(feedback.type);
    setFormDescription(feedback.description);
    setEditingFeedback(feedback);
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid expanding/collapsing
    setDeletingId(id);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formTitle.trim() || !formDescription.trim()) {
      toast.error('Per favore, compila tutti i campi richiesti.');
      return;
    }

    if (editingFeedback) {
      // Edit existing
      onUpdate(prev => 
        prev.map(f => f.id === editingFeedback.id 
          ? { ...f, title: formTitle.trim(), type: formType, description: formDescription.trim() } 
          : f
        )
      );
      toast.success('Feedback modificato con successo');
    } else {
      // Add new
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      const newFeedback: Feedback = {
        id: crypto.randomUUID(),
        title: formTitle.trim(),
        date: formattedDate,
        type: formType,
        description: formDescription.trim()
      };
      
      onUpdate(prev => [newFeedback, ...prev]);
      toast.success('Feedback aggiunto con successo');
    }

    setIsFormOpen(false);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    onUpdate(prev => prev.filter(f => f.id !== deletingId));
    toast.success('Feedback eliminato con successo');
    setDeletingId(null);
    if (expandedId === deletingId) {
      setExpandedId(null);
    }
  };

  const handleExportPDF = () => {
    if (feedbacks.length === 0) {
      toast.error('Nessun feedback presente da esportare.');
      return;
    }
    try {
      exportFeedbackToPDF(feedbacks);
      toast.success('PDF esportato correttamente');
    } catch (error) {
      toast.error("Errore durante l'esportazione del PDF");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-card-bg border border-slate-800 rounded-3xl p-6 lg:p-8 space-y-6 shadow-xl relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase italic">Feedback</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Segnalazioni e Suggerimenti</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-sky-900/10 active:scale-95 cursor-pointer"
          >
            <Plus size={14} /> Aggiungi
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-[10px] uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* InfoBox (Salvataggio Locale) */}
      <div className="flex items-start gap-3 p-4 bg-sky-500/5 border border-sky-500/15 rounded-2xl relative z-10">
        <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">Nota Informativa</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            I feedback in questa versione vengono salvati <strong>esclusivamente in locale</strong> sul dispositivo attuale e sono archiviati all'interno del database integrato offline dell'applicazione.
          </p>
        </div>
      </div>

      {/* Feedbacks List */}
      <div className="relative z-10">
        {feedbacks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-950/20 rounded-2xl border border-dashed border-slate-800">
            <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-700">
              <Inbox size={22} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nessun feedback presente</p>
              <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">Fai clic su "Aggiungi" per lasciare la tua prima segnalazione.</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 high-density-scroll">
            {feedbacks.map(feedback => {
              const isExpanded = expandedId === feedback.id;
              const isProblem = feedback.type === 'Problema';

              return (
                <div 
                  key={feedback.id}
                  className="group bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300"
                >
                  {/* Item Header */}
                  <div 
                    onClick={() => toggleExpand(feedback.id)}
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Left Icon depending on type */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isProblem ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {isProblem ? <AlertCircle size={16} /> : <Lightbulb size={16} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-200 truncate pr-2">{feedback.title}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{feedback.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Badge type */}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
                        isProblem 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {feedback.type}
                      </span>

                      {/* Hover action icons (Modifica & Elimina) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 bg-slate-900/90 py-1 px-2 rounded-lg border border-slate-800">
                        <button
                          onClick={(e) => openEditModal(feedback, e)}
                          title="Modifica"
                          className="p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => openDeleteConfirm(feedback.id, e)}
                          title="Elimina"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Expand Arrow */}
                      <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                        <ChevronDown 
                          size={16} 
                          className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-sky-400' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expandable Description Section */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className="px-4 pb-4 pt-0.5 border-t border-slate-800/40 bg-slate-950/20">
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Descrizione:</p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                            {feedback.description}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-sky-500/10 rounded-lg flex items-center justify-center text-sky-400">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">
                      {editingFeedback ? 'Modifica Feedback' : 'Aggiungi Feedback'}
                    </h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      {editingFeedback ? 'Aggiorna i dettagli della segnalazione' : 'Invia una nuova segnalazione locale'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Titolo</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Es: Errore nel caricamento del file backup"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                {/* Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tipologia</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType('Problema')}
                      className={`flex items-center justify-center gap-2.5 p-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        formType === 'Problema'
                          ? 'bg-red-500/10 text-red-400 border-red-500/40 shadow-inner'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-850 hover:text-slate-400'
                      }`}
                    >
                      <AlertCircle size={16} />
                      <span>Problema</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormType('Suggerimento')}
                      className={`flex items-center justify-center gap-2.5 p-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        formType === 'Suggerimento'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/40 shadow-inner'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-850 hover:text-slate-400'
                      }`}
                    >
                      <Lightbulb size={16} />
                      <span>Suggerimento</span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Descrizione</label>
                  <textarea
                    required
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Descrivi in dettaglio il problema o suggerimento riscontrato..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-650 focus:border-sky-500 focus:outline-none transition resize-none leading-relaxed"
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="py-3 px-5 bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition shadow-lg shadow-sky-900/20 cursor-pointer"
                  >
                    {editingFeedback ? 'Salva Modifiche' : 'Aggiungi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={24} />
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Elimina Feedback</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Sei sicuro di voler eliminare questo feedback? L'azione è permanente e non può essere annullata.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="py-3 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-700"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDelete}
                    className="py-3 bg-red-650 hover:bg-red-555 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-950/40 cursor-pointer"
                  >
                    Sì, Elimina
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
