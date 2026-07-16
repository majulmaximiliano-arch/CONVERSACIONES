import { useParams } from "wouter";
import {
  useGetMarca,
  useListTiposNegocio,
  getGetMarcaQueryKey,
  getListTiposNegocioQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ArrowLeft, Briefcase } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { cn } from "@/lib/utils";

const TIPO_COLORS: Record<string, string> = {
  Ventas: "#3B82F6",
  Postventa: "#EF4444",
  Finanzas: "#10B981",
  RRHH: "#8B5CF6",
  Marketing: "#F59E0B",
  Administración: "#6B7280",
  Calidad: "#06B6D4",
  "Plan de Ahorro": "#F97316",
  Usados: "#84CC16",
  Repuestos: "#EC4899",
};

const TIPO_ICONS: Record<string, string> = {
  Ventas: "💰",
  Postventa: "🔧",
  Finanzas: "📊",
  RRHH: "👥",
  Marketing: "📣",
  Administración: "🏢",
  Calidad: "⭐",
  "Plan de Ahorro": "💳",
  Usados: "🚗",
  Repuestos: "⚙️",
};

export function DataCenterTipos() {
  const { marcaId } = useParams<{ marcaId: string }>();
  const marcaIdNum = parseInt(marcaId ?? "0", 10);

  const { data: marca, isLoading: loadingMarca } = useGetMarca(marcaIdNum, {
    query: { enabled: !!marcaIdNum, queryKey: getGetMarcaQueryKey(marcaIdNum) },
  });

  const { data: tipos, isLoading: loadingTipos } = useListTiposNegocio(marcaIdNum, {
    query: { enabled: !!marcaIdNum, queryKey: getListTiposNegocioQueryKey(marcaIdNum) },
  });

  const isLoading = loadingMarca || loadingTipos;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WouterLink href="/data-center" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Centro de Datos
          </WouterLink>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{marca?.name ?? "..."}</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">{marca?.name ?? "..."}</h1>
          <p className="text-muted-foreground mt-1">
            Seleccioná un tipo de negocio para ver sus carpetas de datos.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (tipos?.length ?? 0) === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Sin tipos de negocio</p>
            <p className="text-sm mt-1">El administrador aún no configuró tipos de negocio para esta marca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tipos?.map((tipo) => {
              const color = TIPO_COLORS[tipo.name] ?? "#3B82F6";
              const icon = TIPO_ICONS[tipo.name] ?? "📁";
              return (
                <WouterLink key={tipo.id} href={`/data-center/${marcaIdNum}/${tipo.id}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between mb-1">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          {icon}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {tipo.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                        {tipo.folderCount} carpeta{tipo.folderCount !== 1 ? "s" : ""}
                      </span>
                    </CardContent>
                  </Card>
                </WouterLink>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
