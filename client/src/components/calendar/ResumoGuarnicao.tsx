import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Calendar, FileText, ChevronRight, X, User, Printer, Download } from "lucide-react";
import { MonthSchedule, CombinedSchedules } from "@/lib/types";
import { formatMonthYear, getWeekdayName } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Estendendo a interface para incluir os militares por dia na guarnição
interface GuarnicaoData {
  dias: number[];
  total: number;
  militaresPorDia?: Record<number, string[]>;
}

interface ResumoGuarnicaoProps {
  schedule: MonthSchedule;
  currentDate: Date;
  combinedSchedules?: CombinedSchedules;
  operationType?: 'pmf' | 'escolaSegura'; // Tipo de operação: PMF (padrão) ou Escola Segura
}

export default function ResumoGuarnicao({
  schedule,
  currentDate,
  combinedSchedules,
  operationType = 'pmf'
}: ResumoGuarnicaoProps) {
  const [open, setOpen] = useState(false);
  const [guarnicoesData, setGuarnicoesData] = useState<Record<string, GuarnicaoData>>({});
  const [guarnicaoSelecionada, setGuarnicaoSelecionada] = useState<string | null>(null);
  const [detalheGuarnicaoAberto, setDetalheGuarnicaoAberto] = useState(false);
  
  // Atualizar os dados sempre que o modal for aberto ou os dados mudarem
  useEffect(() => {
    if (open) {
      console.log("Resumo de guarnições - dados recebidos:", schedule);
      generateResumoGuarnicoes();
    }
  }, [open, schedule, currentDate]);
  
  // Função para identificar a guarnição de um militar
  const getGuarnicaoMilitar = (nome: string): string => {
    if (nome.includes("QOPM") || nome.includes("MONTEIRO") || 
        nome.includes("VANILSON") || nome.includes("ANDRÉ") || 
        nome.includes("CUNHA") || nome.includes("CARAVELAS") || 
        nome.includes("TONI") || nome.includes("CORREA") || 
        nome.includes("RODRIGUES") || nome.includes("TAVARES")) {
      return "EXPEDIENTE";
    } else if (nome.includes("PEIXOTO") || nome.includes("RODRIGO") || 
               nome.includes("LEDO") || nome.includes("NUNES") || 
               nome.includes("AMARAL") || nome.includes("CARLA") || 
               nome.includes("FELIPE") || nome.includes("BARROS") || 
               nome.includes("A. SILVA") || nome.includes("LUAN") || 
               nome.includes("NAVARRO")) {
      return "ALFA";
    } else if (nome.includes("OLIMAR") || nome.includes("FÁBIO") || 
               nome.includes("ANA CLEIDE") || nome.includes("GLEIDSON") || 
               nome.includes("CARLOS EDUARDO") || nome.includes("NEGRÃO") || 
               nome.includes("BRASIL") || nome.includes("MARVÃO") || 
               nome.includes("IDELVAN")) {
      return "BRAVO";
    } else if (nome.includes("PINHEIRO") || nome.includes("RAFAEL") || 
               nome.includes("MIQUEIAS") || nome.includes("M. PAIXÃO") || 
               nome.includes("CHAGAS") || nome.includes("CARVALHO") || 
               nome.includes("GOVEIA") || nome.includes("ALMEIDA") || 
               nome.includes("PATRIK") || nome.includes("GUIMARÃES")) {
      return "CHARLIE";
    }
    return "OUTROS";
  };

  // Função para exportar PDF da guarnição
  const exportarPDFGuarnicao = (guarnicao: string) => {
    if (!guarnicoesData[guarnicao] || !guarnicoesData[guarnicao].militaresPorDia) {
      return;
    }

    // Criar nova instância de PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Título do documento
    const tipoOperacao = operationType === 'escolaSegura' ? 'Escola Segura' : 'Polícia Mais Forte';
    const titulo = `EXTRAS ${tipoOperacao.toUpperCase()} - GUARNIÇÃO ${guarnicao}`;
    
    // Adicionar título
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(titulo, 105, 15, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Mês de referência: ${mesAno}`, 105, 22, { align: 'center' });
    
    // Informações gerais
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total de extras: ${guarnicoesData[guarnicao].total}`, 20, 30);
    pdf.text(`Dias com extras: ${guarnicoesData[guarnicao].dias.length}`, 20, 36);
    
    // Organizar dados por militares para incluir as datas
    const militaresPorDia = guarnicoesData[guarnicao].militaresPorDia!;
    const militaresInfo: Record<string, { nome: string, dias: number[] }> = {};
    
    // Para cada dia, processar os militares
    Object.entries(militaresPorDia).forEach(([dia, militares]) => {
      const diaNum = parseInt(dia, 10);
      
      militares.forEach(militar => {
        if (!militaresInfo[militar]) {
          militaresInfo[militar] = { nome: militar, dias: [] };
        }
        if (!militaresInfo[militar].dias.includes(diaNum)) {
          militaresInfo[militar].dias.push(diaNum);
        }
      });
    });
    
    // Converter para array e ordenar por nome
    const militaresArray = Object.values(militaresInfo).sort((a, b) => 
      a.nome.localeCompare(b.nome)
    );
    
    // Cabeçalho para lista de militares com suas datas
    pdf.setFont('helvetica', 'bold');
    pdf.text('Militares e suas datas de extras', 20, 46);
    
    // Criar tabela com os dados organizados por militar
    const tableMilitaresData = militaresArray.map(info => {
      return [
        info.nome,
        info.dias.length,
        info.dias.sort((a, b) => a - b).join(', ')
      ];
    });
    
    // Definir cabeçalhos e estilos da tabela de militares
    autoTable(pdf, {
      startY: 50,
      head: [['Militar', 'Total', 'Dias de Extras']],
      body: tableMilitaresData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      }
    });
    
    // Adicionar segunda tabela com visão por dia
    const finalY = (pdf as any).lastAutoTable.finalY + 10;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Distribuição por dia', 20, finalY);
    
    // Criar tabela com os dados dos dias
    const tableDiasData = Object.entries(guarnicoesData[guarnicao].militaresPorDia!)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([dia, militares]) => {
        return [
          dia,
          getWeekdayName(parseInt(dia), currentDate.getMonth() + 1, currentDate.getFullYear()),
          militares.join(', ')
        ];
      });
    
    // Definir cabeçalhos e estilos da tabela de dias
    autoTable(pdf, {
      startY: finalY + 4,
      head: [['Dia', 'Dia da Semana', 'Militares']],
      body: tableDiasData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      }
    });
    
    // Adicionar rodapé
    const totalPages = pdf.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      
      // Rodapé com número de página
      pdf.text(
        `Página ${i} de ${totalPages} - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 
        105, 
        pdf.internal.pageSize.height - 10, 
        { align: 'center' }
      );
    }
    
    // Salvar o PDF
    pdf.save(`Extras_${tipoOperacao.replace(/\s+/g, '_')}_Guarnicao_${guarnicao}_${mesAno.replace(/\s+/g, '_')}.pdf`);
  };

  const generateResumoGuarnicoes = () => {
    // Obter dados do mês atual
    const monthSchedule = schedule || {};
    
    // Objeto para armazenar contagem por guarnição
    const guarnicoes: Record<string, GuarnicaoData> = {
      "EXPEDIENTE": { dias: [], total: 0, militaresPorDia: {} },
      "ALFA": { dias: [], total: 0, militaresPorDia: {} },
      "BRAVO": { dias: [], total: 0, militaresPorDia: {} },
      "CHARLIE": { dias: [], total: 0, militaresPorDia: {} },
      "OUTROS": { dias: [], total: 0, militaresPorDia: {} }
    };
    
    // Verificar quais chaves estão disponíveis em monthSchedule
    console.log("GUARNIÇÃO - CHAVES DISPONÍVEIS:", Object.keys(monthSchedule));
    
    // Para compatibilidade com dados existentes, vamos verificar todas as possibilidades
    let monthlyData = {};
    
    // Tentativa 1: Usar o mês atual
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // JavaScript meses são 0-11
    const monthKey = `${year}-${month}`;
    
    // Tentativa 2: Verificar a chave 2025-3 que aparece nos logs
    const legacyKey = "2025-3";
    
    // Checamos qual chave existe e usamos a primeira disponível
    if (monthSchedule[monthKey] && Object.keys(monthSchedule[monthKey]).length > 0) {
      console.log("GUARNIÇÃO - USANDO CHAVE ATUAL:", monthKey);
      monthlyData = monthSchedule[monthKey];
    } else if (monthSchedule[legacyKey] && Object.keys(monthSchedule[legacyKey]).length > 0) {
      console.log("GUARNIÇÃO - USANDO CHAVE LEGADA:", legacyKey);
      monthlyData = monthSchedule[legacyKey];
    } else {
      // Tentativa final: verificar todas as chaves e usar a primeira que tiver dados
      for (const key of Object.keys(monthSchedule)) {
        if (Object.keys(monthSchedule[key]).length > 0 && key !== "2025") {
          console.log("GUARNIÇÃO - USANDO CHAVE ALTERNATIVA:", key);
          monthlyData = monthSchedule[key];
          break;
        }
      }
    }
    
    console.log("RESUMO GUARNIÇÃO: Processando dados do mês", monthKey);
    console.log("DADOS DISPONÍVEIS:", monthlyData);
    
    // Analisar cada dia e militar para identificar guarnição
    Object.entries(monthlyData).forEach(([day, oficiais]) => {
      const dayNum = parseInt(day, 10);
      
      if (Array.isArray(oficiais)) {
        oficiais.forEach(militar => {
          if (militar) {
            const guarnicao = getGuarnicaoMilitar(militar);
            
            // Adicionar dia à lista de dias da guarnição
            if (!guarnicoes[guarnicao].dias.includes(dayNum)) {
              guarnicoes[guarnicao].dias.push(dayNum);
            }
            
            // Incrementar contagem total
            guarnicoes[guarnicao].total++;
            
            // Adicionar militar ao registro de militares por dia
            if (!guarnicoes[guarnicao].militaresPorDia![dayNum]) {
              guarnicoes[guarnicao].militaresPorDia![dayNum] = [];
            }
            
            guarnicoes[guarnicao].militaresPorDia![dayNum].push(militar);
          }
        });
      }
    });
    
    // Debug detalhado
    console.log("CONTAGEM POR GUARNIÇÃO:", 
      Object.entries(guarnicoes)
        .filter(([_, dados]) => dados.total > 0)
        .map(([guarnicao, dados]) => `${guarnicao}: ${dados.total} serviços em ${dados.dias.length} dias`)
    );
    
    // Remover guarnição OUTROS se não tiver nenhum registro
    if (guarnicoes["OUTROS"].total === 0) {
      delete guarnicoes["OUTROS"];
    }
    
    setGuarnicoesData(guarnicoes);
  };

  // Obter o nome do mês para exibição
  const mesAno = formatMonthYear(currentDate);
  
  // Calcular o total de extras
  const totalEscalas = Object.values(guarnicoesData).reduce((sum, guarnicao) => sum + guarnicao.total, 0);
  
  // Encontrar guarnição mais escalada
  let guarnicaoMaisEscalada = "";
  let maxEscalas = 0;
  
  Object.entries(guarnicoesData).forEach(([nome, dados]) => {
    if (dados.total > maxEscalas) {
      guarnicaoMaisEscalada = nome;
      maxEscalas = dados.total;
    }
  });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className={`bg-gradient-to-r 
          ${operationType === 'escolaSegura' 
            ? 'from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800' 
            : 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700'
          }
          text-white px-4 py-2.5 rounded-xl flex items-center 
          transition-all duration-200 shadow-md hover:shadow-lg
          active:shadow-inner active:translate-y-0.5 transform ml-2`}
      >
        <Users className="h-4 w-4 mr-2 drop-shadow-sm" />
        <span className="font-medium">Guarnição</span>
      </Button>
      
      {/* Modal principal de guarnições */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`sm:max-w-[80%] w-fit max-h-[90vh] overflow-y-auto 
          ${operationType === 'escolaSegura'
            ? 'bg-gradient-to-br from-purple-900 to-purple-800'
            : 'bg-gradient-to-br from-indigo-900 to-indigo-800'
          } 
          text-white border-0 shadow-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl font-bold text-center text-white mb-4">
              <FileText className="h-6 w-6 mr-2 text-cyan-300" />
              <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 text-transparent bg-clip-text">
                DISTRIBUIÇÃO POR GUARNIÇÃO - {mesAno.toUpperCase()}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`${operationType === 'escolaSegura' ? 'bg-purple-700' : 'bg-indigo-700'} p-4 rounded-lg shadow-inner flex flex-col items-center`}>
              <span className={`${operationType === 'escolaSegura' ? 'text-purple-200' : 'text-indigo-200'} font-medium mb-1`}>Total de Extras</span>
              <span className="text-3xl font-bold text-white">{totalEscalas}</span>
            </div>
            
            <div className={`${operationType === 'escolaSegura' ? 'bg-purple-700' : 'bg-indigo-700'} p-4 rounded-lg shadow-inner flex flex-col items-center`}>
              <span className={`${operationType === 'escolaSegura' ? 'text-purple-200' : 'text-indigo-200'} font-medium mb-1`}>Guarnição Mais Escalada</span>
              <span className="text-3xl font-bold text-white">
                {guarnicaoMaisEscalada || "N/A"}
              </span>
            </div>
          </div>
          
          {/* Gráfico de Barras Simples */}
          <div className="bg-indigo-800/40 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-center text-indigo-100">
              Distribuição de Extras
            </h3>
            
            <div className="space-y-4">
              {Object.entries(guarnicoesData)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([guarnicao, dados]) => {
                  // Calcular a porcentagem para a largura da barra
                  const porcentagem = totalEscalas > 0 
                    ? Math.round((dados.total / totalEscalas) * 100) 
                    : 0;
                  
                  // Definir cor com base na guarnição
                  const corBarra = 
                    guarnicao === "EXPEDIENTE" ? "bg-cyan-500" :
                    guarnicao === "ALFA" ? "bg-green-500" :
                    guarnicao === "BRAVO" ? "bg-yellow-500" :
                    guarnicao === "CHARLIE" ? "bg-red-500" :
                    "bg-gray-500";
                  
                  return (
                    <div key={guarnicao} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-indigo-100">{guarnicao}</span>
                        <span className="text-sm font-medium text-indigo-100">
                          {dados.total} ({porcentagem}%)
                        </span>
                      </div>
                      <div className="w-full bg-indigo-950 rounded-full h-4 overflow-hidden">
                        <div 
                          className={`${corBarra} h-4 rounded-full transition-all duration-500`}
                          style={{ width: `${porcentagem}%` }}
                        ></div>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
          
          {/* Detalhamento por Guarnição */}
          <div className="bg-indigo-800/40 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold mb-3 text-center text-indigo-100">
              Detalhamento por Guarnição
            </h3>
            
            {Object.entries(guarnicoesData).length === 0 ? (
              <div className="p-4 text-center text-indigo-200">
                Nenhuma guarnição registrada para este mês
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(guarnicoesData)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([guarnicao, dados]) => {
                    // Definir cor com base na guarnição
                    const corHeader = 
                      guarnicao === "EXPEDIENTE" ? "bg-cyan-700" :
                      guarnicao === "ALFA" ? "bg-green-700" :
                      guarnicao === "BRAVO" ? "bg-yellow-700" :
                      guarnicao === "CHARLIE" ? "bg-red-700" :
                      "bg-gray-700";
                    
                    const corBadge = 
                      guarnicao === "EXPEDIENTE" ? "bg-cyan-500" :
                      guarnicao === "ALFA" ? "bg-green-500" :
                      guarnicao === "BRAVO" ? "bg-yellow-500" :
                      guarnicao === "CHARLIE" ? "bg-red-500" :
                      "bg-gray-500";
                    
                    // Função para abrir o modal de detalhes
                    const abrirDetalhesGuarnicao = () => {
                      setGuarnicaoSelecionada(guarnicao);
                      setDetalheGuarnicaoAberto(true);
                    };
                    
                    return (
                      <div 
                        key={guarnicao} 
                        className="bg-indigo-900/40 rounded-lg overflow-hidden border border-indigo-700 transition-all hover:shadow-xl"
                      >
                        <div className={`${corHeader} p-2 text-center font-bold text-white`}>
                          {guarnicao}
                        </div>
                        <div className="p-3">
                          <div className="flex justify-between mb-2">
                            <span className="text-indigo-200">Total de Extras:</span>
                            <span className={`${corBadge} text-white px-2 py-0.5 rounded-full text-sm font-medium`}>
                              {dados.total}
                            </span>
                          </div>
                          <div>
                            <span className="text-indigo-200 text-sm">Dias com extras:</span>
                            <div className="flex flex-wrap mt-1">
                              {dados.dias.sort((a, b) => a - b).map(dia => (
                                <span 
                                  key={`${guarnicao}-dia-${dia}`}
                                  className={`${corBadge} text-white text-xs rounded-full w-6 h-6 flex items-center justify-center m-0.5`}
                                >
                                  {dia}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Botões de ação */}
                          <div className="flex justify-center gap-2 mt-3">
                            <Button
                              variant="outline"
                              className="bg-white/10 hover:bg-white/20 text-white border-white/20 flex items-center p-1.5 h-auto text-xs"
                              onClick={abrirDetalhesGuarnicao}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              Detalhes
                            </Button>
                            
                            <Button
                              variant="outline"
                              className={`${
                                guarnicao === "EXPEDIENTE" ? "bg-cyan-600/70" :
                                guarnicao === "ALFA" ? "bg-green-600/70" :
                                guarnicao === "BRAVO" ? "bg-yellow-600/70" :
                                guarnicao === "CHARLIE" ? "bg-red-600/70" :
                                "bg-gray-600/70"
                              } hover:bg-opacity-100 text-white border-white/20 flex items-center p-1.5 h-auto text-xs`}
                              onClick={() => exportarPDFGuarnicao(guarnicao)}
                            >
                              <Printer className="h-3 w-3 mr-1" />
                              Imprimir PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                })}
              </div>
            )}
          </div>
          
          {/* Legenda e informação */}
          <div className="text-center text-indigo-200 text-xs">
            <Calendar className="inline-block h-4 w-4 mr-1 mb-1" />
            Dados referentes ao mês de {mesAno} | Os militares são agrupados por guarnições conforme escala ordinária
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de detalhes da guarnição selecionada */}
      <Dialog open={detalheGuarnicaoAberto} onOpenChange={setDetalheGuarnicaoAberto}>
        <DialogContent className={`sm:max-w-[75%] w-[800px] max-h-[90vh] overflow-y-auto
          ${operationType === 'escolaSegura'
            ? 'bg-gradient-to-br from-purple-900 to-purple-800'
            : 'bg-gradient-to-br from-indigo-900 to-indigo-800'
          } 
          text-white border-0 shadow-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl font-bold text-center text-white mb-4">
              <Users className="h-6 w-6 mr-2 text-cyan-300" />
              <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 text-transparent bg-clip-text">
                DETALHES DA GUARNIÇÃO {guarnicaoSelecionada?.toUpperCase()}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {guarnicaoSelecionada && guarnicoesData[guarnicaoSelecionada] && (
            <>
              {/* Cabeçalho com estatísticas */}
              <div className={`${
                guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-700" :
                guarnicaoSelecionada === "ALFA" ? "bg-green-700" :
                guarnicaoSelecionada === "BRAVO" ? "bg-yellow-700" :
                guarnicaoSelecionada === "CHARLIE" ? "bg-red-700" :
                "bg-gray-700"
              } p-4 rounded-lg shadow-inner mb-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">Guarnição {guarnicaoSelecionada}</h3>
                    <p className="text-sm text-white/80">Mês de referência: {mesAno}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/80">Total de extras</div>
                    <div className="text-2xl font-bold text-white">{guarnicoesData[guarnicaoSelecionada].total}</div>
                  </div>
                </div>
              </div>
              
              {/* Tabs para diferentes visualizações */}
              <div className="bg-indigo-800/40 rounded-lg p-4 mb-4">
                <Tabs defaultValue="por-dia" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger 
                      value="por-dia"
                      className={`${
                        guarnicaoSelecionada === "EXPEDIENTE" ? "data-[state=active]:bg-cyan-600" :
                        guarnicaoSelecionada === "ALFA" ? "data-[state=active]:bg-green-600" :
                        guarnicaoSelecionada === "BRAVO" ? "data-[state=active]:bg-yellow-600" :
                        guarnicaoSelecionada === "CHARLIE" ? "data-[state=active]:bg-red-600" :
                        "data-[state=active]:bg-gray-600"
                      } data-[state=active]:text-white`}
                    >
                      <Calendar className="h-4 w-4 mr-1.5" />
                      Por Dia
                    </TabsTrigger>
                    <TabsTrigger 
                      value="por-militar"
                      className={`${
                        guarnicaoSelecionada === "EXPEDIENTE" ? "data-[state=active]:bg-cyan-600" :
                        guarnicaoSelecionada === "ALFA" ? "data-[state=active]:bg-green-600" :
                        guarnicaoSelecionada === "BRAVO" ? "data-[state=active]:bg-yellow-600" :
                        guarnicaoSelecionada === "CHARLIE" ? "data-[state=active]:bg-red-600" :
                        "data-[state=active]:bg-gray-600"
                      } data-[state=active]:text-white`}
                    >
                      <User className="h-4 w-4 mr-1.5" />
                      Por Militar
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Visualização por dia */}
                  <TabsContent value="por-dia">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {guarnicaoSelecionada && guarnicoesData[guarnicaoSelecionada].militaresPorDia && 
                        Object.entries(guarnicoesData[guarnicaoSelecionada].militaresPorDia!)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([dia, militares]) => (
                            <div 
                              key={`dia-${dia}`} 
                              className={`${
                                guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-800/30" :
                                guarnicaoSelecionada === "ALFA" ? "bg-green-800/30" :
                                guarnicaoSelecionada === "BRAVO" ? "bg-yellow-800/30" :
                                guarnicaoSelecionada === "CHARLIE" ? "bg-red-800/30" :
                                "bg-gray-800/30"
                              } p-3 rounded-lg border border-indigo-700/50 hover:shadow-lg transition-all`}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className={`${
                                  guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-700" :
                                  guarnicaoSelecionada === "ALFA" ? "bg-green-700" :
                                  guarnicaoSelecionada === "BRAVO" ? "bg-yellow-700" :
                                  guarnicaoSelecionada === "CHARLIE" ? "bg-red-700" :
                                  "bg-gray-700"
                                } text-white font-bold py-1 px-3 rounded-full text-sm`}>
                                  Dia {dia}
                                </div>
                                <span className="text-xs text-indigo-200">{getWeekdayName(parseInt(dia), currentDate.getMonth() + 1, currentDate.getFullYear())}</span>
                              </div>
                              
                              <div className="space-y-1">
                                {militares.map((militar, idx) => (
                                  <div 
                                    key={`militar-${dia}-${idx}`}
                                    className="bg-indigo-900/50 p-2 rounded text-sm text-white flex items-center"
                                  >
                                    <User className="h-3 w-3 mr-2 text-indigo-300" />
                                    {militar}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                      }
                    </div>
                  </TabsContent>
                  
                  {/* Visualização por militar */}
                  <TabsContent value="por-militar">
                    {guarnicaoSelecionada && guarnicoesData[guarnicaoSelecionada].militaresPorDia && (() => {
                      // Organizar dados por militares
                      const militaresPorDia = guarnicoesData[guarnicaoSelecionada].militaresPorDia || {};
                      const militaresInfo: Record<string, { nome: string, dias: number[] }> = {};
                      
                      // Para cada dia, processar os militares
                      Object.entries(militaresPorDia).forEach(([dia, militares]) => {
                        const diaNum = parseInt(dia, 10);
                        
                        militares.forEach(militar => {
                          if (!militaresInfo[militar]) {
                            militaresInfo[militar] = { nome: militar, dias: [] };
                          }
                          militaresInfo[militar].dias.push(diaNum);
                        });
                      });
                      
                      // Converter para array e ordenar por nome
                      const militaresArray = Object.values(militaresInfo).sort((a, b) => 
                        a.nome.localeCompare(b.nome)
                      );
                      
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {militaresArray.map((info, idx) => (
                            <div 
                              key={`info-militar-${idx}`}
                              className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-700/50 hover:shadow-lg transition-all"
                            >
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-white">{info.nome}</h4>
                                <div className={`${
                                  guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-700" :
                                  guarnicaoSelecionada === "ALFA" ? "bg-green-700" :
                                  guarnicaoSelecionada === "BRAVO" ? "bg-yellow-700" :
                                  guarnicaoSelecionada === "CHARLIE" ? "bg-red-700" :
                                  "bg-gray-700"
                                } text-white text-xs px-2 py-1 rounded-full`}>
                                  {info.dias.length} dias
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-1">
                                {info.dias.sort((a, b) => a - b).map(dia => (
                                  <span 
                                    key={`dia-${info.nome}-${dia}`}
                                    className={`${
                                      guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-700/80" :
                                      guarnicaoSelecionada === "ALFA" ? "bg-green-700/80" :
                                      guarnicaoSelecionada === "BRAVO" ? "bg-yellow-700/80" :
                                      guarnicaoSelecionada === "CHARLIE" ? "bg-red-700/80" :
                                      "bg-gray-700/80"
                                    } text-white text-xs rounded-md p-1.5 flex items-center`}
                                  >
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Dia {dia}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Botões de ação */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                  onClick={() => setDetalheGuarnicaoAberto(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
                
                <Button
                  variant="outline"
                  className={`${
                    guarnicaoSelecionada === "EXPEDIENTE" ? "bg-cyan-700 hover:bg-cyan-800" :
                    guarnicaoSelecionada === "ALFA" ? "bg-green-700 hover:bg-green-800" :
                    guarnicaoSelecionada === "BRAVO" ? "bg-yellow-700 hover:bg-yellow-800" :
                    guarnicaoSelecionada === "CHARLIE" ? "bg-red-700 hover:bg-red-800" :
                    "bg-gray-700 hover:bg-gray-800"
                  } text-white border-white/20`}
                  onClick={() => guarnicaoSelecionada && exportarPDFGuarnicao(guarnicaoSelecionada)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF da Guarnição
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}