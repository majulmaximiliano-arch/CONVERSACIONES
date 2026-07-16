import { useGetSession, useListMarcas, getListMarcasQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, ChevronRight } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { cn } from "@/lib/utils";

const BRAND_COLORS: Record<string, string> = {
  volkswagen: "#1B3F7D",
  toyota: "#CC0000",
  ford: "#003C71",
};

export function DataCenter() {
  const { data: session } = useGetSession();
  const userId = session?.user?.id;

  const { data: marcas, isLoading } = useListMarcas(
    {},
    { query: { enabled: !!userId, queryKey: getListMarcasQueryKey({}) } }
  );

  const activeMarcas = marcas?.filter((m) => m.isActive) ?? [];

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            Centro de Datos
          </h1>
          <p className="text-muted-foreground mt-2">
            Seleccioná una marca para explorar sus datos por tipo de negocio.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : activeMarcas.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Sin marcas disponibles</p>
            <p className="text-sm mt-1">El administrador aún no configuró ninguna marca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMarcas.map((marca) => {
              const accentColor = BRAND_COLORS[marca.slug] ?? "#3B82F6";
              return (
                <WouterLink key={marca.id} href={`/data-center/${marca.id}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group overflow-hidden">
                    <div className="h-2 w-full" style={{ backgroundColor: accentColor }} />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          {marca.logoUrl ? (
                            <img
                              src={marca.logoUrl}
                              alt={marca.name}
                              className="h-10 object-contain mb-3"
                            />
                          ) : (
                            <div
                              className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3"
                              style={{ backgroundColor: accentColor }}
                            >
                              {marca.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">
                            {marca.name}
                          </CardTitle>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                          {marca.tipoNegocioCount} tipo{marca.tipoNegocioCount !== 1 ? "s" : ""} de negocio
                        </span>
                        {!marca.isActive && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            Inactiva
                          </Badge>
                        )}
                      </div>
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
