import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OfficerSelectProps {
  position: number;
  officers: string[];
  selectedOfficer: string | null;
  disabledOfficers: string[];
  limitReachedOfficers?: string[]; // Oficiais que atingiram o limite de 12 escalas
  onChange: (value: string | null) => void;
}

// Define a special placeholder constant
const PLACEHOLDER_VALUE = "placeholder";

// Função auxiliar para detectar a qual grupo um policial pertence com base no nome
const getOfficerGroup = (officer: string): string => {
  if (officer.includes("QOPM") || officer.includes("MONTEIRO") || 
      officer.includes("VANILSON") || officer.includes("ANDRÉ") || 
      officer.includes("CUNHA") || officer.includes("CARAVELAS") || 
      officer.includes("TONI") || officer.includes("CORREA") || 
      officer.includes("RODRIGUES") || officer.includes("TAVARES")) {
    return "EXPEDIENTE";
  } else if (officer.includes("PEIXOTO") || officer.includes("RODRIGO") || 
             officer.includes("LEDO") || officer.includes("NUNES") || 
             officer.includes("AMARAL") || officer.includes("CARLA") || 
             officer.includes("FELIPE") || officer.includes("BARROS") || 
             officer.includes("A. SILVA") || officer.includes("LUAN") || 
             officer.includes("NAVARRO")) {
    return "ALFA";
  } else if (officer.includes("OLIMAR") || officer.includes("FÁBIO") || 
             officer.includes("ANA CLEIDE") || officer.includes("GLEIDSON") || 
             officer.includes("CARLOS EDUARDO") || officer.includes("NEGRÃO") || 
             officer.includes("BRASIL") || officer.includes("MARVÃO") || 
             officer.includes("IDELVAN")) {
    return "BRAVO";
  } else if (officer.includes("PINHEIRO") || officer.includes("RAFAEL") || 
             officer.includes("MIQUEIAS") || officer.includes("M. PAIXÃO") || 
             officer.includes("CHAGAS") || officer.includes("CARVALHO") || 
             officer.includes("GOVEIA") || officer.includes("ALMEIDA") || 
             officer.includes("PATRIK") || officer.includes("GUIMARÃES")) {
    return "CHARLIE";
  }
  return "OUTROS";
};

export default function OfficerSelect({
  position,
  officers,
  selectedOfficer,
  disabledOfficers,
  limitReachedOfficers = [],
  onChange,
}: OfficerSelectProps) {
  // VERIFICAÇÃO ADICIONAL DE SEGURANÇA: Garantir que nunca podemos selecionar alguém com limite atingido
  const handleChange = (value: string) => {
    // Se for o placeholder, só remove a seleção
    if (value === PLACEHOLDER_VALUE) {
      onChange(null);
      return;
    }
    
    // VERIFICAÇÃO CRUCIAL: Nunca permitir selecionar alguém com limite atingido
    if (limitReachedOfficers.includes(value)) {
      console.error(`🚫 TENTATIVA BLOQUEADA: Seleção de ${value} que já atingiu o limite de 12 serviços`);
      // Não realizar nenhuma ação - bloqueio total
      return;
    }
    
    // Tudo ok, pode prosseguir com a seleção
    onChange(value);
  };

  // Agrupando oficiais por categoria
  const groupedOfficers: Record<string, string[]> = {
    EXPEDIENTE: [],
    ALFA: [],
    BRAVO: [],
    CHARLIE: [],
    OUTROS: []
  };

  // Classificando cada policial em seu grupo
  officers.forEach(officer => {
    const group = getOfficerGroup(officer);
    groupedOfficers[group].push(officer);
  });

  // Ordenando militares dentro de cada grupo por posto/graduação
  const sortByRank = (a: string, b: string): number => {
    const ranks = [
      "CAP", "TEN", "SUB TEN", "1º SGT", "2º SGT", "3º SGT", "CB", "SD"
    ];
    
    // Encontrar o posto/graduação de cada militar
    const getRank = (name: string) => {
      for (const rank of ranks) {
        if (name.includes(rank)) {
          return ranks.indexOf(rank);
        }
      }
      return ranks.length; // Caso não encontre, coloca no final
    };
    
    return getRank(a) - getRank(b);
  };
  
  // Ordenar cada grupo
  Object.keys(groupedOfficers).forEach(group => {
    groupedOfficers[group].sort(sortByRank);
  });

  return (
    <div className="officer-select">
      <div className="flex justify-between items-center mb-1">
        <Label className="text-xs font-semibold text-slate-600">
          Policial {position}
        </Label>
        {selectedOfficer && (
          <span className="text-xs text-blue-700 bg-blue-50 px-1 py-0.5 rounded">
            {selectedOfficer.includes("CAP") || selectedOfficer.includes("TEN") ? "Oficial" : "Praça"}
          </span>
        )}
      </div>
      
      {/* Exibição do policial selecionado com opção para mudar/remover */}
      {selectedOfficer ? (
        <div className="flex items-center">
          <div className={`${limitReachedOfficers.includes(selectedOfficer) 
              ? 'bg-gradient-to-r from-red-50 to-orange-50 text-red-800 border-0 shadow-inner' 
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-slate-800 border-0 shadow-sm'} 
              rounded-lg px-4 py-2.5 text-sm flex-1 truncate relative overflow-hidden`}>
            {/* Efeito de brilho */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-70"></div>
            
            {/* Barra lateral indicadora */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 
              ${limitReachedOfficers.includes(selectedOfficer) 
                ? 'bg-gradient-to-b from-red-500 to-red-600' 
                : 'bg-gradient-to-b from-blue-500 to-indigo-600'}`}>
            </div>
            
            <div className="relative flex items-center">
              {/* Ícone de status */}
              <div className={`mr-2 rounded-full w-5 h-5 flex items-center justify-center 
                ${limitReachedOfficers.includes(selectedOfficer) 
                  ? 'bg-red-200 text-red-700' 
                  : 'bg-blue-200 text-blue-700'}`}>
                {limitReachedOfficers.includes(selectedOfficer) 
                  ? <AlertTriangle className="h-3 w-3" /> 
                  : <span className="text-xs font-bold">{position}</span>}
              </div>
              
              {/* Nome do policial */}
              <span className={`font-medium ${limitReachedOfficers.includes(selectedOfficer) ? 'line-through opacity-70' : ''}`}>
                {selectedOfficer}
              </span>
              
              {/* Badge de limite */}
              {limitReachedOfficers.includes(selectedOfficer) && (
                <span className="ml-2 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold inline-flex items-center px-2 py-1 rounded-full shadow-sm animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  LIMITE ATINGIDO
                </span>
              )}
            </div>
          </div>
          
          {/* Botão de remover com efeito 3D */}
          <button 
            className="ml-2 p-2 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg 
              hover:from-red-600 hover:to-red-700 transition-all duration-200 
              shadow-[0_2px_4px_rgba(239,68,68,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] 
              hover:shadow-[0_3px_6px_rgba(239,68,68,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]
              active:shadow-[0_1px_2px_rgba(239,68,68,0.4),inset_0_1px_1px_rgba(0,0,0,0.1)]
              active:translate-y-0.5
              transform hover:-rotate-12 flex items-center justify-center"
            onClick={() => onChange(null)}
            title="Remover policial da escala"
          >
            <X className="h-4 w-4 drop-shadow-sm" />
          </button>
        </div>
      ) : (
        <Select
          value={selectedOfficer || PLACEHOLDER_VALUE}
          onValueChange={handleChange}
        >
          <SelectTrigger 
            className="w-full rounded-lg border-0 text-sm min-h-[46px] bg-gradient-to-r from-blue-50 to-indigo-50 shadow-[0_2px_5px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:shadow-[0_3px_8px_rgba(59,130,246,0.15),inset_0_1px_1px_rgba(255,255,255,0.8)] transition-all duration-200 relative overflow-hidden pl-8"
            style={{
              backgroundSize: '200% 100%',
              backgroundPosition: '0 0',
              transition: 'background-position 0.5s, box-shadow 0.3s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundPosition = '100% 0';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundPosition = '0 0';
            }}
          >
            {/* Decoração lateral */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600"></div>
            
            {/* Ícone de posição */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
              {position}
            </div>
            
            <SelectValue placeholder="Selecione um policial" />
          </SelectTrigger>
          <SelectContent 
            className="max-h-[350px] overflow-y-auto w-[320px] bg-gradient-to-b from-slate-50 to-white border-0 shadow-lg rounded-lg p-1"
          >
            <SelectItem 
              value={PLACEHOLDER_VALUE}
              className="bg-slate-100 mb-2 rounded-md font-medium text-slate-500 flex items-center justify-center py-2"
            >
              Selecione um policial
            </SelectItem>
            
            {/* AVISO DE LIMITE NO TOPO QUANDO HÁ MILITARES BLOQUEADOS */}
            {limitReachedOfficers.length > 0 && (
              <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-yellow-50 my-2 text-sm rounded-lg shadow-inner border border-yellow-200">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0 animate-pulse" />
                  <div>
                    <p className="font-bold text-red-700 leading-tight">
                      Alerta de Limite GCJO
                    </p>
                    <p className="text-yellow-800 text-xs mt-1">
                      {limitReachedOfficers.length} {limitReachedOfficers.length === 1 ? 'militar atingiu' : 'militares atingiram'} o limite máximo de 12 escalas mensais. Estes militares estão bloqueados para novas escalas.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Grupo EXPEDIENTE */}
            {groupedOfficers.EXPEDIENTE.length > 0 && (
              <SelectGroup>
                <SelectLabel className="font-bold text-blue-600">EXPEDIENTE</SelectLabel>
                {groupedOfficers.EXPEDIENTE.map((officer) => {
                  const hasReachedLimit = limitReachedOfficers.includes(officer);
                  return (
                    <SelectItem
                      key={officer}
                      value={officer}
                      disabled={disabledOfficers.includes(officer) || hasReachedLimit}
                      className={hasReachedLimit 
                        ? "bg-yellow-50 text-yellow-800 line-through border-l-4 border-yellow-500 pl-2 opacity-75" 
                        : ""}
                    >
                      {officer}
                      {hasReachedLimit && (
                        <span className="ml-1 bg-yellow-100 text-yellow-800 text-xs font-medium inline-block px-1.5 py-0.5 rounded">
                          Limite 12
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
            
            {/* Grupo ALFA */}
            {groupedOfficers.ALFA.length > 0 && (
              <SelectGroup>
                <SelectLabel className="font-bold text-yellow-600">ALFA</SelectLabel>
                {groupedOfficers.ALFA.map((officer) => {
                  const hasReachedLimit = limitReachedOfficers.includes(officer);
                  return (
                    <SelectItem
                      key={officer}
                      value={officer}
                      disabled={disabledOfficers.includes(officer) || hasReachedLimit}
                      className={hasReachedLimit 
                        ? "bg-red-100 text-red-800 line-through border-l-4 border-red-600 pl-2 opacity-60" 
                        : ""}
                    >
                      {officer}
                      {hasReachedLimit && (
                        <span className="ml-1 bg-red-200 text-red-700 text-xs font-bold inline-block px-1 py-0.5 rounded">
                          ⛔ BLOQUEADO (12)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
            
            {/* Grupo BRAVO */}
            {groupedOfficers.BRAVO.length > 0 && (
              <SelectGroup>
                <SelectLabel className="font-bold text-green-600">BRAVO</SelectLabel>
                {groupedOfficers.BRAVO.map((officer) => {
                  const hasReachedLimit = limitReachedOfficers.includes(officer);
                  return (
                    <SelectItem
                      key={officer}
                      value={officer}
                      disabled={disabledOfficers.includes(officer) || hasReachedLimit}
                      className={hasReachedLimit 
                        ? "bg-red-100 text-red-800 line-through border-l-4 border-red-600 pl-2 opacity-60" 
                        : ""}
                    >
                      {officer}
                      {hasReachedLimit && (
                        <span className="ml-1 bg-red-200 text-red-700 text-xs font-bold inline-block px-1 py-0.5 rounded">
                          ⛔ BLOQUEADO (12)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
            
            {/* Grupo CHARLIE */}
            {groupedOfficers.CHARLIE.length > 0 && (
              <SelectGroup>
                <SelectLabel className="font-bold text-cyan-600">CHARLIE</SelectLabel>
                {groupedOfficers.CHARLIE.map((officer) => {
                  const hasReachedLimit = limitReachedOfficers.includes(officer);
                  return (
                    <SelectItem
                      key={officer}
                      value={officer}
                      disabled={disabledOfficers.includes(officer) || hasReachedLimit}
                      className={hasReachedLimit 
                        ? "bg-red-100 text-red-800 line-through border-l-4 border-red-600 pl-2 opacity-60" 
                        : ""}
                    >
                      {officer}
                      {hasReachedLimit && (
                        <span className="ml-1 bg-red-200 text-red-700 text-xs font-bold inline-block px-1 py-0.5 rounded">
                          ⛔ BLOQUEADO (12)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
            
            {/* Outros militares que não se encaixam em nenhum grupo */}
            {groupedOfficers.OUTROS.length > 0 && (
              <SelectGroup>
                <SelectLabel className="font-bold text-gray-600">OUTROS</SelectLabel>
                {groupedOfficers.OUTROS.map((officer) => {
                  const hasReachedLimit = limitReachedOfficers.includes(officer);
                  return (
                    <SelectItem
                      key={officer}
                      value={officer}
                      disabled={disabledOfficers.includes(officer) || hasReachedLimit}
                      className={hasReachedLimit 
                        ? "bg-red-100 text-red-800 line-through border-l-4 border-red-600 pl-2 opacity-60" 
                        : ""}
                    >
                      {officer}
                      {hasReachedLimit && (
                        <span className="ml-1 bg-red-200 text-red-700 text-xs font-bold inline-block px-1 py-0.5 rounded">
                          ⛔ BLOQUEADO (12)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
