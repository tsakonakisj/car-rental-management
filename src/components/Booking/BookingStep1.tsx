import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { stationService } from '../../lib/database';

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = formatDate(new Date());

interface Station {
  id: string;
  name: string;
  name_en: string;
}

interface BookingStep1Props {
  data: {
    pickupDate: string;
    returnDate: string;
    pickupTime: string;
    returnTime: string;
    pickupStation: string;
    returnStation: string;
  };
  updateData: (updates: Partial<BookingStep1Props['data']>) => void;
}

const BookingStep1: React.FC<BookingStep1Props> = ({ data, updateData }) => {
  const { t, language } = useLanguage();
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await stationService.getAll();
        setStations(data);
      } catch {
        setStations([]);
      }
    };
    loadStations();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">
            {t('pickupDateTime')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={data.pickupDate}
              min={todayStr}
              onChange={e => updateData({ pickupDate: e.target.value })}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
            <input
              type="time"
              value={data.pickupTime || '09:00'}
              onChange={(e) => updateData({ pickupTime: e.target.value })}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">
            {t('returnDateTime')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={data.returnDate}
              min={data.pickupDate || todayStr}
              onChange={e => updateData({ returnDate: e.target.value })}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
            <input
              type="time"
              value={data.returnTime || '09:00'}
              onChange={(e) => updateData({ returnTime: e.target.value })}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">
            {t('pickupStation')}
          </label>
          <select
            value={data.pickupStation || ''}
            onChange={(e) => updateData({ pickupStation: e.target.value })}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          >
            <option value="">Επιλέξτε σταθμό...</option>
            {stations.map(station => (
              <option key={station.id} value={station.id}>
                {language === 'el' ? station.name : station.name_en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">
            {t('returnStation')}
          </label>
          <select
            value={data.returnStation || ''}
            onChange={(e) => updateData({ returnStation: e.target.value })}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          >
            <option value="">Επιλέξτε σταθμό...</option>
            {stations.map(station => (
              <option key={station.id} value={station.id}>
                {language === 'el' ? station.name : station.name_en}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default BookingStep1;
