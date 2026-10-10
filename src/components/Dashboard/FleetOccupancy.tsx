import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { format, addDays, startOfDay } from 'date-fns';
import { el } from 'date-fns/locale';

const FleetOccupancy: React.FC = () => {
  const { t, language } = useLanguage();
  
  // Mock data for next 7 days
  const generateOccupancyData = () => {
    const data = [];
    const categories = ['A', 'B', 'C', 'SUV', '7-seater'];
    
    for (let i = 0; i < 7; i++) {
      const date = addDays(startOfDay(new Date()), i);
      const dayData = {
        date,
        categories: categories.map(category => ({
          category,
          total: Math.floor(Math.random() * 10) + 5,
          occupied: Math.floor(Math.random() * 8) + 1
        }))
      };
      data.push(dayData);
    }
    return data;
  };

  const occupancyData = generateOccupancyData();

  const getOccupancyColor = (percentage: number) => {
    if (percentage < 50) return 'bg-emerald-500';
    if (percentage < 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">{t('fleetOccupancy')}</h3>
      </div>
      
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#1e4e7d]/70">
                <th className="py-2 text-left text-sm font-medium text-blue-100/55">
                  {t('date')}
                </th>
                <th className="py-2 text-center text-sm font-medium text-blue-100/55">A</th>
                <th className="py-2 text-center text-sm font-medium text-blue-100/55">B</th>
                <th className="py-2 text-center text-sm font-medium text-blue-100/55">C</th>
                <th className="py-2 text-center text-sm font-medium text-blue-100/55">SUV</th>
                <th className="py-2 text-center text-sm font-medium text-blue-100/55">7-seater</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e4e7d]/50">
              {occupancyData.map((day, index) => (
                <tr key={index} className="hover:bg-[#0b2949]/50">
                  <td className="py-3 text-sm font-medium text-white">
                    {format(day.date, 'dd/MM', { locale: language === 'el' ? el : undefined })}
                  </td>
                  {day.categories.map((cat) => {
                    const percentage = (cat.occupied / cat.total) * 100;
                    return (
                      <td key={cat.category} className="text-center py-3">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-sm text-white">
                            {cat.occupied}/{cat.total}
                          </span>
                          <div className="w-12 h-2 rounded-full overflow-hidden bg-[#0b2949]/80">
                            <div
                              className={`h-full ${getOccupancyColor(percentage)} transition-all duration-300`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetOccupancy;