import { CheckIn } from '@/contexts/UserDataContext';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

export interface ExportOptions {
  checkIns: CheckIn[];
  startDate: Date;
  endDate: Date;
  includeNotes: boolean;
}

// ─── CSV Export ────────────────────────────────────────────────

export const generateCSV = ({ checkIns, startDate, endDate, includeNotes }: ExportOptions): string => {
  const filtered = filterCheckIns(checkIns, startDate, endDate);

  const headers = [
    'Date',
    'Time of Day',
    'Mood (1-5)',
    'Skin Feeling (1-5)',
    'Skin Intensity (0-4)',
    'Pain Score (0-10)',
    'Sleep Quality (1-5)',
    'Treatments',
    'Triggers',
    'Food Diary',
    'Product Diary',
    'Symptoms',
    ...(includeNotes ? ['Notes'] : []),
  ];

  const rows = filtered.map((c) => {
    const triggers = (c.triggers ?? []).filter(
      (t) => !t.startsWith('food:') && !t.startsWith('product:') && !t.startsWith('new_product:')
    );
    const foods = (c.triggers ?? []).filter((t) => t.startsWith('food:')).map((t) => t.replace('food:', ''));
    const products = (c.triggers ?? [])
      .filter((t) => t.startsWith('product:') || t.startsWith('new_product:'))
      .map((t) => t.replace(/^(product:|new_product:)/, ''));

    const symptoms = (c.symptomsExperienced ?? [])
      .map((s) => `${s.symptom} (${['Mild', 'Moderate', 'Severe'][s.severity - 1]})`)
      .join('; ');

    return [
      format(new Date(c.timestamp), 'yyyy-MM-dd'),
      c.timeOfDay,
      c.mood,
      c.skinFeeling,
      c.skinIntensity ?? '',
      c.painScore ?? '',
      c.sleepScore ?? '',
      c.treatments.join('; '),
      triggers.join('; '),
      foods.join('; '),
      products.join('; '),
      symptoms,
      ...(includeNotes ? [escapeCSV(c.notes ?? '')] : []),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.map((v) => escapeCSV(String(v))).join(','))].join('\n');
};

const escapeCSV = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

// ─── Clinician Summary PDF ────────────────────────────────────

export const generateClinicianPDF = ({ checkIns, startDate, endDate, includeNotes }: ExportOptions): jsPDF => {
  const filtered = filterCheckIns(checkIns, startDate, endDate);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usable = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TSW Atlas — Clinician Summary', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Period: ${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`,
    margin,
    y
  );
  y += 5;
  doc.text(`Total check-ins: ${filtered.length}`, margin, y);
  y += 5;
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin, y);
  y += 10;

  // Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(120);
  const disclaimer =
    'Disclaimer: This report is generated from self-reported data. Trigger and treatment associations are observational and do not imply causation. This is not a medical diagnosis.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, usable);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 3.5 + 6;
  doc.setTextColor(0);

  if (filtered.length === 0) {
    doc.setFontSize(12);
    doc.text('No check-in data in this period.', margin, y);
    return doc;
  }

  // Averages section
  const avgMood = avg(filtered.map((c) => c.mood));
  const avgSkin = avg(filtered.map((c) => c.skinFeeling));
  const painEntries = filtered.filter((c) => c.painScore != null);
  const avgPain = painEntries.length ? avg(painEntries.map((c) => c.painScore!)) : null;
  const sleepEntries = filtered.filter((c) => c.sleepScore != null);
  const avgSleep = sleepEntries.length ? avg(sleepEntries.map((c) => c.sleepScore!)) : null;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Averages', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mood: ${avgMood.toFixed(1)} / 5`, margin, y);
  y += 5;
  doc.text(`Skin feeling: ${avgSkin.toFixed(1)} / 5`, margin, y);
  y += 5;
  if (avgPain !== null) {
    doc.text(`Pain: ${avgPain.toFixed(1)} / 10 (${painEntries.length} entries)`, margin, y);
    y += 5;
  }
  if (avgSleep !== null) {
    doc.text(`Sleep quality: ${avgSleep.toFixed(1)} / 5 (${sleepEntries.length} entries)`, margin, y);
    y += 5;
  }
  y += 5;

  // Top treatments
  const treatmentCounts = countItems(filtered.flatMap((c) => c.treatments));
  if (treatmentCounts.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Treatments Used', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    treatmentCounts.slice(0, 10).forEach(([name, count]) => {
      addPageIfNeeded(6);
      doc.text(`• ${name} — ${count} time${count > 1 ? 's' : ''}`, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Top triggers (associations language)
  const allTriggers = filtered.flatMap((c) => c.triggers ?? []);
  const generalTriggers = allTriggers.filter(
    (t) => !t.startsWith('food:') && !t.startsWith('product:') && !t.startsWith('new_product:')
  );
  const triggerCounts = countItems(generalTriggers);
  if (triggerCounts.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Reported Trigger Associations', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    triggerCounts.slice(0, 10).forEach(([name, count]) => {
      addPageIfNeeded(6);
      doc.text(`• ${name} — reported ${count} time${count > 1 ? 's' : ''}`, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Symptoms
  const symptomCounts: Record<string, number> = {};
  filtered.forEach((c) =>
    (c.symptomsExperienced ?? []).forEach((s) => {
      symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;
    })
  );
  const sortedSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]);
  if (sortedSymptoms.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Reported Symptoms', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    sortedSymptoms.slice(0, 10).forEach(([name, count]) => {
      addPageIfNeeded(6);
      doc.text(`• ${name} — ${count} day${count > 1 ? 's' : ''}`, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Notes section
  if (includeNotes) {
    const withNotes = filtered.filter((c) => c.notes?.trim());
    if (withNotes.length > 0) {
      addPageIfNeeded(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Notes', margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      withNotes.forEach((c) => {
        const dateStr = format(new Date(c.timestamp), 'dd MMM yyyy');
        const noteLines = doc.splitTextToSize(`${dateStr}: ${c.notes}`, usable);
        addPageIfNeeded(noteLines.length * 4 + 4);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 4 + 2;
      });
    }
  }

  return doc;
};

// ─── Helpers ──────────────────────────────────────────────────

const filterCheckIns = (checkIns: CheckIn[], startDate: Date, endDate: Date): CheckIn[] => {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');
  return checkIns
    .filter((c) => {
      const d = format(new Date(c.timestamp), 'yyyy-MM-dd');
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

const avg = (nums: number[]): number => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const countItems = (items: string[]): [string, number][] => {
  const counts: Record<string, number> = {};
  items.forEach((i) => {
    counts[i] = (counts[i] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

// ─── Download helpers ─────────────────────────────────────────

export const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
