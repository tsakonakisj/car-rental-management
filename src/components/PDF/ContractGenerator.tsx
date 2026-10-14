import React, { useState, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { loadCompanyConfig, loadContractTerms, company as defaultCompany } from '../../lib/company';
import { reservationExtrasService } from '../../lib/database';

export interface ContractData {
  reservation: {
    id: string;
    customer: {
      name: string;
      phone: string;
      email: string;
      country: string;
      license_number: string;
      birth_date: string;
    };
    vehicle: {
      plate: string;
      brand: string;
      model: string;
      category: string;
    };
    pickup_date: string;
    return_date: string;
    pickup_station: string;
    return_station: string;
    daily_rate: number;
    insurance_type: string;
    insurance_rate: number;
    total_amount: number;
    extras: Array<{ name: string; quantity: number; price: number }>;
    fuel_level?: number;
    odometer?: number;
    damages?: Array<{ description: string }>;
    accessories_given?: string[];
    deposit_amount?: number;
    payment_method?: string;
  };
}

export interface ContractGeneratorProps {
  data: ContractData;
}

export interface ContractGeneratorRef {
  generate: () => Promise<void>;
}

interface FontCache {
  regular: string;
  bold: string;
}
let cachedFonts: FontCache | null = null;
let fontCacheFailed = false;

export async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...(Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))));
  }
  return btoa(binary);
}

export async function loadFonts(): Promise<FontCache | null> {
  if (fontCacheFailed) return null;
  if (cachedFonts) return cachedFonts;
  try {
    const [regular, bold] = await Promise.all([
      fetchBase64('https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf'),
      fetchBase64('https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf'),
    ]);
    cachedFonts = { regular, bold };
    return cachedFonts;
  } catch {
    fontCacheFailed = true;
    return null;
  }
}

export function registerFonts(doc: jsPDF, fonts: FontCache) {
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
}

export function fmtDate(iso: string, locale = 'el-GR'): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

function fuelFraction(pct: number): string {
  if (pct >= 100) return '8/8 (100%)';
  if (pct >= 87.5) return '7/8';
  if (pct >= 75) return '6/8 (3/4)';
  if (pct >= 62.5) return '5/8';
  if (pct >= 50) return '4/8 (1/2)';
  if (pct >= 37.5) return '3/8';
  if (pct >= 25) return '2/8 (1/4)';
  if (pct >= 12.5) return '1/8';
  return '0/8 (0%)';
}

const ContractGenerator = forwardRef<ContractGeneratorRef, ContractGeneratorProps>(({ data }, ref) => {
  const [generating, setGenerating] = useState(false);

  const generateContract = async () => {
    setGenerating(true);
    try {
      const company = await loadCompanyConfig() || defaultCompany;
      const savedTerms = await loadContractTerms();
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const PW = 210;
      const M = 14;
      const CW = PW - M * 2; // 182mm
      let y = 0;

      const r = data.reservation;
      const days = calcDays(r.pickup_date, r.return_date);
      const insuranceName = r.insurance_type || 'Basic';

      // Fetch saved extras from reservation_extras (with names from extras table)
      let savedExtras: Array<{ name: string; quantity: number; price: number }> = r.extras || [];
      try {
        const detailed = await reservationExtrasService.getDetailedByReservationId(r.id);
        if (detailed.length > 0) {
          savedExtras = detailed.map(ex => ({
            name: ex.name,
            quantity: ex.quantity,
            price: ex.daily_rate
          }));
        }
      } catch {
        // fall back to whatever was passed in r.extras
      }

      const hasCondData = r.fuel_level !== undefined || r.odometer !== undefined ||
        (r.accessories_given && r.accessories_given.length > 0) ||
        (r.damages && r.damages.length > 0);

      // Layout constants — single moderate spacing that fits one page with extras
      const HDR_H = 6;        // section header bar height
      const HDR_GAP = 9;      // gap below header bar to first row label (bar=6mm + 3mm clearance for text ascent)
      const ROW_VAL_OFF = 3.5; // value baseline below label baseline
      const ROW_LH = 4;       // line height for wrapped value text
      const ROW_PAD = 0.5;    // padding after value to next row
      const SEC_GAP = 1.5;    // gap between sections (after separator line)
      const TERM_LH = 3.0;    // terms line height
      const DECL_H = 8;       // declaration box height
      const DECL_GAP = 5;     // gap after declaration box
      const SIG_H = 22;       // signature box height
      const SIG_GAP = 2;      // gap after signature boxes

      // Load fonts with Greek support
      const fonts = await loadFonts();
      let fontName = 'helvetica';
      if (fonts) {
        registerFonts(doc, fonts);
        fontName = 'DejaVu';
        doc.setFont('DejaVu', 'normal');
      }

      // Font helpers
      const gr = (_text: string) => doc.setFont(fontName, 'normal');
      const bold = () => doc.setFont(fontName, 'bold');
      const normal = () => doc.setFont(fontName, 'normal');
      const rgb = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
      const fill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
      const draw = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
      const lw = (w: number) => doc.setLineWidth(w);

      const txt = (text: string, x: number, yy: number, opts?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
        gr(text);
        doc.text(text, x, yy, opts as any);
        normal();
      };

      const sectionHeader = (title: string, x: number, yy: number, w: number): number => {
        fill(13, 71, 161);
        doc.rect(x, yy, w, HDR_H, 'F');
        const sep = title.indexOf('  /  ');
        if (sep > 0) {
          const eng = title.substring(0, sep);
          const grk = '  /  ' + title.substring(sep + 5);
          doc.setFontSize(8.5);
          bold();
          rgb(255, 255, 255);
          doc.text(eng, x + 3, yy + 4.2);
          const engW = doc.getTextWidth(eng);
          doc.setFontSize(7);
          normal();
          rgb(185, 210, 255);
          doc.text(grk, x + 3 + engW, yy + 4.2);
        } else {
          doc.setFontSize(8.5);
          bold();
          rgb(255, 255, 255);
          doc.text(title, x + 3, yy + 4.2);
        }
        rgb(0, 0, 0);
        normal();
        return yy + HDR_GAP;
      };

      // Row draws a label at yy, value below it, returns next y based on actual wrapped lines
      const row = (label: string, value: string, x: number, yy: number, colW: number): number => {
        const sep = label.indexOf(' / ');
        if (sep > 0) {
          const eng = label.substring(0, sep);
          const grk = ' / ' + label.substring(sep + 3);
          doc.setFontSize(7.5);
          rgb(80, 80, 80);
          normal();
          doc.text(eng, x + 2, yy);
          const engW = doc.getTextWidth(eng);
          doc.setFontSize(6.5);
          rgb(155, 155, 155);
          doc.text(grk, x + 2 + engW, yy);
        } else {
          doc.setFontSize(7.5);
          rgb(100, 100, 100);
          normal();
          doc.text(label, x + 2, yy);
        }
        rgb(20, 20, 20);
        doc.setFontSize(8.5);
        gr(value);
        const lines = doc.splitTextToSize(value || '-', colW - 6);
        doc.text(lines, x + 2, yy + ROW_VAL_OFF);
        normal();
        return yy + ROW_VAL_OFF + lines.length * ROW_LH + ROW_PAD;
      };

      // Separator line + gap
      const separator = () => {
        draw(200, 200, 200);
        lw(0.3);
        doc.line(M, y, PW - M, y);
        y += SEC_GAP;
      };

      // ═══════════════════════════════════════
      // HEADER
      // ═══════════════════════════════════════
      fill(13, 71, 161);
      doc.rect(0, 0, PW, 30, 'F');

      rgb(255, 255, 255);
      doc.setFontSize(17);
      bold();
      doc.text(company.name, M, 11);

      doc.setFontSize(8);
      normal();
      doc.text(company.address, M, 17);
      doc.text(`Tel: ${company.phone}  |  ${company.email}  |  ${company.website}`, M, 22);
      doc.text(`ΑΦΜ: ${company.taxNumber}  |  Αρ.Μητρώου: ${company.registrationNumber}`, M, 27);

      fill(255, 255, 255);
      doc.rect(PW - 70, 4, 57, 22, 'F');
      rgb(13, 71, 161);
      doc.setFontSize(9);
      bold();
      doc.text('CAR RENTAL AGREEMENT', PW - 41.5, 12, { align: 'center' });
      doc.setFontSize(7.5);
      normal();
      rgb(100, 120, 180);
      doc.text('ΣΥΜΒΟΛΑΙΟ ΕΝΟΙΚΙΑΣΗΣ', PW - 41.5, 17, { align: 'center' });
      doc.setFontSize(7.5);
      normal();
      rgb(80, 80, 80);
      doc.text(`No: ${r.id.substring(0, 8).toUpperCase()}`, PW - 41.5, 22, { align: 'center' });

      y = 33;

      // ═══════════════════════════════════════
      // META ROW
      // ═══════════════════════════════════════
      rgb(0, 0, 0);
      doc.setFontSize(7.5);
      normal();
      const metaDate = new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(`Print Date / Ημερομηνία Εκτύπωσης: ${metaDate}`, M, y);
      doc.text(`Booking Ref / Αρ. Κράτησης: ${r.id.substring(0, 8).toUpperCase()}`, PW / 2, y, { align: 'center' });

      draw(13, 71, 161);
      lw(0.5);
      y += 1.5;
      doc.line(M, y, PW - M, y);
      y += 3;

      // ═══════════════════════════════════════
      // TWO COLUMNS: CUSTOMER | VEHICLE
      // ═══════════════════════════════════════
      const half = CW / 2 - 2;
      const col2 = M + half + 4;

      const colTopY = y;
      y = sectionHeader('CUSTOMER INFORMATION  /  ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ', M, y, half);
      const customerStartY = y;
      y = row('Name / Ονοματεπώνυμο', r.customer.name, M, y, half);
      y = row('Phone / Τηλέφωνο', r.customer.phone, M, y, half);
      y = row('Email', r.customer.email, M, y, half);
      y = row('Country / Χώρα', r.customer.country, M, y, half);
      y = row('License No / Αρ. Άδειας', r.customer.license_number, M, y, half);
      y = row('Date of Birth / Ημ. Γέννησης', r.customer.birth_date ? fmtDate(r.customer.birth_date) : '-', M, y, half);
      const customerEndY = y;

      // Vehicle column starts at same y as customer column header
      let yv = sectionHeader('VEHICLE INFORMATION  /  ΣΤΟΙΧΕΙΑ ΟΧΗΜΑΤΟΣ', col2, colTopY, half);
      yv = row('License Plate / Πινακίδα', r.vehicle.plate, col2, yv, half);
      yv = row('Vehicle / Όχημα', `${r.vehicle.brand} ${r.vehicle.model}`, col2, yv, half);
      yv = row('Category / Κατηγορία', r.vehicle.category, col2, yv, half);

      if (r.fuel_level !== undefined)
        yv = row('Fuel Level / Επίπεδο Καυσίμου', fuelFraction(r.fuel_level), col2, yv, half);
      if (r.odometer !== undefined)
        yv = row('Odometer / Χιλιόμετρα Παραλαβής', `${r.odometer.toLocaleString()} km`, col2, yv, half);

      y = Math.max(customerEndY, yv) + SEC_GAP;
      separator();

      // ═══════════════════════════════════════
      // RENTAL PERIOD
      // ═══════════════════════════════════════
      y = sectionHeader('RENTAL PERIOD  /  ΠΕΡΙΟΔΟΣ ΕΝΟΙΚΙΑΣΗΣ', M, y, CW);

      const colPickup = M;
      const colReturn = M + CW / 2 + 2;

      // Pickup column
      rgb(100, 100, 100);
      doc.setFontSize(7);
      bold();
      doc.text('PICK-UP / Παραλαβή', colPickup + 2, y);
      y += 4;
      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(fmtDateTime(r.pickup_date), colPickup + 2, y);
      y += 4.5;
      doc.setFontSize(8);
      normal();
      txt(r.pickup_station || '-', colPickup + 2, y);

      // Return column (drawn at same y positions as pickup)
      const rentStartY = y - 8.5;
      let yRet = rentStartY;
      rgb(100, 100, 100);
      doc.setFontSize(7);
      bold();
      doc.text('RETURN / Επιστροφή', colReturn, yRet);
      yRet += 4;
      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(fmtDateTime(r.return_date), colReturn, yRet);
      yRet += 4.5;
      doc.setFontSize(8);
      normal();
      txt(r.return_station || '-', colReturn, yRet);

      // Vertical divider between columns
      draw(200, 200, 200);
      lw(0.3);
      doc.line(M + CW / 2, rentStartY - 2, M + CW / 2, rentStartY + 12);

      y += 4;

      // Duration row spanning full width
      fill(240, 244, 255);
      draw(190, 200, 240);
      lw(0.3);
      doc.rect(M, y, CW, 6, 'FD');
      rgb(13, 71, 161);
      doc.setFontSize(8);
      bold();
      doc.text(`Duration / Διάρκεια: ${days} day${days !== 1 ? 's' : ''} / ημέρ.`, M + CW / 2, y + 4.2, { align: 'center' });
      normal();
      rgb(0, 0, 0);
      y += 8;

      separator();

      // ═══════════════════════════════════════
      // INSURANCE & PAYMENT (two columns)
      // ═══════════════════════════════════════
      const insStartY = y;
      y = sectionHeader('INSURANCE  /  ΑΣΦΑΛΙΣΗ', M, y, half);

      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(insuranceName, M + 2, y);
      y += 4.5;
      y = row('Insurance Fee / Τέλος Ασφάλισης', `EUR ${Number(r.insurance_rate).toFixed(2)} / day (ημέρα)`, M, y, half);

      let yPay = sectionHeader('PAYMENT  /  ΠΛΗΡΩΜΗ', col2, insStartY, half);

      const payMethod = r.payment_method
        ? (r.payment_method === 'cash' ? 'Cash / Μετρητά' : 'Card / Κάρτα')
        : '-';
      yPay = row('Payment Method / Τρόπος Πληρωμής', payMethod, col2, yPay, half);

      if (r.deposit_amount !== undefined)
        yPay = row('Deposit / Εγγύηση', `EUR ${Number(r.deposit_amount).toFixed(2)}`, col2, yPay, half);

      yPay = row('Daily Rate / Ημερήσιο Τέλος', `EUR ${Number(r.daily_rate).toFixed(2)}`, col2, yPay, half);
      yPay = row('Days / Αριθμός Ημερών', String(days), col2, yPay, half);

      if (savedExtras.length > 0) {
        savedExtras.forEach(ex => {
          yPay = row(`${ex.name} (x${ex.quantity})`, `EUR ${(ex.price * ex.quantity).toFixed(2)}`, col2, yPay, half);
        });
      }

      // Total box
      fill(13, 71, 161);
      doc.rect(col2, yPay, half, 9, 'F');
      rgb(255, 255, 255);
      doc.setFontSize(8);
      bold();
      doc.text('TOTAL / ΣΥΝΟΛΟ:', col2 + 2, yPay + 4);
      doc.setFontSize(11);
      doc.text(`EUR ${Number(r.total_amount).toFixed(2)}`, col2 + half - 3, yPay + 6.5, { align: 'right' });
      yPay += 11;

      y = Math.max(y, yPay) + 0.5;
      separator();

      // ═══════════════════════════════════════
      // VEHICLE CONDITION
      // ═══════════════════════════════════════
      if (hasCondData) {
        y = sectionHeader('VEHICLE CONDITION AT PICK-UP  /  ΚΑΤΑΣΤΑΣΗ ΟΧΗΜΑΤΟΣ ΠΑΡΑΛΑΒΗΣ', M, y, CW);

        if (r.fuel_level !== undefined) {
          doc.setFontSize(7.5);
          rgb(80, 80, 80);
          doc.text('Fuel / Καύσιμα:', M + 2, y);
          const gaugeX = M + 30;
          const gaugeW = 60;
          const gaugeH = 5;
          draw(180, 180, 180);
          lw(0.3);
          fill(230, 230, 230);
          doc.rect(gaugeX, y - 4, gaugeW, gaugeH, 'FD');
          const fillPct = r.fuel_level / 100;
          const fillColor = r.fuel_level > 60 ? [46, 125, 50] : r.fuel_level > 25 ? [230, 120, 0] : [198, 40, 40];
          fill(fillColor[0], fillColor[1], fillColor[2]);
          draw(fillColor[0], fillColor[1], fillColor[2]);
          doc.rect(gaugeX, y - 4, gaugeW * fillPct, gaugeH, 'F');
          rgb(0, 0, 0);
          doc.text(`${fuelFraction(r.fuel_level)}`, gaugeX + gaugeW + 3, y);
          y += 6;
        }

        if (r.odometer !== undefined) {
          doc.setFontSize(7.5);
          rgb(80, 80, 80);
          doc.text('Odometer at Pick-up / Χιλιόμετρα Παραλαβής:', M + 2, y);
          rgb(0, 0, 0);
          doc.setFontSize(8.5);
          bold();
          doc.text(`${r.odometer.toLocaleString()} km`, M + 85, y);
          normal();
          y += 6;
        }

        if (r.accessories_given && r.accessories_given.length > 0) {
          doc.setFontSize(7.5);
          rgb(80, 80, 80);
          doc.text('Accessories Provided / Αξεσουάρ που Παραδόθηκαν:', M + 2, y);
          y += 4;
          rgb(0, 0, 0);
          doc.setFontSize(8);
          normal();
          const accLine = r.accessories_given.join('  •  ');
          const accLines = doc.splitTextToSize(accLine, CW - 4);
          txt(accLine, M + 4, y);
          y += accLines.length * 4.5 + 2;
        }

        if (r.damages && r.damages.length > 0) {
          doc.setFontSize(7.5);
          rgb(150, 50, 0);
          bold();
          doc.text('Pre-existing Damages / Προϋπάρχουσες Ζημιές:', M + 2, y);
          y += 4;
          r.damages.forEach((d, i) => {
            rgb(100, 40, 0);
            normal();
            doc.setFontSize(8);
            const dmgLines = doc.splitTextToSize(`${i + 1}. ${d.description}`, CW - 8);
            txt(`${i + 1}. ${d.description}`, M + 4, y);
            y += dmgLines.length * 4.5;
          });
          y += 2;
        } else {
          doc.setFontSize(7.5);
          rgb(46, 125, 50);
          doc.text('No damages noted at pick-up. / Δεν καταγράφηκαν ζημιές κατά την παραλαβή.', M + 2, y);
          y += 5;
        }

        rgb(0, 0, 0);
        separator();
      }

      // ═══════════════════════════════════════
      // TERMS & CONDITIONS
      // ═══════════════════════════════════════
      const terms = savedTerms.map((term, i) => `${i + 1}. ${term.en} / ${term.el}`);

      // Pre-wrap terms to calculate actual height for page-break decision
      // Must set the same font size used for rendering (6.2pt) so line counts match
      doc.setFontSize(6.2);
      const termsWrapped = terms.map(t => doc.splitTextToSize(t, CW - 2));
      const totalTermLines = termsWrapped.reduce((sum, lines) => sum + lines.length, 0);
      const termsBlockHeight = HDR_GAP + totalTermLines * TERM_LH + 1;
      const declBlockHeight = DECL_H + DECL_GAP - DECL_H + DECL_GAP; // box + gap
      const sigBlockHeight = HDR_GAP + SIG_H + SIG_GAP;
      const remainingHeight = termsBlockHeight + DECL_GAP + SIG_H + SIG_GAP + HDR_GAP;

      // If terms + declaration + signatures don't fit before footer (282mm), break cleanly
      if (y + remainingHeight > 282) {
        doc.addPage();
        y = 20;
      }

      y = sectionHeader('TERMS & CONDITIONS  /  ΟΡΟΙ & ΠΡΟΫΠΟΘΕΣΕΙΣ', M, y, CW);

      doc.setFontSize(6.2);
      normal();
      rgb(40, 40, 40);
      termsWrapped.forEach(lines => {
        lines.forEach((line: string) => {
          txt(line, M + 1, y);
          y += TERM_LH;
        });
      });

      y += 1;

      // ═══════════════════════════════════════
      // DECLARATION
      // ═══════════════════════════════════════
      fill(255, 248, 225);
      draw(230, 180, 0);
      lw(0.4);
      doc.rect(M, y, CW, DECL_H, 'FD');
      rgb(80, 60, 0);
      doc.setFontSize(7);
      normal();
      const decl = 'By signing below I confirm that I have read, understood and accept the above terms. / Με την υπογραφή μου βεβαιώνω ότι έχω διαβάσει, κατανοήσει και αποδέχομαι τους παραπάνω όρους.';
      const declLines = doc.splitTextToSize(decl, CW - 4);
      doc.text(declLines, M + 2, y + 3.5);
      y += DECL_H + 2;

      // ═══════════════════════════════════════
      // SIGNATURES
      // ═══════════════════════════════════════
      y = sectionHeader('SIGNATURES  /  ΥΠΟΓΡΑΦΕΣ', M, y, CW);

      const sigW = CW / 3 - 3;
      const sig1x = M;
      const sig2x = M + sigW + 4;
      const sig3x = M + (sigW + 4) * 2;

      // Box 1: Customer
      draw(180, 180, 180);
      lw(0.3);
      fill(252, 252, 252);
      doc.rect(sig1x, y, sigW, SIG_H, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Customer Signature', sig1x + sigW / 2, y + 3.5, { align: 'center' });
      doc.text('Υπογραφή Πελάτη', sig1x + sigW / 2, y + 6.5, { align: 'center' });
      rgb(20, 20, 20);
      doc.setFontSize(7.5);
      gr(r.customer.name);
      const nameLines = doc.splitTextToSize(r.customer.name, sigW - 4);
      doc.text(nameLines, sig1x + sigW / 2, y + 18, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig1x + 4, y + SIG_H - 2, sig1x + sigW - 4, y + SIG_H - 2);

      // Box 2: Company Agent
      fill(252, 252, 252);
      draw(180, 180, 180);
      doc.rect(sig2x, y, sigW, SIG_H, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Company Agent', sig2x + sigW / 2, y + 3.5, { align: 'center' });
      doc.text('Εκπρόσωπος Εταιρείας', sig2x + sigW / 2, y + 6.5, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig2x + 4, y + SIG_H - 2, sig2x + sigW - 4, y + SIG_H - 2);

      // Box 3: Date / Ημερομηνία
      fill(252, 252, 252);
      draw(180, 180, 180);
      doc.rect(sig3x, y, sigW, SIG_H, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Date / Ημερομηνία', sig3x + sigW / 2, y + 3.5, { align: 'center' });
      rgb(20, 20, 20);
      doc.setFontSize(8.5);
      bold();
      doc.text(metaDate, sig3x + sigW / 2, y + 13, { align: 'center' });
      normal();
      doc.setFontSize(7);
      rgb(80, 80, 80);
      doc.text('Place / Τόπος:', sig3x + sigW / 2, y + 18, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig3x + 4, y + SIG_H - 2, sig3x + sigW - 4, y + SIG_H - 2);

      y += SIG_H + SIG_GAP;

      // ═══════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════
      const footerY = 287;
      draw(200, 200, 200);
      lw(0.3);
      doc.line(M, footerY - 3, PW - M, footerY - 3);
      rgb(120, 120, 120);
      doc.setFontSize(6.5);
      normal();
      doc.text(`${company.name}  |  ${company.address}  |  ${company.phone}  |  ${company.email}  |  ${company.website}`, PW / 2, footerY, { align: 'center' });
      doc.text(`ΑΦΜ: ${company.taxNumber}  |  ${company.registrationNumber}`, PW / 2, footerY + 4, { align: 'center' });

      doc.save(`contract-${r.id.substring(0, 8)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  useImperativeHandle(ref, () => ({ generate: generateContract }));

  return (
    <button
      onClick={generateContract}
      disabled={generating}
      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <DocumentTextIcon className="h-4 w-4 mr-1" />
      {generating ? 'Δημιουργία...' : 'Σύμβολαιο PDF'}
    </button>
  );
});

export default ContractGenerator;

