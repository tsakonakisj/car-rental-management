import type { Reservation, Vehicle } from '../types';

/**
 * The document expiry date itself is valid. Missing or invalid dates fail closed.
 * Compare ISO calendar dates; reservations use a timestamp without timezone.
 */
export function checkoutDocumentError(
  reservation: Pick<Reservation, 'pickup_date' | 'return_date'>,
  vehicle: Pick<Vehicle, 'insurance_expiry' | 'inspection_expiry'>,
  today: Date = new Date()
): string | null {
  const datePart = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const day = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const [year, month, date] = day.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, date));
    return parsed.toISOString().slice(0, 10) === day ? day : null;
  };

  const pickup = datePart(reservation.pickup_date);
  const returned = datePart(reservation.return_date);
  if (!pickup || !returned || returned < pickup) {
    return 'Οι ημερομηνίες της κράτησης δεν είναι έγκυρες.';
  }

  const current = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const requiredThrough = returned > current ? returned : current;

  const insurance = datePart(vehicle.insurance_expiry);
  const inspection = datePart(vehicle.inspection_expiry);
  if (!insurance) return 'Δεν έχει καταχωριστεί έγκυρη ημερομηνία λήξης ασφάλειας. Το Check-Out δεν επιτρέπεται.';
  if (insurance < requiredThrough) return 'Η ασφάλεια δεν καλύπτει ολόκληρη την περίοδο ενοικίασης. Το Check-Out δεν επιτρέπεται.';
  if (!inspection) return 'Δεν έχει καταχωριστεί έγκυρη ημερομηνία λήξης ΚΤΕΟ. Το Check-Out δεν επιτρέπεται.';
  if (inspection < requiredThrough) return 'Το ΚΤΕΟ δεν καλύπτει ολόκληρη την περίοδο ενοικίασης. Το Check-Out δεν επιτρέπεται.';
  return null;
}
