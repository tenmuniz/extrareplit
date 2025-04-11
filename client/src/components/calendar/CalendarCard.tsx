import { useState, useEffect } from "react";
import { DaySchedule } from "@/lib/types";
import { getWeekdayClass } from "@/lib/utils";
import OfficerSelect from "./OfficerSelect";

interface CalendarCardProps {
  day: number;
  month: number;
  year: number;
  weekday: string;
  officers: string[];
  savedSelections: (string | null)[];
  onOfficerChange: (day: number, position: number, officer: string | null) => void;
}

export default function CalendarCard({
  day,
  month,
  year,
  weekday,
  officers,
  savedSelections,
  onOfficerChange,
}: CalendarCardProps) {
  const [selections, setSelections] = useState<(string | null)[]>(
    savedSelections || [null, null, null]
  );

  useEffect(() => {
    if (savedSelections) {
      setSelections(savedSelections);
    }
  }, [savedSelections]);

  const handleOfficerChange = (position: number, officer: string | null) => {
    const newSelections = [...selections];
    newSelections[position] = officer;
    setSelections(newSelections);
    onOfficerChange(day, position, officer);
  };

  // Get the selected officers for this day to disable them in other dropdowns
  const selectedOfficers = selections.filter(Boolean) as string[];

  const weekdayClass = getWeekdayClass(weekday);

  // Verificar se há pelo menos um oficial escalado
  const hasAssignedOfficer = selectedOfficers.length > 0;
  
  // Classes do cabeçalho - muda para verde quando há pelo menos um oficial escalado
  const headerClasses = hasAssignedOfficer 
    ? "bg-green-100 px-4 py-2 border-b flex justify-between items-center" 
    : "bg-gray-50 px-4 py-2 border-b flex justify-between items-center";
  
  // Cor do texto para o dia
  const dayTextClass = hasAssignedOfficer ? "font-medium text-green-800" : "font-medium text-gray-800";

  return (
    <div className="day-card bg-white rounded-lg shadow-sm overflow-hidden" id={`dia-${day}`}>
      <div className={headerClasses}>
        <h3 className={dayTextClass}>Dia {day}</h3>
        <span className={`text-xs font-medium ${weekdayClass} px-2 py-1 rounded`}>
          {weekday}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {[0, 1, 2].map((position) => (
          <OfficerSelect
            key={`day-${day}-position-${position}`}
            position={position + 1}
            officers={officers}
            selectedOfficer={selections[position]}
            disabledOfficers={selectedOfficers.filter(
              (officer) => officer !== selections[position]
            )}
            onChange={(value) => handleOfficerChange(position, value)}
          />
        ))}
      </div>
    </div>
  );
}
