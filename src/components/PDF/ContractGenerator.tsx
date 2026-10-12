import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { company } from '../../lib/company';
import { reservationExtrasService } from '../../lib/database';

interface ContractData {
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

interface ContractGeneratorProps {
  data: ContractData;
}

interface FontCache {
  regular: string;
  bold: string;
}
let cachedFonts: FontCache | null = null;
let fontCacheFailed = false;

async function fetchBase64(url: string): Promise<string> {
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

async function loadFonts(): Promise<FontCache | null> {
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

function registerFonts(doc: jsPDF, fonts: FontCache) {
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
}

function fmtDate(iso: string, locale = 'el-GR'): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
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

const ContractGenerator: React.FC<ContractGeneratorProps> = ({ data }) => {
  const [generating, setGenerating] = useState(false);

  const generateContract = async () => {
    setGenerating(true);
    try {
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

      // Load fonts with Greek support
      const fonts = await loadFonts();
      let fontName = 'helvetica';
      if (fonts) {
        registerFonts(doc, fonts);
        fontName = 'DejaVu';
        doc.setFont('DejaVu', 'normal');
      }

      // Font helpers — use DejaVu when available so Greek renders correctly
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

      const sectionHeader = (title: string, x: number, yy: number, w: number) => {
        fill(13, 71, 161);
        doc.rect(x, yy, w, 6, 'F');
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
        return yy + 10;
      };

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
        doc.text(lines, x + 2, yy + 4);
        normal();
        return yy + 4 + lines.length * 4.5;
      };

      // ═══════════════════════════════════════
      // HEADER
      // ═══════════════════════════════════════
      fill(13, 71, 161);
      doc.rect(0, 0, PW, 30, 'F');

      // Company details (left)
      rgb(255, 255, 255);
      doc.setFontSize(17);
      bold();
      doc.text(company.contractHeader, M, 11);

      doc.setFontSize(8);
      normal();
      doc.text(company.address, M, 17);
      doc.text(`Tel: ${company.phone}  |  ${company.email}  |  ${company.website}`, M, 22);
      doc.text(`ΑΦΜ: ${company.taxNumber}  |  Αρ.Μητρώου: ${company.registrationNumber}`, M, 27);

      // Contract title box (right)
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

      y = 34;

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
      y += 2;
      doc.line(M, y, PW - M, y);
      y += 4;

      // ═══════════════════════════════════════
      // TWO COLUMNS: CUSTOMER | VEHICLE
      // ═══════════════════════════════════════
      const half = CW / 2 - 2;
      const col2 = M + half + 4;

      y = sectionHeader('CUSTOMER INFORMATION  /  ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ', M, y, half);
      const customerStartY = y;
      y = row('Name / Ονοματεπώνυμο', r.customer.name, M, y, half);
      y = row('Phone / Τηλέφωνο', r.customer.phone, M, y, half);
      y = row('Email', r.customer.email, M, y, half);
      y = row('Country / Χώρα', r.customer.country, M, y, half);
      y = row('License No / Αρ. Άδειας', r.customer.license_number, M, y, half);
      y = row('Date of Birth / Ημ. Γέννησης', r.customer.birth_date ? fmtDate(r.customer.birth_date) : '-', M, y, half);
      const customerEndY = y;

      let yv = sectionHeader('VEHICLE INFORMATION  /  ΣΤΟΙΧΕΙΑ ΟΧΗΜΑΤΟΣ', col2, customerStartY - 10, half);
      yv = row('License Plate / Πινακίδα', r.vehicle.plate, col2, yv, half);
      yv = row('Vehicle / Όχημα', `${r.vehicle.brand} ${r.vehicle.model}`, col2, yv, half);
      yv = row('Category / Κατηγορία', r.vehicle.category, col2, yv, half);

      if (r.fuel_level !== undefined)
        yv = row('Fuel Level / Επίπεδο Καυσίμου', fuelFraction(r.fuel_level), col2, yv, half);
      if (r.odometer !== undefined)
        yv = row('Odometer / Χιλιόμετρα Παραλαβής', `${r.odometer.toLocaleString()} km`, col2, yv, half);

      y = Math.max(customerEndY, yv) + 2;

      draw(200, 200, 200);
      lw(0.3);
      doc.line(M, y, PW - M, y);
      y += 2;

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
      y += 4.5;
      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(fmtDateTime(r.pickup_date), colPickup + 2, y);
      y += 5;
      doc.setFontSize(8);
      normal();
      txt(r.pickup_station || '-', colPickup + 2, y);

      // Return column (drawn at same y positions as pickup)
      const rentStartY = y - 9.5;
      let yRet = rentStartY;
      rgb(100, 100, 100);
      doc.setFontSize(7);
      bold();
      doc.text('RETURN / Επιστροφή', colReturn, yRet);
      yRet += 4.5;
      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(fmtDateTime(r.return_date), colReturn, yRet);
      yRet += 5;
      doc.setFontSize(8);
      normal();
      txt(r.return_station || '-', colReturn, yRet);

      // Vertical divider between columns
      draw(200, 200, 200);
      lw(0.3);
      doc.line(M + CW / 2, rentStartY - 2, M + CW / 2, rentStartY + 14);

      y += 5;

      // Duration row spanning full width
      fill(240, 244, 255);
      draw(190, 200, 240);
      lw(0.3);
      doc.rect(M, y, CW, 7, 'FD');
      rgb(13, 71, 161);
      doc.setFontSize(8);
      bold();
      doc.text(`Duration / Διάρκεια: ${days} day${days !== 1 ? 's' : ''} / ημέρ.`, M + CW / 2, y + 4.8, { align: 'center' });
      normal();
      rgb(0, 0, 0);
      y += 9;

      draw(200, 200, 200);
      lw(0.3);
      doc.line(M, y, PW - M, y);
      y += 2;

      // ═══════════════════════════════════════
      // INSURANCE & PAYMENT (two columns)
      // ═══════════════════════════════════════
      const insStartY = y;
      y = sectionHeader('INSURANCE  /  ΑΣΦΑΛΙΣΗ', M, y, half);

      rgb(0, 0, 0);
      doc.setFontSize(9);
      bold();
      txt(insuranceName, M + 2, y);
      y += 5;
      y = row('Insurance Fee / Τέλος Ασφάλισης', `EUR ${Number(r.insurance_rate).toFixed(2)} / day (ημέρα)`, M, y, half);

      let yPay = insStartY;
      yPay = sectionHeader('PAYMENT  /  ΠΛΗΡΩΜΗ', col2, yPay, half);

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
      doc.rect(col2, yPay, half, 10, 'F');
      rgb(255, 255, 255);
      doc.setFontSize(8);
      bold();
      doc.text('TOTAL / ΣΥΝΟΛΟ:', col2 + 2, yPay + 4.5);
      doc.setFontSize(11);
      doc.text(`EUR ${Number(r.total_amount).toFixed(2)}`, col2 + half - 3, yPay + 7, { align: 'right' });
      yPay += 12;

      y = Math.max(y, yPay) + 1;

      draw(200, 200, 200);
      lw(0.3);
      doc.line(M, y, PW - M, y);
      y += 2;

      // ═══════════════════════════════════════
      // VEHICLE CONDITION
      // ═══════════════════════════════════════
      const hasConditionData = r.fuel_level !== undefined || r.odometer !== undefined ||
        (r.accessories_given && r.accessories_given.length > 0) ||
        (r.damages && r.damages.length > 0);

      if (hasConditionData) {
        y = sectionHeader('VEHICLE CONDITION AT PICK-UP  /  ΚΑΤΑΣΤΑΣΗ ΟΧΗΜΑΤΟΣ ΠΑΡΑΛΑΒΗΣ', M, y, CW);

        // Fuel gauge visual
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
        draw(200, 200, 200);
        lw(0.3);
        doc.line(M, y, PW - M, y);
        y += 2;
      }

      // ═══════════════════════════════════════
      // TERMS & CONDITIONS
      // ═══════════════════════════════════════
      y = sectionHeader('TERMS & CONDITIONS  /  ΟΡΟΙ & ΠΡΟΫΠΟΘΕΣΕΙΣ', M, y, CW);

      const terms = [
        '1. The vehicle is delivered to the renter in the condition stated above. / Το όχημα παραδίδεται στον ενοικιαστή στην κατάσταση που αναγράφεται παραπάνω.',
        '2. Vehicle must be returned with the same fuel level. Shortfall will be charged. / Το όχημα πρέπει να επιστραφεί με το ίδιο επίπεδο καυσίμου. Τυχόν έλλειψη χρεώνεται.',
        '3. Renter is liable for all damage during rental up to the self risk amount. / Ο ενοικιαστής ευθύνεται πλήρως για κάθε ζημιά κατά την ενοικίαση πέραν του self risk.',
        '4. Late returns are charged EUR 10.00 per hour. / Καθυστερημένη επιστροφή χρεώνεται EUR 10/ώρα.',
        '5. Smoking and pets are strictly prohibited. / Απαγορεύεται το κάπνισμα και η μεταφορά ζώων.',
        '6. In case of accident, notify the company and authorities immediately. / Σε περίπτωση ατυχήματος ειδοποιήστε άμεσα την εταιρεία και τις αρχές.',
        '7. Driving under the influence of alcohol or drugs is strictly forbidden. / Απαγορεύεται η οδήγηση υπό την επήρεια αλκοόλ ή ναρκωτικών.',
      ];

      doc.setFontSize(6.2);
      normal();
      rgb(40, 40, 40);
      terms.forEach(term => {
        const lines = doc.splitTextToSize(term, CW - 2);
        lines.forEach((line: string) => {
          txt(line, M + 1, y);
          y += 3.3;
        });
      });

      y += 1;

      // ═══════════════════════════════════════
      // DECLARATION
      // ═══════════════════════════════════════
      fill(255, 248, 225);
      draw(230, 180, 0);
      lw(0.4);
      doc.rect(M, y, CW, 9, 'FD');
      rgb(80, 60, 0);
      doc.setFontSize(7);
      normal();
      const decl = 'By signing below I confirm that I have read, understood and accept the above terms. / Με την υπογραφή μου βεβαιώνω ότι έχω διαβάσει, κατανοήσει και αποδέχομαι τους παραπάνω όρους.';
      const declLines = doc.splitTextToSize(decl, CW - 4);
      doc.text(declLines, M + 2, y + 3.5);
      y += 11;

      // Check if signatures fit on this page
      if (y > 245) {
        doc.addPage();
        y = 20;
      }

      // ═══════════════════════════════════════
      // SIGNATURES
      // ═══════════════════════════════════════
      y = sectionHeader('SIGNATURES  /  ΥΠΟΓΡΑΦΕΣ', M, y, CW);

      const sigW = CW / 3 - 3;
      const sigH = 25;
      const sig1x = M;
      const sig2x = M + sigW + 4;
      const sig3x = M + (sigW + 4) * 2;

      // Box 1: Customer
      draw(180, 180, 180);
      lw(0.3);
      fill(252, 252, 252);
      doc.rect(sig1x, y, sigW, sigH, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Customer Signature', sig1x + sigW / 2, y + 4, { align: 'center' });
      doc.text('Υπογραφή Πελάτη', sig1x + sigW / 2, y + 7.5, { align: 'center' });
      rgb(20, 20, 20);
      doc.setFontSize(7.5);
      gr(r.customer.name);
      const nameLines = doc.splitTextToSize(r.customer.name, sigW - 4);
      doc.text(nameLines, sig1x + sigW / 2, y + 20, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig1x + 4, y + sigH - 2, sig1x + sigW - 4, y + sigH - 2);

      // Box 2: Company Agent
      fill(252, 252, 252);
      draw(180, 180, 180);
      doc.rect(sig2x, y, sigW, sigH, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Company Agent', sig2x + sigW / 2, y + 4, { align: 'center' });
      doc.text('Εκπρόσωπος Εταιρείας', sig2x + sigW / 2, y + 7.5, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig2x + 4, y + sigH - 2, sig2x + sigW - 4, y + sigH - 2);

      // Box 3: Date / Ημερομηνία
      fill(252, 252, 252);
      draw(180, 180, 180);
      doc.rect(sig3x, y, sigW, sigH, 'FD');
      rgb(80, 80, 80);
      doc.setFontSize(7);
      normal();
      doc.text('Date / Ημερομηνία', sig3x + sigW / 2, y + 4, { align: 'center' });
      rgb(20, 20, 20);
      doc.setFontSize(8.5);
      bold();
      doc.text(metaDate, sig3x + sigW / 2, y + 15, { align: 'center' });
      normal();
      doc.setFontSize(7);
      rgb(80, 80, 80);
      doc.text('Place / Τόπος:', sig3x + sigW / 2, y + 20, { align: 'center' });
      draw(100, 100, 100);
      doc.line(sig3x + 4, y + sigH - 2, sig3x + sigW - 4, y + sigH - 2);

      y += sigH + 5;

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
};

export default ContractGenerator;
