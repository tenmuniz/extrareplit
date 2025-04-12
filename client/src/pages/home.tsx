import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { getMonthData, getWeekdayName, getLocalStorageSchedule, saveLocalStorageSchedule } from "@/lib/utils";
import { MonthSchedule, OfficersResponse, CombinedSchedules } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import CalendarCard from "@/components/calendar/CalendarCard";
import MonthSelector from "@/components/calendar/MonthSelector";
import ResumoEscala from "@/components/calendar/ResumoEscala";
import ResumoGuarnicao from "@/components/calendar/ResumoGuarnicao";
import VerificadorInconsistencias from "@/components/calendar/VerificadorInconsistencias";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

// API endpoint for officers
const OFFICERS_ENDPOINT = "/api/officers";
const STORAGE_KEY = "pmfSchedule";

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<MonthSchedule>({});
  // Simplificamos para usar apenas PMF
  const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedules>({
    pmf: {},
    escolaSegura: {} // Mantemos por compatibilidade, mas não será usado
  });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  
  // Buscar oficiais da API
  const { data: officersData, isLoading } = useQuery<OfficersResponse>({
    queryKey: [OFFICERS_ENDPOINT],
    enabled: true,
  });
  
  const officers = officersData?.officers || [];
  
  // Get current month data
  const monthData = getMonthData(currentDate.getFullYear(), currentDate.getMonth());
  
  // Buscar agenda combinada do servidor
  useEffect(() => {
    const fetchCombinedSchedules = async () => {
      try {
        setIsLoadingSchedules(true);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Buscar agenda específica da PMF
        const pmfResponse = await fetch(`/api/schedule?operation=pmf&year=${year}&month=${month}`);
        if (!pmfResponse.ok) throw new Error("Erro ao buscar agenda da PMF");
        
        const pmfData = await pmfResponse.json();
        if (Object.keys(pmfData.schedule).length > 0) {
          setSchedule({ [`${year}-${month}`]: pmfData.schedule });
        } else {
          // Se não há dados no servidor, usar dados locais
          const savedSchedule = getLocalStorageSchedule(STORAGE_KEY);
          const currentMonthKey = `${year}-${month}`;
          
          if (savedSchedule[currentMonthKey]) {
            setSchedule(savedSchedule);
          } else {
            setSchedule({});
          }
        }
        
        // Buscar agenda combinada (PMF + Escola Segura)
        const combinedResponse = await fetch(`/api/combined-schedules?year=${year}&month=${month}`);
        if (!combinedResponse.ok) throw new Error("Erro ao buscar agendas combinadas");
        
        const combinedData = await combinedResponse.json();
        setCombinedSchedules(combinedData.schedules);
        
        setIsLoadingSchedules(false);
      } catch (error) {
        console.error("Erro ao carregar agendas:", error);
        setIsLoadingSchedules(false);
        // Em caso de erro, tentar usar dados locais
        const savedSchedule = getLocalStorageSchedule(STORAGE_KEY);
        const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        
        if (savedSchedule[currentMonthKey]) {
          setSchedule(savedSchedule);
        } else {
          setSchedule({});
        }
      }
    };
    
    fetchCombinedSchedules();
  }, [currentDate]);
  
  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };
  
  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };
  
  // BLOQUEIO TOTAL: esta função é o último ponto de controle antes de adicionar um militar à escala
  const handleOfficerChange = (day: number, position: number, officer: string | null) => {
    const dayKey = `${day}`;
    const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    
    // Se estiver removendo um militar (officer = null), sempre permitimos
    if (officer === null) {
      setSchedule((prev) => {
        const newSchedule = { ...prev };
        
        if (!newSchedule[currentMonthKey]) {
          newSchedule[currentMonthKey] = {};
        }
        
        if (!newSchedule[currentMonthKey][dayKey]) {
          newSchedule[currentMonthKey][dayKey] = [null, null, null];
        }
        
        newSchedule[currentMonthKey][dayKey][position] = null;
        
        return newSchedule;
      });
      return;
    }
    
    // VERIFICAÇÃO CRÍTICA DE LIMITE: Este é o último ponto de verificação
    // Vamos calcular o total de escalas do militar no mês inteiro
    
    // 1. Calcular total atual do militar em todos os dias
    const pmfSchedule = combinedSchedules?.pmf?.[currentMonthKey] || {};
    let totalEscalas = 0;
    
    // Contar em todos os dias do mês
    Object.values(pmfSchedule).forEach((dayOfficers: any) => {
      if (Array.isArray(dayOfficers)) {
        // Adiciona +1 para cada aparição do militar
        dayOfficers.forEach(off => {
          if (off === officer) {
            totalEscalas++;
          }
        });
      }
    });
    
    // Verificar também na agenda local que ainda não foi salva no servidor
    // Exceto o próprio dia atual que estamos modificando
    const localSchedule = schedule[currentMonthKey] || {};
    Object.entries(localSchedule).forEach(([checkDay, dayOfficers]) => {
      // Ignorar o dia atual que estamos modificando para evitar contagem dupla
      if (checkDay !== dayKey && Array.isArray(dayOfficers)) {
        dayOfficers.forEach(off => {
          if (off === officer) {
            totalEscalas++;
          }
        });
      }
    });
    
    // BLOQUEIO CRÍTICO: Impedir completamente a adição se já atingiu o limite
    if (totalEscalas >= 12) {
      // PROIBIDO: Já atingiu o limite máximo!
      console.error(`🚫 BLOQUEIO TOTAL: ${officer} já atingiu o limite de 12 serviços (${totalEscalas} serviços)`);
      toast({
        variant: "destructive",
        title: "⛔ LIMITE DE 12 SERVIÇOS ATINGIDO",
        description: `${officer} já possui ${totalEscalas} serviços no mês e está BLOQUEADO para novas escalas!`
      });
      return; // Interrompe aqui - não permite de forma alguma
    }
    
    // Se passou pela verificação, podemos adicionar o militar
    setSchedule((prev) => {
      const newSchedule = { ...prev };
      
      if (!newSchedule[currentMonthKey]) {
        newSchedule[currentMonthKey] = {};
      }
      
      if (!newSchedule[currentMonthKey][dayKey]) {
        newSchedule[currentMonthKey][dayKey] = [null, null, null];
      }
      
      newSchedule[currentMonthKey][dayKey][position] = officer;
      
      return newSchedule;
    });
  };
  
  const saveSchedule = async () => {
    try {
      // Save to localStorage
      saveLocalStorageSchedule(STORAGE_KEY, schedule);
      
      // Salvar no servidor
      const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
      const monthSchedule = schedule[monthKey] || {};
      
      await apiRequest(
        'POST',
        '/api/schedule',
        {
          operation: 'pmf', // Operação PMF
          year: currentDate.getFullYear(),
          month: currentDate.getMonth(),
          data: monthSchedule
        }
      );
      
      toast({
        title: "Escala salva com sucesso!",
        description: "Suas alterações foram salvas",
      });
    } catch (error) {
      console.error("Erro ao salvar escala:", error);
      toast({
        title: "Erro ao salvar a escala",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };
  

  
  const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

  return (
    <div className="min-h-screen font-sans">
      {/* Header com título e seletor de mês - simplificado */}
      <header className="bg-white shadow-lg border-b border-blue-100 py-6 mb-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-blue-900">
                EXTRAORDINÁRIO <span className="text-yellow-500">•</span> <span className="text-2xl font-semibold text-blue-700">Escala PMF</span>
              </h1>
              <p className="text-blue-600 text-sm mt-1">Gerencie as escalas PMF e controle o limite de GCJO por militar</p>
            </div>
            
            {/* Seletor de mês */}
            <div>
              <MonthSelector
                currentDate={currentDate}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto px-4 mb-8">
        {/* Barra de botões e ações */}
        <div className="bg-white p-4 mb-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Botão de salvar escala */}
            <button
              onClick={saveSchedule}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                text-white px-5 py-2.5 rounded-xl flex items-center 
                transition-all duration-200 shadow-md hover:shadow-lg
                active:shadow-inner active:translate-y-0.5 transform"
            >
              <Save className="h-4 w-4 mr-2 drop-shadow-sm" />
              <span className="font-medium">Salvar</span>
            </button>
            
            {/* Botões de ações e análises */}
            <div className="flex gap-2 ml-1">
              <div>
                <ResumoEscala
                  schedule={schedule}
                  currentDate={currentDate}
                  combinedSchedules={combinedSchedules}
                />
              </div>
              
              <div>
                <ResumoGuarnicao 
                  schedule={schedule}
                  currentDate={currentDate}
                  combinedSchedules={combinedSchedules}
                  operationType="pmf"
                />
              </div>
              
              {/* Componente de verificação removido */}
            </div>
          </div>
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoadingSchedules || isLoading ? (
            <div className="col-span-full py-20 text-center text-gray-500">
              Carregando calendário...
            </div>
          ) : (
            Array.from({ length: monthData.days }, (_, i) => i + 1).map((day) => {
              const weekday = getWeekdayName(
                day,
                currentDate.getMonth(),
                currentDate.getFullYear()
              );
              
              // Get saved selections for this day
              const dayKey = `${day}`;
              const savedSelections = schedule[currentMonthKey]?.[dayKey] || [null, null, null];
              
              return (
                <CalendarCard
                  key={`day-${day}`}
                  day={day}
                  month={currentDate.getMonth()}
                  year={currentDate.getFullYear()}
                  weekday={weekday}
                  officers={officers}
                  savedSelections={savedSelections}
                  onOfficerChange={handleOfficerChange}
                  schedule={schedule}
                  combinedSchedules={combinedSchedules}
                />
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
