import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { loadCompanyConfig, company as defaultCompany } from '../../lib/company';
import { paymentService } from '../../lib/database';
import type { Payment } from '../../types';
import { loadFonts, registerFonts, fmtDateTime } from './ContractGenerator';

interface BookingConfirmationData {
  reservationId: string;
  customerName: string;
  customerPhone: string;
  vehicleLabel: string;
  vehicleCategory: string;
  pickupDate: string;
  returnDate: string;
  pickupStation: string;
  returnStation: string;
  totalAmount: number;
}

interface BookingConfirmationProps {
  data: BookingConfirmationData;
  compact?: boolean;
}

const methodLabels: Record<string, string> = {
  cash: 'Μετρητά',
  card: 'Κάρτα',
  transfer: 'Μεταφορά',
};

function drawConfirmationCopy(
  doc: jsPDF,
  fontName: string,
  company: typeof defaultCompany,
  r: BookingConfirmationData,
  payments: Payment[],
  startY: number,
  copyLabel: string
): number {
  const PW = 210;
  const M = 14;
  const CW = PW - M * 2;
  let y = startY;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, r.totalAmount - totalPaid);

  // Header bar
  doc.setFillColor(13, 71, 161);
  doc.rect(0, y, PW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.text(company.name, M, y + 8);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  doc.text(company.address, M, y + 13);
  doc.text(`Tel: ${company.phone}  |  ${company.email}  |  ${company.website}`, M, y + 18);

  // Right side: title box
  doc.setFillColor(255, 255, 255);
  doc.rect(PW - 70, y + 2, 57, 18, 'F');
  doc.setTextColor(13, 71, 161);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(8.5);
  doc.text('BOOKING CONFIRMATION', PW - 41.5, y + 8, { align: 'center' });
  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 120, 180);
  doc.text('Αποδεικτικό Κράτησης', PW - 41.5, y + 13, { align: 'center' });

  y += 25;

  // Copy label badge
  doc.setFillColor(240, 244, 255);
  doc.setDrawColor(190, 200, 240);
  doc.setLineWidth(0.3);
  doc.rect(M, y - 3, CW, 6, 'FD');
  doc.setTextColor(13, 71, 161);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  doc.text(copyLabel, M + 2, y + 1);
  doc.setTextColor(80, 80, 80);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  const metaDate = new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Ημ. Εκτύπωσης: ${metaDate}`, PW - M - 2, y + 1, { align: 'right' });
  y += 7;

  // Booking number
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.setFont(fontName, 'normal');
  doc.text('Αριθμός Κράτησης / Booking No:', M + 2, y);
  doc.setTextColor(20, 20, 20);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.text(r.reservationId.substring(0, 8).toUpperCase(), M + 62, y);
  y += 6;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 4;

  // Two columns: customer | vehicle
  const half = CW / 2 - 2;
  const col2 = M + half + 4;

  // Customer column
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'bold');
  doc.text('ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ / CUSTOMER', M + 2, y);
  y += 4.5;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'normal');
  doc.text('Όνομα / Name:', M + 2, y);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  const nameLines = doc.splitTextToSize(r.customerName || '-', half - 6);
  doc.text(nameLines, M + 2, y + 4);
  y += 4 + nameLines.length * 4 + 1;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'normal');
  doc.text('Τηλέφωνο / Phone:', M + 2, y);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  doc.text(r.customerPhone || '-', M + 2, y + 4);
  y += 9;

  // Vehicle column (starts at same y as customer header)
  const vehStartY = y - 13.5;
  let yv = vehStartY;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'bold');
  doc.text('ΟΧΗΜΑ / VEHICLE', col2, yv);
  yv += 4.5;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'normal');
  doc.text('Όχημα / Vehicle:', col2, yv);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  const vehLines = doc.splitTextToSize(r.vehicleLabel || '-', half - 6);
  doc.text(vehLines, col2, yv + 4);
  yv += 4 + vehLines.length * 4 + 1;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'normal');
  doc.text('Κατηγορία / Category:', col2, yv);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  doc.text(r.vehicleCategory || '-', col2, yv + 4);
  yv += 9;

  y = Math.max(y, yv) + 2;

  // Rental period
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 4;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'bold');
  doc.text('ΠΕΡΙΟΔΟΣ ΕΝΟΙΚΙΑΣΗΣ / RENTAL PERIOD', M + 2, y);
  y += 5;

  const colPickup = M;
  const colReturn = M + CW / 2 + 2;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.setFont(fontName, 'bold');
  doc.text('Παραλαβή / Pick-up', colPickup + 2, y);
  doc.text('Επιστροφή / Return', colReturn, y);
  y += 4;

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  doc.text(fmtDateTime(r.pickupDate), colPickup + 2, y);
  doc.text(fmtDateTime(r.returnDate), colReturn, y);
  y += 4.5;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.setFont(fontName, 'normal');
  const pickupLines = doc.splitTextToSize(r.pickupStation || '-', half - 4);
  doc.text(pickupLines, colPickup + 2, y);
  const returnLines = doc.splitTextToSize(r.returnStation || '-', half - 4);
  doc.text(returnLines, colReturn, y);
  y += Math.max(pickupLines.length, returnLines.length) * 4 + 3;

  // Payment summary
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 4;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont(fontName, 'bold');
  doc.text('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ / PAYMENT SUMMARY', M + 2, y);
  y += 5;

  // Three-column summary
  const colW = CW / 3 - 2;
  const col1x = M;
  const col2x = M + colW + 3;
  const col3x = M + (colW + 3) * 2;

  const drawAmountBox = (x: number, label: string, value: string, bg: [number, number, number], fg: [number, number, number]) => {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(bg[0], bg[1], bg[2]);
    doc.rect(x, y - 1, colW, 12, 'F');
    doc.setTextColor(fg[0], fg[1], fg[2]);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.5);
    doc.text(label, x + colW / 2, y + 2, { align: 'center' });
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.text(value, x + colW / 2, y + 8, { align: 'center' });
  };

  drawAmountBox(col1x, 'Σύνολο / Total', `€${r.totalAmount.toFixed(2)}`, [240, 244, 255], [20, 20, 20]);
  drawAmountBox(col2x, 'Πληρωμένο / Paid', `€${totalPaid.toFixed(2)}`, [220, 245, 230], [20, 100, 60]);
  const remBg: [number, number, number] = remaining > 0 ? [255, 240, 220] : [220, 245, 230];
  const remFg: [number, number, number] = remaining > 0 ? [180, 80, 0] : [20, 100, 60];
  drawAmountBox(col3x, 'Υπόλοιπο / Balance', `€${remaining.toFixed(2)}`, remBg, remFg);

  y += 16;

  // Payment history lines (compact)
  if (payments.length > 0) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.setFont(fontName, 'normal');
    doc.text('Πληρωμές / Payments:', M + 2, y);
    y += 3.5;
    payments.forEach((p, i) => {
      const dateStr = new Date(p.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const method = methodLabels[p.method] || p.method;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7);
      doc.text(`${i + 1}. €${p.amount.toFixed(2)} — ${method} — ${dateStr}`, M + 6, y);
      y += 3.5;
    });
    y += 2;
  } else {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont(fontName, 'normal');
    doc.text('Δεν έχουν καταχωρηθεί πληρωμές. / No payments recorded yet.', M + 2, y);
    y += 5;
  }

  // Signature line
  y += 3;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(M + 4, y, M + CW / 2 - 8, y);
  doc.line(M + CW / 2 + 8, y, PW - M - 4, y);
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(6.5);
  doc.setFont(fontName, 'normal');
  doc.text('Υπογραφή Πελάτη / Customer Signature', M + CW / 4 - 4, y + 3.5, { align: 'center' });
  doc.text('Υπογραφή Εκπροσώπου / Company Signature', M + 3 * CW / 4 + 4, y + 3.5, { align: 'center' });

  y += 8;

  // Footer for this copy
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(6);
  doc.setFont(fontName, 'normal');
  doc.text(`${company.name}  |  ${company.address}  |  ${company.phone}  |  ΑΦΜ: ${company.taxNumber}`, PW / 2, y, { align: 'center' });

  return y + 4;
}

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({ data, compact = false }) => {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const company = await loadCompanyConfig() || defaultCompany;
      const payments = await paymentService.getByReservationId(data.reservationId);

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const PW = 210;
      const M = 14;

      const fonts = await loadFonts();
      let fontName = 'helvetica';
      if (fonts) {
        registerFonts(doc, fonts);
        fontName = 'DejaVu';
        doc.setFont('DejaVu', 'normal');
      }

      // Customer copy (top half)
      const afterFirst = drawConfirmationCopy(doc, fontName, company, data, payments, 0, 'ΑΝΤΙΓΡΑΦΟ ΠΕΛΑΤΗ / CUSTOMER COPY');

      // Dashed cut line
      const cutY = afterFirst + 4;
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([3, 2], 0);
      doc.line(M, cutY, PW - M, cutY);
      doc.setLineDashPattern([], 0);

      // Scissors icon text at right
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont(fontName, 'normal');
      doc.text('✂', PW - M - 2, cutY - 1, { align: 'right' });

      // Office copy (bottom half)
      drawConfirmationCopy(doc, fontName, company, data, payments, cutY + 4, 'ΑΝΤΙΓΡΑΦΟ ΓΡΑΦΕΙΟΥ / OFFICE COPY');

      doc.save(`booking-confirmation-${data.reservationId.substring(0, 8)}.pdf`);
    } catch (err) {
      console.error('Booking confirmation PDF failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generate}
      disabled={generating}
      className={compact
        ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-2.5 text-xs font-semibold text-blue-50 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'
        : 'inline-flex items-center px-3 py-1.5 border border-[#2b5b85]/80 bg-[#0b2949]/75 text-sm font-medium rounded text-[#8ec7ff] hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors'}
    >
      <PrinterIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{generating ? 'Δημιουργία...' : 'Αποδεικτικό Κράτησης'}</span>
    </button>
  );
};

export default BookingConfirmation;
