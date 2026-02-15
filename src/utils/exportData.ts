import { CheckIn } from '@/contexts/UserDataContext';
import { format, addDays, startOfDay, endOfDay, min as dateMin, differenceInDays } from 'date-fns';
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

// ─── Clinician Summary PDF (Multi-page) ───────────────────────

// Colors (RGB)
const BRAND_R = 79, BRAND_G = 70, BRAND_B = 229;
const GREY = 120;
const BLACK = 30;
const LIGHT_BG_R = 245, LIGHT_BG_G = 245, LIGHT_BG_B = 250;

// Humanize snake_case / internal labels for display
const humanize = (s: string): string => {
  return s
    .replace(/^(food:|product:|new_product:)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

export const generateClinicianPDF = ({ checkIns, startDate, endDate, includeNotes }: ExportOptions): jsPDF => {
  const filtered = filterCheckIns(checkIns, startDate, endDate);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const usable = pageW - M * 2;
  let y = M;

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const weeks = groupByWeek(filtered, startDate, endDate);
  const uniqueDays = new Set(filtered.map((c) => format(new Date(c.timestamp), 'yyyy-MM-dd')));

  const needsNewPage = (needed: number) => {
    if (y + needed > pageH - M - 12) { // 12mm reserved for footer
      doc.addPage();
      y = M;
      return true;
    }
    return false;
  };

  const drawHr = (thickness = 0.3) => {
    doc.setDrawColor(200);
    doc.setLineWidth(thickness);
    doc.line(M, y, pageW - M, y);
    y += 4;
  };

  const sectionHeading = (title: string) => {
    needsNewPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK);
    doc.text(title, M, y);
    y += 2;
    doc.setDrawColor(BRAND_R, BRAND_G, BRAND_B);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + 40, y);
    doc.setDrawColor(200);
    y += 6;
  };

  const metricCompleteness = (getter: (c: CheckIn) => unknown) => {
    const withData = filtered.filter((c) => getter(c) != null).length;
    return { count: withData, pct: filtered.length ? Math.round((withData / filtered.length) * 100) : 0 };
  };

  const dateRange = format(startDate, 'dd MMM yyyy') + ' - ' + format(endDate, 'dd MMM yyyy');

  // ================================================================
  // PAGE 1: EXECUTIVE SUMMARY
  // ================================================================

  // Header bar
  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255);
  doc.text('TrackTSW - Clinician Summary', M, 17);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated ' + format(new Date(), 'dd MMM yyyy, HH:mm'), pageW - M, 17, { align: 'right' });
  doc.setTextColor(BLACK);
  y = 36;

  // Date range & overview
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Report period: ' + dateRange, M, y);
  y += 5;
  const coveragePct = totalDays > 0 ? Math.round((uniqueDays.size / totalDays) * 100) : 0;
  doc.text('Total days: ' + totalDays + '  |  Check-ins: ' + filtered.length + '  |  Days with data: ' + uniqueDays.size + '/' + totalDays + ' (' + coveragePct + '%)', M, y);
  y += 8;

  if (filtered.length === 0) {
    doc.setFontSize(12);
    doc.text('No check-in data in this period.', M, y);
    addFooterOnce(doc, pageW, pageH);
    return doc;
  }

  // Data completeness box
  const moodComp = metricCompleteness((c) => c.mood);
  const skinComp = metricCompleteness((c) => c.skinFeeling);
  const painComp = metricCompleteness((c) => c.painScore);
  const sleepComp = metricCompleteness((c) => c.sleepScore);

  doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
  doc.roundedRect(M, y, usable, 18, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(GREY);
  doc.text('DATA COMPLETENESS', M + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(BLACK);
  doc.setFontSize(9);
  const compY = y + 12;
  const compItems = [
    'Mood: ' + moodComp.pct + '%',
    'Skin: ' + skinComp.pct + '%',
    'Pain: ' + painComp.pct + '%',
    'Sleep: ' + sleepComp.pct + '%',
  ];
  const compW = usable / 4;
  compItems.forEach((item, i) => {
    doc.text(item, M + 4 + i * compW, compY);
  });
  y += 24;

  // Overall trend callouts
  sectionHeading('Overall Trends');

  const firstHalf = filtered.slice(0, Math.ceil(filtered.length / 2));
  const secondHalf = filtered.slice(Math.ceil(filtered.length / 2));

  const makeTrendLabel = (firstVals: number[], lastVals: number[], scale: string, lowerIsBetter = false): string => {
    if (firstVals.length < 2 || lastVals.length < 2) return 'Insufficient data';
    const first = avg(firstVals);
    const last = avg(lastVals);
    const diff = last - first;
    const sign = diff > 0 ? '+' : '';
    if (Math.abs(diff) < 0.15) return 'Flat (' + first.toFixed(1) + ' -> ' + last.toFixed(1) + ' /' + scale + ')';
    const improving = lowerIsBetter ? diff < 0 : diff > 0;
    const direction = improving ? 'Improving' : 'Worsening';
    return direction + ' (' + first.toFixed(1) + ' -> ' + last.toFixed(1) + ' /' + scale + ', ' + sign + diff.toFixed(1) + ')';
  };

  const trends = [
    { label: 'Skin Feeling', value: makeTrendLabel(firstHalf.map(c => c.skinFeeling), secondHalf.map(c => c.skinFeeling), '5') },
    { label: 'Pain / Itch', value: makeTrendLabel(firstHalf.filter(c => c.painScore != null).map(c => c.painScore!), secondHalf.filter(c => c.painScore != null).map(c => c.painScore!), '10', true) },
    { label: 'Sleep Quality', value: makeTrendLabel(firstHalf.filter(c => c.sleepScore != null).map(c => c.sleepScore!), secondHalf.filter(c => c.sleepScore != null).map(c => c.sleepScore!), '5') },
    { label: 'Mood', value: makeTrendLabel(firstHalf.map(c => c.mood), secondHalf.map(c => c.mood), '5') },
  ];

  doc.setFontSize(10);
  trends.forEach(({ label, value }) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ': ', M, y);
    const labelW = doc.getTextWidth(label + ': ');
    doc.setFont('helvetica', 'normal');
    doc.text(value, M + labelW, y);
    y += 6;
  });
  y += 2;

  // Top improved / worsened
  if (weeks.length >= 2) {
    const firstW = weeks[0];
    const lastW = weeks[weeks.length - 1];

    interface MetricChange { label: string; delta: number; display: string }
    const changes: MetricChange[] = [];

    const addChange = (label: string, firstVals: number[], lastVals: number[], scale: string) => {
      if (firstVals.length > 0 && lastVals.length > 0) {
        const delta = avg(lastVals) - avg(firstVals);
        const sign = delta > 0 ? '+' : '';
        changes.push({ label, delta, display: sign + delta.toFixed(1) + ' /' + scale });
      }
    };

    addChange('Mood', firstW.checkIns.map(c => c.mood), lastW.checkIns.map(c => c.mood), '5');
    addChange('Skin', firstW.checkIns.map(c => c.skinFeeling), lastW.checkIns.map(c => c.skinFeeling), '5');
    addChange('Pain', firstW.checkIns.filter(c => c.painScore != null).map(c => c.painScore!), lastW.checkIns.filter(c => c.painScore != null).map(c => c.painScore!), '10');
    addChange('Sleep', firstW.checkIns.filter(c => c.sleepScore != null).map(c => c.sleepScore!), lastW.checkIns.filter(c => c.sleepScore != null).map(c => c.sleepScore!), '5');

    const improved = changes.filter(c => c.delta > 0.1).sort((a, b) => b.delta - a.delta).slice(0, 3);
    const worsened = changes.filter(c => c.delta < -0.1).sort((a, b) => a.delta - b.delta).slice(0, 3);

    if (improved.length > 0 || worsened.length > 0) {
      needsNewPage(20);
      const colW = usable / 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      doc.setTextColor(34, 139, 34);
      doc.text('What Improved (first vs last week)', M, y);
      doc.setTextColor(200, 50, 50);
      doc.text('What Worsened', M + colW, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const maxRows = Math.max(improved.length, worsened.length, 1);
      for (let i = 0; i < maxRows; i++) {
        doc.setTextColor(BLACK);
        if (improved[i]) doc.text('- ' + improved[i].label + ': ' + improved[i].display, M + 2, y);
        if (worsened[i]) doc.text('- ' + worsened[i].label + ': ' + worsened[i].display, M + colW + 2, y);
        y += 5;
      }
      y += 3;
    }
  }

  // Disclaimer box
  doc.setFillColor(255, 248, 230);
  doc.roundedRect(M, y, usable, 10, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(GREY);
  doc.text('All findings are patterns from your self-reported logs. This report does not constitute medical advice or diagnosis.', M + 4, y + 6);
  doc.setTextColor(BLACK);
  y += 16;

  // ================================================================
  // PAGE 2: TREND CHARTS
  // ================================================================

  doc.addPage();
  y = M;
  sectionHeading('Weekly Trend Charts');

  if (weeks.length >= 2) {
    const chartW = usable - 10; // leave room for Y axis labels
    const chartLeft = M + 10;
    const chartH = 32;
    const chartGap = 14;

    const drawLineChart = (
      title: string,
      getter: (c: CheckIn) => number | null | undefined,
      scaleMax: number,
      scaleLabel: string,
      lineR: number, lineG: number, lineB: number
    ) => {
      needsNewPage(chartH + 20);

      // Title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLACK);
      doc.text(title + '  (' + scaleLabel + ')', M, y);
      y += 5;

      // Chart area background
      doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
      doc.roundedRect(chartLeft, y, chartW, chartH, 1, 1, 'F');

      // Y-axis labels
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(GREY);
      doc.text(String(scaleMax), chartLeft - 2, y + 4, { align: 'right' });
      const midVal = Math.round(scaleMax / 2);
      doc.text(String(midVal), chartLeft - 2, y + chartH / 2 + 1, { align: 'right' });
      doc.text('0', chartLeft - 2, y + chartH - 1, { align: 'right' });

      // Grid lines
      doc.setDrawColor(220);
      doc.setLineWidth(0.15);
      for (let g = 1; g < 4; g++) {
        const gy = y + (chartH / 4) * g;
        doc.line(chartLeft, gy, chartLeft + chartW, gy);
      }

      // Collect valid data points
      const points: { x: number; val: number; n: number; weekIdx: number }[] = [];
      const padding = 4; // px padding inside chart
      weeks.forEach((week, idx) => {
        const vals = week.checkIns.map(getter).filter((v): v is number => v != null);
        if (vals.length > 0) {
          const xRatio = weeks.length === 1 ? 0.5 : idx / (weeks.length - 1);
          const x = chartLeft + padding + xRatio * (chartW - padding * 2);
          const val = avg(vals);
          points.push({ x, val, n: vals.length, weekIdx: idx });
        }
      });

      // Draw line + dots
      if (points.length >= 2) {
        doc.setDrawColor(lineR, lineG, lineB);
        doc.setLineWidth(0.8);
        for (let i = 1; i < points.length; i++) {
          const py1 = y + chartH - (points[i - 1].val / scaleMax) * chartH;
          const py2 = y + chartH - (points[i].val / scaleMax) * chartH;
          doc.line(points[i - 1].x, py1, points[i].x, py2);
        }

        doc.setFillColor(lineR, lineG, lineB);
        points.forEach((p) => {
          const py = y + chartH - (p.val / scaleMax) * chartH;
          doc.circle(p.x, py, 1.2, 'F');
        });

        // Value labels above dots
        doc.setFontSize(6);
        doc.setTextColor(lineR, lineG, lineB);
        points.forEach((p) => {
          const py = y + chartH - (p.val / scaleMax) * chartH;
          doc.text(p.val.toFixed(1), p.x, py - 2.5, { align: 'center' });
        });
      } else if (points.length === 1) {
        doc.setFillColor(lineR, lineG, lineB);
        const py = y + chartH - (points[0].val / scaleMax) * chartH;
        doc.circle(points[0].x, py, 1.5, 'F');
      }

      // X-axis week labels
      doc.setFontSize(6);
      doc.setTextColor(GREY);
      weeks.forEach((week, idx) => {
        const xRatio = weeks.length === 1 ? 0.5 : idx / (weeks.length - 1);
        const x = chartLeft + padding + xRatio * (chartW - padding * 2);
        const vals = week.checkIns.map(getter).filter((v): v is number => v != null);
        doc.text('W' + (idx + 1), x, y + chartH + 3.5, { align: 'center' });
        doc.text('days:' + vals.length, x, y + chartH + 6.5, { align: 'center' });
      });

      doc.setTextColor(BLACK);
      y += chartH + chartGap;
    };

    drawLineChart('Skin Feeling', (c) => c.skinFeeling, 5, '1-5 scale', BRAND_R, BRAND_G, BRAND_B);
    drawLineChart('Sleep Quality', (c) => c.sleepScore, 5, '1-5 scale', 59, 130, 246);
    drawLineChart('Pain / Itch', (c) => c.painScore, 10, '0-10 scale', 220, 80, 60);
    drawLineChart('Mood', (c) => c.mood, 5, '1-5 scale', 34, 170, 90);
  } else {
    doc.setFontSize(10);
    doc.text('Not enough weekly data to generate trend charts (need at least 2 weeks).', M, y);
    y += 8;
  }

  // ================================================================
  // PAGE 3: TREATMENTS & ADHERENCE
  // ================================================================

  doc.addPage();
  y = M;
  sectionHeading('Treatments & Adherence');

  const treatmentCounts = countItems(filtered.flatMap((c) => c.treatments));
  if (treatmentCounts.length > 0) {
    // Column positions - keep within page margins
    const colTreatment = M;
    const colDays = M + 68;
    const colPct = M + 82;
    const colDelta = M + 100;
    const colConf = M + 145;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREY);
    doc.text('TREATMENT', colTreatment, y);
    doc.text('DAYS', colDays, y);
    doc.text('% DAYS', colPct, y);
    doc.text('NEXT-DAY SKIN CHG', colDelta, y);
    doc.text('DATA', colConf, y);
    y += 2;
    drawHr(0.5);
    doc.setTextColor(BLACK);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    treatmentCounts.slice(0, 15).forEach(([rawName, count]) => {
      needsNewPage(7);
      const name = humanize(rawName);
      const pctDays = uniqueDays.size > 0 ? Math.round((count / uniqueDays.size) * 100) : 0;

      // Next-day skin change
      const treatmentDayDates = new Set<string>();
      filtered.forEach((c) => {
        if (c.treatments.includes(rawName)) {
          treatmentDayDates.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
        }
      });

      const nextDaySkinScores: number[] = [];
      const treatmentDaySkinScores: number[] = [];
      filtered.forEach((c) => {
        const d = format(new Date(c.timestamp), 'yyyy-MM-dd');
        const prevDay = format(addDays(new Date(c.timestamp), -1), 'yyyy-MM-dd');
        if (treatmentDayDates.has(prevDay)) nextDaySkinScores.push(c.skinFeeling);
        if (treatmentDayDates.has(d)) treatmentDaySkinScores.push(c.skinFeeling);
      });

      let deltaStr = '-';
      let confidence = 'Low';
      if (nextDaySkinScores.length >= 3 && treatmentDaySkinScores.length >= 3) {
        const delta = avg(nextDaySkinScores) - avg(treatmentDaySkinScores);
        const sign = delta > 0 ? '+' : '';
        deltaStr = sign + delta.toFixed(2);
        confidence = nextDaySkinScores.length >= 10 ? 'High' : nextDaySkinScores.length >= 5 ? 'Medium' : 'Low';
      } else {
        deltaStr = 'Not enough data';
      }

      // Truncate long names
      const maxNameW = colDays - colTreatment - 3;
      let displayName = name;
      while (doc.getTextWidth(displayName) > maxNameW && displayName.length > 3) {
        displayName = displayName.substring(0, displayName.length - 2) + '..';
      }

      doc.text(displayName, colTreatment, y);
      doc.text(String(count), colDays, y);
      doc.text(pctDays + '%', colPct, y);
      doc.text(deltaStr, colDelta, y);

      // Data amount color
      const dataLabel = confidence === 'High' ? 'Lots' : confidence === 'Medium' ? 'Some' : 'Not much';
      doc.setFontSize(8);
      if (confidence === 'High') doc.setTextColor(34, 139, 34);
      else if (confidence === 'Medium') doc.setTextColor(180, 130, 20);
      else doc.setTextColor(GREY, GREY, GREY);
      doc.text(dataLabel, colConf, y);
      doc.setTextColor(BLACK);
      doc.setFontSize(9);
      y += 5.5;
    });

    // "What seems to help" box
    const helpfulTreatments = treatmentCounts
      .filter(([rawName]) => {
        const treatDates = new Set<string>();
        filtered.forEach((c) => {
          if (c.treatments.includes(rawName)) treatDates.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
        });
        const nextDayScores: number[] = [];
        const treatDayScores: number[] = [];
        filtered.forEach((c) => {
          const d = format(new Date(c.timestamp), 'yyyy-MM-dd');
          const prev = format(addDays(new Date(c.timestamp), -1), 'yyyy-MM-dd');
          if (treatDates.has(prev)) nextDayScores.push(c.skinFeeling);
          if (treatDates.has(d)) treatDayScores.push(c.skinFeeling);
        });
        return nextDayScores.length >= 5 && avg(nextDayScores) > avg(treatDayScores);
      })
      .slice(0, 5);

    if (helpfulTreatments.length > 0) {
      y += 4;
      needsNewPage(15);
      const boxH = 6 + helpfulTreatments.length * 5;
      doc.setFillColor(235, 250, 235);
      doc.roundedRect(M, y, usable, boxH, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('What Seems to Help (based on your logs, 5+ days of data)', M + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      helpfulTreatments.forEach(([rawName], i) => {
        doc.text('- ' + humanize(rawName), M + 6, y + 10 + i * 5);
      });
      y += boxH + 4;
    }
  } else {
    doc.setFontSize(10);
    doc.text('No treatments recorded in this period.', M, y);
    y += 8;
  }

  // ================================================================
  // PAGE 4: TRIGGER / HELPER ASSOCIATIONS
  // ================================================================

  doc.addPage();
  y = M;
  sectionHeading('Trigger & Helper Associations');

  // Legend / explanation
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY);
  const legendLines = [
    'How to read: Skin score is 1-5 (higher = better skin day).',
    'Difference = average skin score when you logged this minus average score when you did not.',
    'A negative difference means skin was often worse on days this showed up (based on your logs).',
    'A positive difference means skin was often better on days this showed up (based on your logs).',
    'Lots of data = 10+ days, Some data = 5-9 days, Not much data = under 5 days.',
  ];
  legendLines.forEach((line) => {
    doc.text(line, M, y);
    y += 3.5;
  });
  doc.setTextColor(BLACK);
  y += 4;

  const allTriggers = filtered.flatMap((c) => c.triggers ?? []);
  const generalTriggers = allTriggers.filter(
    (t) => !t.startsWith('food:') && !t.startsWith('product:') && !t.startsWith('new_product:')
  );
  const uniqueTriggers = [...new Set(generalTriggers)];

  interface AssocData {
    name: string;
    rawName: string;
    exposedDays: number;
    unexposedDays: number;
    avgExposed: number;
    avgUnexposed: number;
    delta: number;
    confidence: 'High' | 'Medium' | 'Low';
  }

  const dailyData = buildDailySkinMap(filtered);

  const computeAssociations = (triggerList: string[], prefixToStrip = ''): AssocData[] => {
    const result: AssocData[] = [];
    triggerList.forEach((trigger) => {
      const exposedDates = new Set<string>();
      filtered.forEach((c) => {
        if ((c.triggers ?? []).includes(trigger)) {
          exposedDates.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
        }
      });
      const exposedScores: number[] = [];
      const unexposedScores: number[] = [];
      Object.entries(dailyData).forEach(([date, skinAvg]) => {
        if (exposedDates.has(date)) exposedScores.push(skinAvg);
        else unexposedScores.push(skinAvg);
      });
      if (exposedScores.length >= 2 && unexposedScores.length >= 2) {
        const avgExp = avg(exposedScores);
        const avgUnexp = avg(unexposedScores);
        const conf: AssocData['confidence'] = exposedScores.length >= 10 ? 'High' : exposedScores.length >= 5 ? 'Medium' : 'Low'; // thresholds unchanged
        const cleanName = prefixToStrip ? trigger.replace(new RegExp('^(' + prefixToStrip + ')'), '') : trigger;
        result.push({
          name: humanize(cleanName),
          rawName: trigger,
          exposedDays: exposedScores.length,
          unexposedDays: unexposedScores.length,
          avgExposed: avgExp,
          avgUnexposed: avgUnexp,
          delta: avgExp - avgUnexp,
          confidence: conf,
        });
      }
    });
    result.sort((a, b) => a.delta - b.delta);
    return result;
  };

  const associations = computeAssociations(uniqueTriggers);

  // Column positions for association table
  const aColItem = M;
  const aColExp = M + 50;
  const aColUnexp = M + 66;
  const aColAvgE = M + 84;
  const aColAvgU = M + 104;
  const aColDelta = M + 126;
  const aColConf = M + 146;

  const renderAssocTable = (data: AssocData[], maxItems = 20) => {
    if (data.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Insufficient data for associations.', M + 2, y);
      y += 6;
      return;
    }

    // Table header
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREY);
    doc.text('THING LOGGED', aColItem, y);
    doc.text('DAYS ON', aColExp, y);
    doc.text('DAYS OFF', aColUnexp, y);
    doc.text('AVG SKIN ON', aColAvgE, y);
    doc.text('AVG SKIN OFF', aColAvgU, y);
    doc.text('DIFF', aColDelta, y);
    doc.text('DATA', aColConf, y);
    y += 2;
    drawHr(0.5);
    doc.setTextColor(BLACK);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    data.slice(0, maxItems).forEach((a) => {
      needsNewPage(7);

      // Truncate name to fit
      let displayName = a.name;
      const maxNameW = aColExp - aColItem - 2;
      while (doc.getTextWidth(displayName) > maxNameW && displayName.length > 3) {
        displayName = displayName.substring(0, displayName.length - 2) + '..';
      }

      doc.text(displayName, aColItem, y);
      doc.text(String(a.exposedDays), aColExp, y);
      doc.text(String(a.unexposedDays), aColUnexp, y);
      doc.text(a.avgExposed.toFixed(1), aColAvgE, y);
      doc.text(a.avgUnexposed.toFixed(1), aColAvgU, y);

      // Difference with color
      const sign = a.delta > 0 ? '+' : '';
      const diffText = sign + a.delta.toFixed(2);
      if (a.delta < -0.1) doc.setTextColor(200, 50, 50);
      else if (a.delta > 0.1) doc.setTextColor(34, 139, 34);
      else doc.setTextColor(BLACK);
      doc.text(diffText, aColDelta, y);

      // How much data
      const dataLabel = a.confidence === 'High' ? 'Lots' : a.confidence === 'Medium' ? 'Some' : 'Not much';
      if (a.confidence === 'High') doc.setTextColor(34, 139, 34);
      else if (a.confidence === 'Medium') doc.setTextColor(180, 130, 20);
      else doc.setTextColor(GREY, GREY, GREY);
      doc.text(dataLabel, aColConf, y);
      doc.setTextColor(BLACK);
      y += 5;
    });
    y += 3;
  };

  if (associations.length > 0) {
    renderAssocTable(associations);
  } else {
    doc.setFontSize(10);
    doc.text('Not enough trigger data to show patterns.', M, y);
    y += 8;
  }

  // Food associations
  const foodTriggers = [...new Set(allTriggers.filter(t => t.startsWith('food:')))];
  if (foodTriggers.length > 0) {
    needsNewPage(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK);
    doc.text('Food Diary Associations', M, y);
    y += 6;
    const foodAssoc = computeAssociations(foodTriggers, 'food:');
    renderAssocTable(foodAssoc, 10);
  }

  // Product associations
  const productTriggers = [...new Set(allTriggers.filter(t => t.startsWith('product:') || t.startsWith('new_product:')))];
  if (productTriggers.length > 0) {
    needsNewPage(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK);
    doc.text('Product Diary Associations', M, y);
    y += 6;
    const prodAssoc = computeAssociations(productTriggers, 'product:|new_product:');
    renderAssocTable(prodAssoc, 10);
  }

  // ================================================================
  // PAGE 5: SYMPTOMS SUMMARY
  // ================================================================

  doc.addPage();
  y = M;
  sectionHeading('Symptoms Summary');

  const symptomCounts: Record<string, number> = {};
  const symptomSeverities: Record<string, number[]> = {};
  filtered.forEach((c) =>
    (c.symptomsExperienced ?? []).forEach((s) => {
      const sName = humanize(s.symptom);
      symptomCounts[sName] = (symptomCounts[sName] || 0) + 1;
      if (!symptomSeverities[sName]) symptomSeverities[sName] = [];
      symptomSeverities[sName].push(s.severity);
    })
  );
  const sortedSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]);

  if (sortedSymptoms.length > 0) {
    const daysTracked = uniqueDays.size;

    const sColName = M;
    const sColDays = M + 65;
    const sColPct = M + 82;
    const sColSev = M + 100;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREY);
    doc.text('SYMPTOM', sColName, y);
    doc.text('DAYS', sColDays, y);
    doc.text('% OF DAYS', sColPct, y);
    doc.text('AVG SEVERITY', sColSev, y);
    y += 2;
    drawHr(0.5);
    doc.setTextColor(BLACK);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    sortedSymptoms.slice(0, 15).forEach(([name, count]) => {
      needsNewPage(7);
      const pct = daysTracked > 0 ? Math.round((count / daysTracked) * 100) : 0;
      const avgSev = avg(symptomSeverities[name]);
      const sevLabel = avgSev < 1.5 ? 'Mild' : avgSev < 2.5 ? 'Moderate' : 'Severe';
      doc.text(name, sColName, y);
      doc.text(String(count), sColDays, y);
      doc.text(pct + '%', sColPct, y);
      doc.text(avgSev.toFixed(1) + ' (' + sevLabel + ')', sColSev, y);
      y += 5.5;
    });
    y += 5;

    // Symptom clusters
    if (sortedSymptoms.length >= 2) {
      needsNewPage(20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Common Symptom Clusters', M, y);
      y += 6;

      const coOccurrences: Record<string, number> = {};
      filtered.forEach((c) => {
        const syms = (c.symptomsExperienced ?? []).map(s => humanize(s.symptom)).sort();
        for (let i = 0; i < syms.length; i++) {
          for (let j = i + 1; j < syms.length; j++) {
            const key = syms[i] + ' + ' + syms[j];
            coOccurrences[key] = (coOccurrences[key] || 0) + 1;
          }
        }
      });
      const topClusters = Object.entries(coOccurrences).sort((a, b) => b[1] - a[1]).slice(0, 5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (topClusters.length === 0) {
        doc.text('No symptom co-occurrences found.', M + 2, y);
        y += 5;
      } else {
        topClusters.forEach(([cluster, count]) => {
          needsNewPage(6);
          doc.text('- ' + cluster + ' -- co-occurred ' + count + ' time' + (count > 1 ? 's' : ''), M + 2, y);
          y += 5;
        });
      }
      y += 3;
    }

    // Most severe weeks
    if (weeks.length >= 2) {
      needsNewPage(20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Most Severe Weeks', M, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const weekSeverity = weeks.map((w, idx) => ({
        label: 'W' + (idx + 1) + ' (' + format(w.start, 'dd MMM') + ' - ' + format(w.end, 'dd MMM') + ')',
        avgSkin: avg(w.checkIns.map(c => c.skinFeeling)),
        n: w.checkIns.length,
      })).sort((a, b) => a.avgSkin - b.avgSkin);

      weekSeverity.slice(0, 3).forEach((w) => {
        needsNewPage(6);
        doc.text('- ' + w.label + ' -- avg skin ' + w.avgSkin.toFixed(1) + '/5 (days: ' + w.n + ')', M + 2, y);
        y += 5;
      });
      y += 3;
    }
  } else {
    doc.setFontSize(10);
    doc.text('No symptoms recorded in this period.', M, y);
    y += 8;
  }

  // ================================================================
  // FINAL PAGE: NOTES & DEFINITIONS
  // ================================================================

  doc.addPage();
  y = M;

  if (includeNotes) {
    const withNotes = filtered.filter((c) => c.notes?.trim()).slice(-20);
    if (withNotes.length > 0) {
      sectionHeading('Patient Notes');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      withNotes.forEach((c) => {
        const dateStr = format(new Date(c.timestamp), 'dd MMM yyyy');
        const noteText = dateStr + ': ' + (c.notes || '');
        const noteLines = doc.splitTextToSize(noteText, usable);
        needsNewPage(noteLines.length * 4 + 4);
        doc.text(noteLines, M, y);
        y += noteLines.length * 4 + 2;
      });
      y += 5;
    }
  }

  // Definitions appendix
  needsNewPage(40);
  sectionHeading('Definitions & Methodology');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);

  const definitions = [
    'Skin Feeling (1-5): Self-reported skin comfort. 1 = Very bad, 5 = Very good.',
    'Pain / Itch (0-10): Self-reported pain or itch intensity. 0 = None, 10 = Worst imaginable.',
    'Sleep Quality (1-5): Self-reported sleep quality. 1 = Very poor, 5 = Very good.',
    'Mood (1-5): Self-reported mood. 1 = Very low, 5 = Very good.',
    'Skin Intensity (0-4): Self-reported flare intensity. 0 = Calm, 4 = High-intensity.',
    'Patterns shown here are based on your logged data. They do not imply cause and effect.',
    'Next-day Skin Change: Difference between avg skin score on the day after treatment vs on treatment day.',
    'How much data: Lots = 10+ days, Some = 5-9 days, Not much = under 5 days.',
    'Missing data: Metrics with fewer than 3 entries are labelled "Not enough data".',
    'Difference: Avg skin score on days you logged this minus avg score on days you did not.',
  ];

  definitions.forEach((def) => {
    const defLines = doc.splitTextToSize('- ' + def, usable);
    needsNewPage(defLines.length * 4 + 2);
    doc.text(defLines, M, y);
    y += defLines.length * 4 + 1;
  });

  y += 5;

  // Final disclaimer
  needsNewPage(18);
  doc.setFillColor(255, 248, 230);
  const disclaimerText = 'Disclaimer: This report is generated from self-reported data collected via the TrackTSW app. All trigger, treatment, and helper findings are patterns observed in your logs and do not imply cause and effect. This report is not a medical diagnosis and should be reviewed in context by a qualified clinician.';
  const dLines = doc.splitTextToSize(disclaimerText, usable - 8);
  const disclaimerH = dLines.length * 3.5 + 6;
  doc.roundedRect(M, y, usable, disclaimerH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(GREY);
  doc.text(dLines, M + 4, y + 5);
  doc.setTextColor(BLACK);

  // Add footer ONCE at the very end
  addFooterOnce(doc, pageW, pageH);

  return doc;
};

// ─── PDF Helpers ─────────────────────────────────────────────

/**
 * Adds page footer exactly once per page. Call only at the very end
 * of document generation to avoid duplicate footers.
 */
const addFooterOnce = (doc: jsPDF, pageW: number, pageH: number) => {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160);
    doc.text('TrackTSW Clinician Summary -- Page ' + i + ' of ' + totalPages, pageW / 2, pageH - 8, { align: 'center' });
    doc.setTextColor(0);
  }
};

const buildDailySkinMap = (checkIns: CheckIn[]): Record<string, number> => {
  const dailyScores: Record<string, number[]> = {};
  checkIns.forEach((c) => {
    const d = format(new Date(c.timestamp), 'yyyy-MM-dd');
    if (!dailyScores[d]) dailyScores[d] = [];
    dailyScores[d].push(c.skinFeeling);
  });
  const result: Record<string, number> = {};
  Object.entries(dailyScores).forEach(([d, scores]) => {
    result[d] = avg(scores);
  });
  return result;
};

// ─── Shared Helpers ──────────────────────────────────────────

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
    const weekEnd = dateMin([addDays(current, 6), finalEnd]);
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
