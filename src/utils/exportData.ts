import { CheckIn } from '@/contexts/UserDataContext';
import { format, addDays, startOfDay, endOfDay, min, max } from 'date-fns';
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

  // Weekly trends section
  const weeks = groupByWeek(filtered, startDate, endDate);
  if (weeks.length > 1) {
    addPageIfNeeded(20 + weeks.length * 7);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Weekly Trends', margin, y);
    y += 7;

    // Table header
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const cols = ['Week', 'Entries', 'Mood', 'Skin', 'Pain', 'Sleep'];
    const colWidths = [32, 16, 22, 22, 22, 22];
    let xPos = margin;
    cols.forEach((col, i) => {
      doc.text(col, xPos, y);
      xPos += colWidths[i];
    });
    y += 1;
    doc.setDrawColor(180);
    doc.line(margin, y, margin + colWidths.reduce((a, b) => a + b, 0), y);
    y += 4;

    // Table rows
    doc.setFont('helvetica', 'normal');
    weeks.forEach((week, idx) => {
      addPageIfNeeded(7);
      xPos = margin;
      const weekLabel = `${format(week.start, 'dd MMM')} – ${format(week.end, 'dd MMM')}`;
      const wMood = avg(week.checkIns.map((c) => c.mood));
      const wSkin = avg(week.checkIns.map((c) => c.skinFeeling));
      const wPainEntries = week.checkIns.filter((c) => c.painScore != null);
      const wPain = wPainEntries.length ? avg(wPainEntries.map((c) => c.painScore!)) : null;
      const wSleepEntries = week.checkIns.filter((c) => c.sleepScore != null);
      const wSleep = wSleepEntries.length ? avg(wSleepEntries.map((c) => c.sleepScore!)) : null;

      const trendArrow = (current: number | null, prevWeek: typeof weeks[0] | undefined, getter: (c: CheckIn) => number | null | undefined): string => {
        if (current === null || !prevWeek) return '';
        const prevEntries = prevWeek.checkIns.map(getter).filter((v): v is number => v != null);
        if (prevEntries.length === 0) return '';
        const prev = avg(prevEntries);
        const diff = current - prev;
        if (Math.abs(diff) < 0.1) return ' →';
        return diff > 0 ? ` ↑${Math.abs(diff).toFixed(1)}` : ` ↓${Math.abs(diff).toFixed(1)}`;
      };

      const prevWeek = idx > 0 ? weeks[idx - 1] : undefined;
      const values = [
        weekLabel,
        String(week.checkIns.length),
        `${wMood.toFixed(1)}${trendArrow(wMood, prevWeek, (c) => c.mood)}`,
        `${wSkin.toFixed(1)}${trendArrow(wSkin, prevWeek, (c) => c.skinFeeling)}`,
        wPain !== null ? `${wPain.toFixed(1)}${trendArrow(wPain, prevWeek, (c) => c.painScore)}` : '–',
        wSleep !== null ? `${wSleep.toFixed(1)}${trendArrow(wSleep, prevWeek, (c) => c.sleepScore)}` : '–',
      ];

      values.forEach((val, i) => {
        doc.text(val, xPos, y);
        xPos += colWidths[i];
      });
      y += 5;
    });

    // Overall change summary
    if (weeks.length >= 2) {
      y += 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const firstWeek = weeks[0];
      const lastWeek = weeks[weeks.length - 1];
      const changeLine = (label: string, first: number, last: number, scale: string): string => {
        const diff = last - first;
        const direction = diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'unchanged';
        return `${label}: ${direction}${diff !== 0 ? ` by ${Math.abs(diff).toFixed(1)}` : ''} (${first.toFixed(1)} → ${last.toFixed(1)} / ${scale})`;
      };

      const fMood = avg(firstWeek.checkIns.map((c) => c.mood));
      const lMood = avg(lastWeek.checkIns.map((c) => c.mood));
      addPageIfNeeded(8);
      doc.text(changeLine('Mood', fMood, lMood, '5'), margin, y);
      y += 4;

      const fSkin = avg(firstWeek.checkIns.map((c) => c.skinFeeling));
      const lSkin = avg(lastWeek.checkIns.map((c) => c.skinFeeling));
      doc.text(changeLine('Skin feeling', fSkin, lSkin, '5'), margin, y);
      y += 4;

      const fPainE = firstWeek.checkIns.filter((c) => c.painScore != null);
      const lPainE = lastWeek.checkIns.filter((c) => c.painScore != null);
      if (fPainE.length && lPainE.length) {
        doc.text(changeLine('Pain', avg(fPainE.map((c) => c.painScore!)), avg(lPainE.map((c) => c.painScore!)), '10'), margin, y);
        y += 4;
      }

      const fSleepE = firstWeek.checkIns.filter((c) => c.sleepScore != null);
      const lSleepE = lastWeek.checkIns.filter((c) => c.sleepScore != null);
      if (fSleepE.length && lSleepE.length) {
        doc.text(changeLine('Sleep', avg(fSleepE.map((c) => c.sleepScore!)), avg(lSleepE.map((c) => c.sleepScore!)), '5'), margin, y);
        y += 4;
      }
      doc.setFont('helvetica', 'normal');
    }
    y += 5;
  }

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

interface WeekBucket {
  start: Date;
  end: Date;
  checkIns: CheckIn[];
}

const groupByWeek = (checkIns: CheckIn[], rangeStart: Date, rangeEnd: Date): WeekBucket[] => {
  const weeks: WeekBucket[] = [];
  let current = startOfDay(rangeStart);
  const finalEnd = endOfDay(rangeEnd);

  while (current < finalEnd) {
    const weekEnd = min([addDays(current, 6), finalEnd]);
    const bucket: WeekBucket = {
      start: current,
      end: weekEnd,
      checkIns: checkIns.filter((c) => {
        const d = new Date(c.timestamp);
        return d >= current && d <= endOfDay(weekEnd);
      }),
    };
    if (bucket.checkIns.length > 0) {
      weeks.push(bucket);
    }
    current = addDays(current, 7);
  }
  return weeks;
};

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
