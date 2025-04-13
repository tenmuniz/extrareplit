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
      {/* Header com título e seletor de mês - versão premium e luxuosa */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 py-10 mb-6 shadow-2xl relative overflow-hidden rounded-3xl">
        {/* Elementos decorativos de fundo aprimorados */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500 opacity-15 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -right-20 w-[30rem] h-[30rem] bg-indigo-600 opacity-15 rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-cyan-500 opacity-10 rounded-full filter blur-3xl"></div>
          
          {/* Elementos gráficos adicionais */}
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-full h-24 bg-gradient-to-l from-blue-900/40 via-transparent to-transparent"></div>
          
          {/* Padrão geométrico sutil */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxwYXRoIGQ9Ik0yNSAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0yMCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zNSAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik00MCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAyNXYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAyMHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAzNXYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCA0MHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KPC9zdmc+')]
            opacity-30"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-wrap justify-between items-center">
            {/* Título e subtítulo com design premium */}
            <div className="relative z-10 bg-gradient-to-br from-white/20 to-white/5 p-8 rounded-3xl backdrop-blur-md shadow-[0_20px_50px_rgba(8,47,112,0.5)] border border-white/30 max-w-2xl transform hover:scale-[1.02] transition-all duration-300 overflow-hidden">
              {/* Efeito de luz no canto superior */}
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl"></div>
              
              {/* Emblema superior */}
              <div className="flex items-center mb-3 relative">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 rounded-2xl flex items-center 
                  border border-blue-400/40 shadow-lg shadow-blue-900/30">
                  <div className="w-2.5 h-2.5 bg-blue-300 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-xs font-bold tracking-wider text-white uppercase">Sistema de Gestão - 20ªCIPM</span>
                </div>
              </div>
              
              {/* Divisor decorativo */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent mb-5"></div>
              
              {/* Conteúdo principal */}
              <div className="flex flex-col items-start relative">
                {/* Título principal com efeito de brilho */}
                <div className="relative">
                  <h1 className="text-5xl font-black text-white leading-tight mb-2 tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-white to-blue-200
                      drop-shadow-[0_3px_3px_rgba(0,100,255,0.4)]">
                      POLÍCIA MAIS FORTE
                    </span>
                  </h1>
                  
                  {/* Reflexo sutil aprimorado */}
                  <div className="absolute -bottom-2 left-0 w-full h-6 bg-gradient-to-b from-blue-300/30 to-transparent blur-md"></div>
                </div>
                
                {/* Subtítulo com separador elegante */}
                <div className="flex items-center mt-2">
                  <div className="h-9 w-2 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-full mr-3 shadow-lg shadow-yellow-600/30"></div>
                  <span className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-white to-blue-100">
                    Extraordinário
                  </span>
                </div>
              </div>
              
              {/* Decorações de canto */}
              <div className="absolute -bottom-5 -right-5 w-32 h-32 bg-gradient-to-br from-blue-500/30 to-indigo-600/30 rounded-full blur-2xl"></div>
              <div className="absolute bottom-2 right-2 w-16 h-16 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full blur-lg"></div>
            </div>
            
            {/* Seletor de mês com estilo premium */}
            <div className="mt-4 md:mt-0 transform translate-y-4 md:translate-y-0">
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
              
              {/* Remoção do botão de verificar conforme solicitado */}
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
