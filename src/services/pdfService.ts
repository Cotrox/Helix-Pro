import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompetitionSettings, Feedback } from '../types';

const formatDateStr = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('it-IT');
};

export const exportToPDF = (
  title: string,
  headers: string[],
  data: any[][],
  filename: string,
  settings?: CompetitionSettings
) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text(title, 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (settings) {
    doc.text(`Gara: ${settings.name}`, 14, 30);
    doc.text(`Data: ${formatDateStr(settings.eventDate || settings.date)}`, 14, 35);
  } else {
    doc.text(`Data Esportazione: ${new Date().toLocaleDateString('it-IT')}`, 14, 30);
  }
  
  // Table
  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 45 },
  });
  
  doc.save(filename);
};

export const exportStatinoPDF = (
  headers: string[],
  data: any[][],
  filename: string,
  settings: CompetitionSettings,
  orientation: 'portrait' | 'landscape' = 'portrait'
) => {
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('Statino Direttore di Tiro', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gara: ${settings.name}`, 14, 30);
  doc.text(`Data: ${formatDateStr(settings.eventDate || settings.date)}`, 14, 35);
  doc.text(`Località: ${settings.location || 'N/A'}`, 14, 40);
  
  // Portrait specific adjustments
  const isPortrait = orientation === 'portrait';
  const boxSize = isPortrait ? 5.5 : 7; // Smaller squares for portrait
  const boxPadding = isPortrait ? 1.5 : 2;
  const seriesStartIndex = 3;

  // Abbreviate only for portrait
  const finalHeaders = [...headers];
  if (isPortrait && finalHeaders[0] === 'Pettorale') {
    finalHeaders[0] = 'Pett.';
  }

  const categoryAbbr: Record<string, string> = {
    'Master': 'MA',
    'Veterani': 'VE',
    'Senior': 'SE',
    'Men': 'M',
    'Lady': 'L',
    'Junior': 'JU',
    '3^ Categoria': 'C3',
    'Altro': 'AL'
  };

  const finalData = data.map(row => {
    const newRow = [...row];
    if (isPortrait && newRow[2]) {
      const cat = newRow[2].toString();
      newRow[2] = categoryAbbr[cat] || cat;
    }
    return newRow;
  });

  // Calculate dynamic column widths for series
  const seriesColumnStyles: { [key: number]: any } = {};
  for (let i = 0; i < settings.seriesCount; i++) {
    const targetCount = settings.seriesTargets?.[i] || settings.targetsPerSeries || 1;
    const neededWidth = (targetCount * boxSize) + ((targetCount - 1) * boxPadding) + (isPortrait ? 4 : 6);
    seriesColumnStyles[seriesStartIndex + i] = { cellWidth: Math.max(neededWidth, isPortrait ? 16 : 20), halign: 'center' };
  }

  // Table
  autoTable(doc, {
    startY: 50,
    head: [finalHeaders],
    body: finalData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: isPortrait ? 8 : 9, minCellHeight: isPortrait ? 10 : 12 },
    columnStyles: {
      0: { cellWidth: isPortrait ? 12 : 20, halign: 'center' }, // Pett.
      1: { cellWidth: 'auto' },               // Tiratore
      2: { cellWidth: isPortrait ? 10 : 25, halign: 'center' }, // Categoria
      ...seriesColumnStyles,
      [headers.length - 1]: { cellWidth: isPortrait ? 12 : 20, halign: 'center' } // Totale
    },
    didDrawCell: (hookData) => {
      const seriesEndIndex = 3 + settings.seriesCount;
      
      if (hookData.section === 'body' && hookData.column.index >= seriesStartIndex && hookData.column.index < seriesEndIndex) {
        const seriesIdx = hookData.column.index - seriesStartIndex;
        const targetCount = settings.seriesTargets?.[seriesIdx] || settings.targetsPerSeries || 1;
        
        const { x, y, width, height } = hookData.cell;
        
        const totalContentWidth = (boxSize * targetCount) + (boxPadding * (targetCount - 1));
        const startX = x + (width - totalContentWidth) / 2;
        const startY = y + (height - boxSize) / 2;

        for (let i = 0; i < targetCount; i++) {
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.3);
          doc.rect(startX + (i * (boxSize + boxPadding)), startY, boxSize, boxSize);
        }
      }
    }
  });
  
  doc.save(filename);
};

export const generateBibsPDF = (
  shooters: any[],
  registrations: any[],
  settings: CompetitionSettings
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const sortedRegs = [...(registrations || [])].filter(Boolean).sort((a,b) => (a.shootingOrder || 0) - (b.shootingOrder || 0));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('it-IT');
    }
    return dateStr;
  };

  const competitionDate = formatDate(settings.eventDate || settings.date || '');

  sortedRegs.forEach((reg, index) => {
    if (index > 0) doc.addPage();
    
    const shooter = shooters.find(s => s.id === reg.shooterId);
    if (!shooter) return;

    const pageWidth = 297;
    const centerX = pageWidth / 2;

    // Header Row
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('C.O.N.I.', 20, 25);
    doc.text('F.I.T.A.V.', pageWidth - 20, 25, { align: 'right' });
    
    doc.setFontSize(22);
    doc.text(settings.location?.toUpperCase() || 'N/A', centerX, 25, { align: 'center' });

    // Name
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.text(`${shooter.lastName} ${shooter.firstName}`.toUpperCase(), centerX, 65, { align: 'center' });

    // Bib Number (Pettorale)
    doc.setFontSize(160); // Slightly larger
    doc.setFont('helvetica', 'bold');
    doc.text((reg.shootingOrder || '').toString(), centerX, 135, { align: 'center' });

    // Competition Name
    doc.setFontSize(32);
    doc.setFont('helvetica', 'normal');
    const compNameLines = doc.splitTextToSize(settings.name, 250);
    doc.text(compNameLines, centerX, 175, { align: 'center' });

    // Date
    doc.setFontSize(24);
    doc.text(competitionDate, centerX, 195, { align: 'center' });
  });

  doc.save(`pettorali_${settings.name.replace(/\s+/g, '_')}.pdf`);
};

export interface PDFSection {
  title: string;
  headers: string[];
  data: any[][];
}

export const exportFullReportToPDF = (
  reportTitle: string,
  sections: PDFSection[],
  filename: string,
  settings?: CompetitionSettings
) => {
  const doc = new jsPDF();
  
  // Title Page
  doc.setFontSize(28);
  doc.setTextColor(41, 128, 185);
  doc.text(reportTitle, 14, 40);
  
  if (settings?.name) {
    doc.setFontSize(18);
    doc.setTextColor(52, 152, 219);
    doc.text(settings.name, 14, 52);
  }
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  if (settings) {
    doc.text(`Data: ${formatDateStr(settings.eventDate || settings.date)}`, 14, 65);
    doc.text(`Località: ${settings.location || 'N/A'}`, 14, 75);
    doc.text(`Tipo: ${settings.managedType === 'delegata' ? 'Delegata' : 'Proprietaria'}`, 14, 85);
    doc.text(`Montepremi Totale: €${settings.totalPrizePool.toLocaleString('it-IT')}`, 14, 95);
  }
  
  doc.setFontSize(10);
  doc.text(`Report generato il: ${new Date().toLocaleString('it-IT')}`, 14, 110);

  let currentY = 125;

  sections.forEach((section, index) => {
    if (index > 0) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text(section.title, 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [section.headers],
      body: section.data,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 20 },
    });
    
    // Update currentY based on table height if we stayed on same page
    // but here we force new page per section for clarity
  });
  
  doc.save(filename);
};

export const exportFeedbackToPDF = (feedbacks: Feedback[]) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(22);
  doc.setTextColor(41, 128, 185); // Slate blue
  doc.text("Elenco Feedback", 14, 22);
  
  // Subtitle
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text("Lista dei Feedback", 14, 30);
  
  // Export date
  doc.setFontSize(10);
  doc.setTextColor(120);
  const today = new Date().toLocaleDateString('it-IT');
  doc.text(`Esportata in Data: ${today}`, 14, 38);
  
  // Table data preparation
  const headers = ["Titolo", "Data", "Tipologia", "Descrizione"];
  const data = feedbacks.map(f => [f.title, f.date, f.type, f.description]);
  
  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 40 }, // Title
      1: { cellWidth: 25 }, // Date
      2: { cellWidth: 35 }, // Type
      3: { cellWidth: 'auto' } // Description (let it wrap)
    },
    margin: { top: 45 },
  });
  
  doc.save("elenco_feedback.pdf");
};
