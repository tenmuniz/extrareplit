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
      // Salvar no servidor primeiro (persistência principal)
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
      
      // Backup no localStorage apenas como fallback
      saveLocalStorageSchedule(STORAGE_KEY, schedule);
      
      // Notificar sucesso
      toast({
        title: "Escala salva com sucesso!",
        description: "Suas alterações foram salvas no banco de dados e estarão disponíveis em todos os dispositivos",
        duration: 5000,
      });
      
      // Atualizar dados combinados
      const combinedResponse = await fetch(`/api/combined-schedules?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}`);
      if (combinedResponse.ok) {
        const combinedData = await combinedResponse.json();
        setCombinedSchedules(combinedData.schedules);
      }
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
      <header className="bg-gradient-to-br from-[#0a2f6b] via-[#143d8a] to-[#1e3a8a] py-8 mb-6 shadow-xl relative overflow-hidden rounded-3xl">
        {/* Elementos decorativos de fundo aprimorados */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          {/* Espaço reservado para elementos decorativos futuros */}
          
          {/* Cores institucionais mais vibrantes em círculos luminosos */}
          <div className="absolute -top-10 -left-10 w-80 h-80 bg-gradient-to-br from-blue-600 to-blue-400 opacity-10 rounded-full filter blur-3xl"></div>
          <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-gradient-to-br from-indigo-700 to-blue-500 opacity-10 rounded-full filter blur-3xl animate-pulse-slow"></div>
          
          {/* Silhueta de viatura com baixa opacidade */}
          <div className="absolute right-10 bottom-0 w-72 h-28 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMjAwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xNzAgMjVIMTYwTDE0MCA1MEgzMEwxMCA3MEg1QzUgNzAgNSA3NSAxMCA3NUgxOTBDMTk1IDc1IDE5NSA3MCAxOTUgNzBIMTgwTDE3MCAyNVoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjxwYXRoIGQ9Ik0zMCA1MEg3MEw4MCAzMEgxMzBMMTQwIDUwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utb3BhY2l0eT0iMC4xIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjcwIiByPSIxMCIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PGNpcmNsZSBjeD0iMTYwIiBjeT0iNzAiIHI9IjEwIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=')] 
            bg-no-repeat opacity-5 bg-contain bg-right-bottom"></div>
          
          {/* Elementos gráficos adicionais */}
          <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/15 to-transparent"></div>
          
          {/* Padrão geométrico sutil */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxwYXRoIGQ9Ik0yNSAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0yMCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zNSAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik00MCAzMGgyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAyNXYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAyMHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCAzNXYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KICAgIDxwYXRoIGQ9Ik0zMCA0MHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjAuNSIgLz4KPC9zdmc+')]
            opacity-20"></div>
          

        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-wrap justify-between items-center">
            {/* Conteúdo principal modernizado */}
            <div className="relative z-10 p-5 rounded-3xl max-w-2xl">
              <div className="flex items-start gap-6">

                
                {/* Conteúdo textual modernizado */}
                <div className="flex flex-col items-start max-w-md">
                  {/* Identificação institucional */}
                  <div className="flex flex-col mb-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-1 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full shadow-sm"></div>
                      <span className="text-xs tracking-wide text-white/80 font-medium">
                        20ª Companhia Independente de Polícia Militar – Muaná / Ponta de Pedras
                      </span>
                    </div>
                  </div>
                  
                  {/* Título principal com efeito de brilho reduzido em altura */}
                  <div className="relative">
                    <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-100 via-white to-blue-100
                        drop-shadow-[0_2px_2px_rgba(0,100,255,0.3)]">
                        POLÍCIA MAIS FORTE
                      </span>
                    </h1>
                    
                    {/* Reflexo sutil mais discreto */}
                    <div className="absolute -bottom-1 left-0 w-full h-3 bg-gradient-to-b from-blue-300/20 to-transparent blur-sm"></div>
                  </div>
                  
                  {/* Linha com subtítulo */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-white to-blue-100">
                      Extraordinário
                    </span>
                    <div className="h-px flex-grow bg-gradient-to-r from-blue-400/50 via-white/30 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Seletor de mês com estilo premium */}
            <div className="mt-4 md:mt-0">
              <MonthSelector
                currentDate={currentDate}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* SEÇÃO REDESENHADA: Dois cards principais de operações */}
      <div className="mb-10 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CARD 1: POLÍCIA MAIS FORTE - Estilo Sofisticado e Detalhista */}
          <div className="relative group">
            {/* Efeito de hover em grupo */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 opacity-30 blur-xl 
              group-hover:opacity-60 transition duration-500 group-hover:duration-200 animate-pulse-slow"></div>
              
            {/* Container principal com efeito de vidro premium */}
            <div className="relative h-full flex flex-col overflow-hidden rounded-2xl p-0.5
              bg-gradient-to-r from-blue-600 to-blue-400 shadow-xl">
              
              {/* Interior com glassmorphism */}
              <div className="h-full flex flex-col bg-gradient-to-br from-blue-900/95 via-blue-800/95 to-blue-900/95 
                backdrop-blur-md rounded-[13px] p-5 overflow-hidden">
                
                {/* Elementos decorativos de fundo */}
                <div className="absolute inset-0 rounded-[13px] overflow-hidden">
                  {/* Círculos decorativos */}
                  <div className="absolute top-0 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl"></div>
                  
                  {/* Efeito de grade de fundo */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-blue-800/95 to-blue-900/95 
                    opacity-90 mix-blend-overlay"></div>
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiPjxwYXRoIGQ9Ik0wIDIwaDQwTTIwIDBoMHY0MCIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
                  
                  {/* Brilho superior */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
                </div>
                
                {/* Ícone com efeito 3D e destaque */}
                <div className="relative z-10 mb-2 -mt-1 flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full 
                      shadow-[0_0_15px_rgba(59,130,246,0.5)] relative
                      bg-gradient-to-br from-blue-600 to-blue-900 p-0.5">
                      {/* Interior do círculo */}
                      <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-blue-700 to-blue-950"></div>
                      
                      {/* Ícone com efeito de reflexo */}
                      <svg className="w-6 h-6 text-white relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" 
                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      
                      {/* Efeito de brilho no círculo */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-blue-400/30 to-transparent opacity-0 
                        group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    
                    <div className="ml-4">
                      <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r 
                        from-blue-200 to-white leading-tight tracking-tight">Polícia Mais Forte</h3>
                      <p className="text-xs text-blue-200/80 font-medium">Operação PMF - GCJO</p>
                    </div>
                  </div>
                  
                  {/* Indicador numérico */}
                  <div className="flex flex-col items-end">
                    <div className="flex items-center justify-center min-w-[3rem] px-2 py-1 
                      rounded-full bg-blue-800/60 backdrop-blur-sm border border-blue-400/20 shadow-inner">
                      <span className="text-sm font-bold text-blue-200">3</span>
                    </div>
                    <span className="text-[10px] text-blue-300/70 mt-1">policiais/dia</span>
                  </div>
                </div>
                
                {/* Linha divisória estilizada */}
                <div className="relative z-10 w-full h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent my-3"></div>
                
                {/* Conteúdo principal */}
                <div className="relative z-10 flex-grow flex flex-col">
                  {/* Descrição da operação */}
                  <p className="text-sm text-blue-100/90 mb-6 leading-relaxed">
                    Operações ostensivas de policiamento ordinário reforçado, patrulhamento 
                    motorizado e saturação em pontos estratégicos com foco na prevenção criminal.
                  </p>
                  
                  {/* Estatísticas em mini-cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-blue-800/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-blue-700/20">
                      <div className="text-xl font-bold text-blue-100">{Object.keys(combinedSchedules?.pmf || {}).length}</div>
                      <div className="text-xs text-blue-300/80">Dias programados</div>
                    </div>
                    <div className="bg-blue-800/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-blue-700/20">
                      <div className="text-xl font-bold text-blue-100">90</div>
                      <div className="text-xs text-blue-300/80">Vagas totais</div>
                    </div>
                  </div>
                  
                  {/* Botão com efeito de destaque */}
                  <a href="/" 
                    className="relative group/button mt-auto text-center py-2.5 rounded-xl font-medium text-sm text-white
                      overflow-hidden transition-all duration-300 
                      bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                      border border-blue-400/20 hover:border-blue-400/40
                      shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30">
                    
                    {/* Efeito de brilho no hover */}
                    <div className="absolute inset-0 -translate-y-full group-hover/button:translate-y-0 
                      bg-gradient-to-b from-white/20 to-transparent transition-transform duration-300"></div>
                    
                    <span className="relative z-10 inline-flex items-center">
                      <span>Acessar Operação</span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                      </svg>
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* CARD 2: ESCOLA SEGURA - Estilo Elegante e Detalhista */}
          <div className="relative group">
            {/* Efeito de hover em grupo */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-30 blur-xl 
              group-hover:opacity-60 transition duration-500 group-hover:duration-200 animate-pulse-slow"></div>
              
            {/* Container principal com efeito de vidro premium */}
            <div className="relative h-full flex flex-col overflow-hidden rounded-2xl p-0.5
              bg-gradient-to-r from-purple-600 to-purple-400 shadow-xl">
              
              {/* Interior com glassmorphism */}
              <div className="h-full flex flex-col bg-gradient-to-br from-purple-900/95 via-purple-800/95 to-purple-900/95 
                backdrop-blur-md rounded-[13px] p-5 overflow-hidden">
                
                {/* Elementos decorativos de fundo */}
                <div className="absolute inset-0 rounded-[13px] overflow-hidden">
                  {/* Círculos decorativos */}
                  <div className="absolute top-0 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-purple-400/10 rounded-full blur-2xl"></div>
                  
                  {/* Efeito de grade de fundo */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/95 via-purple-800/95 to-purple-900/95 
                    opacity-90 mix-blend-overlay"></div>
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiPjxwYXRoIGQ9Ik0wIDIwaDQwTTIwIDBoMHY0MCIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
                  
                  {/* Brilho superior */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"></div>
                </div>
                
                {/* Ícone com efeito 3D e destaque */}
                <div className="relative z-10 mb-2 -mt-1 flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full 
                      shadow-[0_0_15px_rgba(147,51,234,0.5)] relative
                      bg-gradient-to-br from-purple-600 to-purple-900 p-0.5">
                      {/* Interior do círculo */}
                      <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-purple-700 to-purple-950"></div>
                      
                      {/* Ícone com efeito de reflexo */}
                      <svg className="w-6 h-6 text-white relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" 
                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      
                      {/* Efeito de brilho no círculo */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-purple-400/30 to-transparent opacity-0 
                        group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    
                    <div className="ml-4">
                      <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r 
                        from-purple-200 to-white leading-tight tracking-tight">Escola Segura</h3>
                      <p className="text-xs text-purple-200/80 font-medium">Proteção ao ambiente escolar</p>
                    </div>
                  </div>
                  
                  {/* Indicador numérico */}
                  <div className="flex flex-col items-end">
                    <div className="flex items-center justify-center min-w-[3rem] px-2 py-1 
                      rounded-full bg-purple-800/60 backdrop-blur-sm border border-purple-400/20 shadow-inner">
                      <span className="text-sm font-bold text-purple-200">2</span>
                    </div>
                    <span className="text-[10px] text-purple-300/70 mt-1">policiais/dia</span>
                  </div>
                </div>
                
                {/* Linha divisória estilizada */}
                <div className="relative z-10 w-full h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent my-3"></div>
                
                {/* Conteúdo principal */}
                <div className="relative z-10 flex-grow flex flex-col">
                  {/* Descrição da operação */}
                  <p className="text-sm text-purple-100/90 mb-6 leading-relaxed">
                    Operações preventivas focadas no patrulhamento escolar, proteção de estudantes e prevenção 
                    à violência no ambiente educacional com interação comunitária.
                  </p>
                  
                  {/* Estatísticas em mini-cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-purple-800/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-purple-700/20">
                      <div className="text-xl font-bold text-purple-100">{Object.keys(combinedSchedules?.escolaSegura || {}).length}</div>
                      <div className="text-xs text-purple-300/80">Dias programados</div>
                    </div>
                    <div className="bg-purple-800/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-purple-700/20">
                      <div className="text-xl font-bold text-purple-100">44</div>
                      <div className="text-xs text-purple-300/80">Vagas totais</div>
                    </div>
                  </div>
                  
                  {/* Botão com efeito de destaque */}
                  <a href="/escola-segura" 
                    className="relative group/button mt-auto text-center py-2.5 rounded-xl font-medium text-sm text-white
                      overflow-hidden transition-all duration-300 
                      bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400
                      border border-purple-400/20 hover:border-purple-400/40
                      shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30">
                    
                    {/* Efeito de brilho no hover */}
                    <div className="absolute inset-0 -translate-y-full group-hover/button:translate-y-0 
                      bg-gradient-to-b from-white/20 to-transparent transition-transform duration-300"></div>
                    
                    <span className="relative z-10 inline-flex items-center">
                      <span>Acessar Operação</span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                      </svg>
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
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
