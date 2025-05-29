import React, { useState, useMemo } from 'react';
import { useFestivals } from '../contexts/FestivalsContext';
import { FestivalInfo, JalaliDate } from '../types';
import { jalaaliToday, jalaaliMonthLength, toJalaali, toGregorian, weekDay, parseJalaliDate, formatGregorianDate } from '../utils/dateConverter';
import { PERSIAN_MONTH_NAMES, PERSIAN_WEEK_DAYS_SHORT } from '../constants';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { FestivalModal } from './FestivalModal';

type DeadlineStatus = 'past' | 'urgent' | 'near' | 'far' | '';

interface DayCell {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dateStr: string; // YYYY/MM/DD Jalali
  festivals: FestivalInfo[];
  deadlineStatus: DeadlineStatus; // Overall status for cell background highlighting
}

const getFestivalDeadlineStatus = (festival: FestivalInfo): DeadlineStatus => {
  let deadlineDateObj: Date | null = null;
  if (festival.submissionDeadlineGregorian) {
    try {
      const [year, month, day] = festival.submissionDeadlineGregorian.split('-').map(Number);
      deadlineDateObj = new Date(year, month - 1, day);
       if (isNaN(deadlineDateObj.getTime())) deadlineDateObj = null;
    } catch (e) { deadlineDateObj = null; }
  } else if (festival.submissionDeadlinePersian) {
    try {
      const jDate = parseJalaliDate(festival.submissionDeadlinePersian);
      if (jDate) {
        const gDate = toGregorian(jDate.jy, jDate.jm, jDate.jd);
        deadlineDateObj = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
        if (isNaN(deadlineDateObj.getTime())) deadlineDateObj = null;
      }
    } catch (e) { deadlineDateObj = null; }
  }

  if (!deadlineDateObj) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDateObj.setHours(0, 0, 0, 0);

  const diffTime = deadlineDateObj.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'past';
  if (diffDays < 3) return 'urgent';
  if (diffDays <= 10) return 'near';
  return 'far';
};

const getOverallDeadlineStatusForDay = (festivalsOnDay: FestivalInfo[]): DeadlineStatus => {
  if (!festivalsOnDay || festivalsOnDay.length === 0) return '';
  const statuses = festivalsOnDay.map(f => getFestivalDeadlineStatus(f));
  
  const activeStatuses = statuses.filter(s => s !== 'past' && s !== '');
  if (activeStatuses.includes('urgent')) return 'urgent';
  if (activeStatuses.includes('near')) return 'near';
  if (activeStatuses.includes('far')) return 'far';

  if (statuses.every(s => s === 'past' || s === '')) {
    if (statuses.includes('past')) return 'past';
  }
  
  return '';
};


export const CalendarView: React.FC = () => {
  const { festivals } = useFestivals();
  const todayJalali = jalaaliToday();
  const [currentMonth, setCurrentMonth] = useState<JalaliDate>({ jy: todayJalali.jy, jm: todayJalali.jm, jd: 1 });
  const [selectedDayFestivals, setSelectedDayFestivals] = useState<FestivalInfo[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [festivalForModal, setFestivalForModal] = useState<FestivalInfo | null>(null);

  const festivalsByDeadline = useMemo(() => {
    const map = new Map<string, FestivalInfo[]>();
    festivals.forEach(festival => {
      let deadlineJalaliStr: string | null = null;
      if (festival.submissionDeadlinePersian) {
        const parsed = parseJalaliDate(festival.submissionDeadlinePersian);
        if(parsed) deadlineJalaliStr = `${parsed.jy}/${String(parsed.jm).padStart(2, '0')}/${String(parsed.jd).padStart(2, '0')}`;

      } else if (festival.submissionDeadlineGregorian) {
        try {
            const [gy, gm, gd] = festival.submissionDeadlineGregorian.split('-').map(Number);
            const jalali = toJalaali(gy, gm, gd);
            deadlineJalaliStr = `${jalali.jy}/${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')}`;
        } catch (e) {
            // console.error("Error converting Gregorian to Jalali for calendar:", e);
        }
      }
      
      if (deadlineJalaliStr) {
        if (!map.has(deadlineJalaliStr)) {
          map.set(deadlineJalaliStr, []);
        }
        map.get(deadlineJalaliStr)?.push(festival);
      }
    });
    return map;
  }, [festivals]);

  const generateCalendarGrid = (year: number, month: number): DayCell[][] => {
    const monthLength = jalaaliMonthLength(year, month);
    const firstDayOfMonthGregorian = toGregorian(year, month, 1);
    const firstDayOfWeek = weekDay(firstDayOfMonthGregorian.gy, firstDayOfMonthGregorian.gm, firstDayOfMonthGregorian.gd); 
    
    const grid: DayCell[][] = [];
    let dayCells: DayCell[] = [];
    let currentDay = 1;

    for (let i = 0; i < firstDayOfWeek; i++) {
      dayCells.push({ day: 0, isCurrentMonth: false, isToday: false, dateStr: '', festivals: [], deadlineStatus: '' });
    }

    while (currentDay <= monthLength) {
      if (dayCells.length === 7) {
        grid.push(dayCells);
        dayCells = [];
      }
      const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(currentDay).padStart(2, '0')}`;
      const isToday = year === todayJalali.jy && month === todayJalali.jm && currentDay === todayJalali.jd;
      const festivalsOnThisDay = festivalsByDeadline.get(dateStr) || [];
      const overallStatus = getOverallDeadlineStatusForDay(festivalsOnThisDay);
      
      dayCells.push({
        day: currentDay,
        isCurrentMonth: true,
        isToday: isToday,
        dateStr: dateStr,
        festivals: festivalsOnThisDay,
        deadlineStatus: overallStatus
      });
      currentDay++;
    }

    while (dayCells.length < 7 && dayCells.length > 0) {
      dayCells.push({ day: 0, isCurrentMonth: false, isToday: false, dateStr: '', festivals: [], deadlineStatus: '' });
    }
    if (dayCells.length > 0) {
        grid.push(dayCells);
    }
    
    return grid;
  };
  
  const grid = generateCalendarGrid(currentMonth.jy, currentMonth.jm);

  const changeMonth = (delta: number) => {
    let newJy = currentMonth.jy;
    let newJm = currentMonth.jm + delta;
    if (newJm > 12) {
      newJm = 1;
      newJy++;
    } else if (newJm < 1) {
      newJm = 12;
      newJy--;
    }
    setCurrentMonth({ jy: newJy, jm: newJm, jd: 1 });
    setSelectedDayFestivals([]);
    setSelectedDateStr(null);
  };

  const handleDayClick = (dayCell: DayCell) => {
    if (!dayCell.isCurrentMonth) { // Allow selecting any day of the current month, even if no festivals
        setSelectedDayFestivals([]);
        setSelectedDateStr(null);
        if(dayCell.isCurrentMonth) {
            setSelectedDateStr(dayCell.dateStr);
        }
        return;
    }
    setSelectedDayFestivals(dayCell.festivals);
    setSelectedDateStr(dayCell.dateStr);
  };

  const openFestivalModal = (festival: FestivalInfo) => {
    setFestivalForModal(festival);
    setIsModalOpen(true);
  };

  const closeFestivalModal = () => {
    setIsModalOpen(false);
    setFestivalForModal(null);
  };

  const MAX_DOTS_DISPLAY = 3;

  return (
    <div className="bg-white p-6 rounded-xl shadow-xl w-full">
      <h2 className="text-2xl font-semibold text-teal-700 mb-6 text-center flex items-center justify-center">
        <CalendarDays className="me-3 text-teal-600" /> تقویم شمسی فراخوان‌ها
      </h2>
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-teal-100 text-teal-600 transition-colors" aria-label="ماه قبل">
          <ChevronRight size={28} />
        </button>
        <div className="text-xl font-semibold text-gray-700">
          {PERSIAN_MONTH_NAMES[currentMonth.jm - 1]} {currentMonth.jy}
        </div>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-teal-100 text-teal-600 transition-colors" aria-label="ماه بعد">
          <ChevronLeft size={28} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-md overflow-hidden">
        {PERSIAN_WEEK_DAYS_SHORT.map(dayName => (
          <div key={dayName} className="text-center py-2 font-medium text-sm bg-gray-100 text-gray-600">
            {dayName}
          </div>
        ))}
        {grid.flat().map((cell, index) => (
          <div
            key={`${cell.dateStr}-${index}`}
            className={`jalali-calendar-day relative p-1 sm:p-2 h-20 sm:h-28 flex flex-col items-center justify-start text-sm cursor-pointer transition-colors
              ${!cell.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-teal-50'}
              ${cell.isToday ? 'today' : ''}
              ${cell.isCurrentMonth && cell.deadlineStatus && selectedDateStr === cell.dateStr ? `deadline-${cell.deadlineStatus}` : ''}
              ${selectedDateStr === cell.dateStr && cell.isCurrentMonth ? 'ring-2 ring-teal-500 !bg-teal-100' : ''}
            `}
            onClick={() => handleDayClick(cell)}
            role="button"
            tabIndex={cell.isCurrentMonth ? 0 : -1}
            aria-label={cell.isCurrentMonth ? `روز ${cell.day}${cell.festivals.length > 0 ? ', ' + cell.festivals.length + ' مهلت' : ''}` : 'روز خارج از ماه جاری'}
          >
            {cell.isCurrentMonth && (
              <>
                <span className="font-medium mb-1">{cell.day}</span>
                {cell.festivals.length > 0 && (
                  <div className="dots-container">
                    {cell.festivals.slice(0, MAX_DOTS_DISPLAY).map((festival, dotIndex) => {
                      const dotStatus = getFestivalDeadlineStatus(festival);
                      return (
                        <span
                          key={`${festival.id}-${dotIndex}`}
                          className={`deadline-dot dot-${dotStatus}`}
                          title={festival.festivalName || 'فراخوان'}
                        ></span>
                      );
                    })}
                    {cell.festivals.length > MAX_DOTS_DISPLAY && (
                      <span className="dot-indicator-text">
                        +{cell.festivals.length - MAX_DOTS_DISPLAY}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {selectedDateStr && (
        <div className="mt-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
          <h4 className="font-semibold text-teal-700 mb-2">
            مهلت‌های ارسال در تاریخ {selectedDateStr}:
          </h4>
          {selectedDayFestivals.length > 0 ? (
            <ul className="list-disc ps-5 space-y-1">
              {selectedDayFestivals.map(f => (
                <li key={f.id} className="text-sm text-gray-800 flex justify-between items-center gap-2">
                  <button
                    onClick={() => openFestivalModal(f)}
                    className="text-teal-600 hover:text-teal-800 hover:underline focus:outline-none text-right truncate flex-1 min-w-0"
                    aria-label={`نمایش جزئیات ${f.festivalName || 'فراخوان'}`}
                    title={f.festivalName || "فراخوان بدون نام"}
                  >
                    {f.festivalName || "فراخوان بدون نام"}
                  </button>
                  {f.submissionDeadlineGregorian && selectedDateStr && f.submissionDeadlinePersian === selectedDateStr &&
                    <span className="text-xs text-gray-500 ms-2 text-left flex-shrink-0">({formatGregorianDate(f.submissionDeadlineGregorian)})</span>
                  }
                </li>
              ))}
            </ul>
          ) : (
             <p className="text-center text-gray-500">
                هیچ مهلتی برای تاریخ {selectedDateStr} ثبت نشده است.
             </p>
          )}
        </div>
      )}


      {isModalOpen && festivalForModal && (
        <FestivalModal
          isOpen={isModalOpen}
          onClose={closeFestivalModal}
          festivalData={festivalForModal}
          isEditing={true} 
        />
      )}
    </div>
  );
};