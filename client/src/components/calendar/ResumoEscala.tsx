import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Calendar, FileText } from "lucide-react";
import { MonthSchedule } from "@/lib/types";
import { formatMonthYear } from "@/lib/utils";

interface ResumoEscalaProps {
  schedule: MonthSchedule;
  currentDate: Date;
}

export default function ResumoEscala({ schedule, currentDate }: ResumoEscalaProps) {
  const [open, setOpen] = useState(false);
  const [resumoData, setResumoData] = useState<Record<string, { dias: number[], total: number }>>({});
  
  // Compute summary whenever the schedule changes or the modal is opened
  useEffect(() => {
    if (open) {
      generateResumo();
    }
  }, [open, schedule, currentDate]);
  
  // Generate summary data from the schedule
  const generateResumo = () => {
    const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const monthSchedule = schedule[currentMonthKey] || {};
    
    const militaresDias: Record<string, { dias: number[], total: number }> = {};
    
    // Percorrer cada dia do mês
    Object.entries(monthSchedule).forEach(([day, officers]) => {
      // Processar cada militar escalado no dia
      officers.forEach(officer => {
        if (officer) {
          if (!militaresDias[officer]) {
            militaresDias[officer] = { dias: [], total: 0 };
          }
          
          const dayNum = parseInt(day, 10);
          if (!militaresDias[officer].dias.includes(dayNum)) {
            militaresDias[officer].dias.push(dayNum);
            militaresDias[officer].total += 1;
          }
        }
      });
    });
    
    // Ordenar por total de dias (decrescente)
    const ordenado = Object.fromEntries(
      Object.entries(militaresDias).sort((a, b) => b[1].total - a[1].total)
    );
    
    setResumoData(ordenado);
  };
  
  // Get the month name for display
  const mesAno = formatMonthYear(currentDate);
  
  // Calculate totals
  const totalEscalas = Object.values(resumoData).reduce((sum, militar) => sum + militar.total, 0);
  const totalMilitares = Object.keys(resumoData).length;
  
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center shadow-sm transition"
      >
        <BarChart3 className="h-5 w-5 mr-1" />
        Resumo
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[700px] bg-gradient-to-br from-blue-900 to-blue-800 text-white border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl font-bold text-center text-white mb-4">
              <FileText className="h-6 w-6 mr-2 text-yellow-300" />
              <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 text-transparent bg-clip-text">
                RESUMO DE ESCALA - {mesAno.toUpperCase()}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {/* Estatísticas gerais */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-700 p-4 rounded-lg shadow-inner flex flex-col items-center">
              <span className="text-blue-200 font-medium">Total de Escalas</span>
              <span className="text-3xl font-bold text-white">{totalEscalas}</span>
            </div>
            <div className="bg-blue-700 p-4 rounded-lg shadow-inner flex flex-col items-center">
              <span className="text-blue-200 font-medium">Militares Escalados</span>
              <span className="text-3xl font-bold text-white">{totalMilitares}</span>
            </div>
          </div>
          
          {/* Lista de militares */}
          <div className="bg-blue-700/50 rounded-lg p-2 mb-4 max-h-[350px] overflow-auto">
            <div className="flex font-bold text-sm text-blue-100 px-2 py-1 mb-1 border-b border-blue-500">
              <div className="w-[50%]">Policial</div>
              <div className="w-[35%]">Dias Escalados</div>
              <div className="w-[15%] text-center">Total</div>
            </div>
            
            {Object.keys(resumoData).length === 0 ? (
              <div className="p-4 text-center text-blue-200">
                Nenhum militar escalado para este mês
              </div>
            ) : (
              Object.entries(resumoData).map(([militar, dados], index) => (
                <div 
                  key={militar} 
                  className={`flex items-center text-sm px-2 py-3 rounded mb-1 ${
                    index % 2 === 0 ? 'bg-blue-800/40' : 'bg-blue-800/20'
                  }`}
                >
                  <div className="w-[50%] font-medium text-white">{militar}</div>
                  <div className="w-[35%] flex flex-wrap">
                    {dados.dias.sort((a, b) => a - b).map(dia => (
                      <span 
                        key={`${militar}-dia-${dia}`} 
                        className="inline-flex items-center justify-center h-6 w-6 mr-1 mb-1 bg-blue-600 rounded-full text-xs"
                      >
                        {dia}
                      </span>
                    ))}
                  </div>
                  <div className="w-[15%] text-center">
                    <span className="inline-block bg-green-600 text-white rounded-full px-3 py-1 font-bold">
                      {dados.total}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="text-center mt-2 text-blue-200 text-xs">
            <Calendar className="inline-block h-4 w-4 mr-1 mb-1" />
            Dados referentes ao mês de {mesAno}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}