import { useParams } from "wouter";
import {
  useGetMarca,
  useListTiposNegocio,
  useListFolders,
  useGetMonthlyStatus,
  getGetMarcaQueryKey,
  getListTiposNegocioQueryKey,
  getListFoldersQueryKey,
  getGetMonthlyStatusQueryKey,
  useGetSession,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronRight, ArrowLeft, Folder, CheckCircle2, AlertCircle } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { cn } from "@/lib/utils";

export function DataCenterCarpetas() {
  const { marcaId, tipoNegocioId } = useParams<{ marcaId: string; tipoNegocioId: string }>();
  const marcaIdNum = parseInt(marcaId ?? "0", 10);
  const tipoIdNum = parseInt(tipoNegocioId ?? "0", 10);

  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { data: marca } = useGetMarca(marcaIdNum, {
    query: { enabled: !!marcaIdNum, queryKey: getGetMarcaQueryKey(marcaIdNum) },
  });

  const { data: tipos } = useListTiposNegocio(marcaIdNum, {
    query: { enabled: !!marcaIdNum, queryKey: getListTiposNegocioQueryKey(marcaIdNum) },
  });
  const tipo = tipos?.find((t) => t.id === tipoIdNum);

  const { data: folders, isLoading } = useListFolders(
    { tipoNegocioId: tipoIdNum, userId },
    {
      query: {
        enabled: !!tipoIdNum && !!userId,
        queryKey: getListFoldersQueryKey({ tipoNegocioId: tipoIdNum, userId }),
      },
    }
  );

  const { data: monthlyStatus } = useGetMonthlyStatus(
    { userId, year: currentYear, month: currentMonth },
    {
      query: {
        enabled: !!userId,
        queryKey: getGetMonthlyStatusQueryKey({ userId, year: currentYear, month: currentMonth }),
      },
    }
  );

  const getMonthStatus = (folderId: number) =>
    monthlyStatus?.find((s) => s.folderId === folderId);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <WouterLink href="/data-center" className="hover:text-foreground transition-colors">
            Centro de Datos
          </WouterLink>
          <ChevronRight className="h-3.5 w-3.5" />
          <WouterLink href={`/data-center/${marcaIdNum}`} className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            {marca?.name ?? "..."}
          </WouterLink>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{tipo?.name ?? "..."}</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {tipo?.name ?? "..."} — {marca?.name ?? ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Carpetas de datos disponibles en este tipo de negocio.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : (folders?.length ?? 0) === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Sin carpetas</p>
            <p className="text-sm mt-1">El administrador aún no configuró carpetas para este tipo de negocio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {folders?.map((folder) => {
              const status = getMonthStatus(folder.id);
              const isComplete = status?.hasFileForMonth;
              return (
                <WouterLink
                  key={folder.id}
                  href={`/data-center/${marcaIdNum}/${tipoIdNum}/${folder.id}`}
                >
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start mb-2">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={
                            folder.color
                              ? { backgroundColor: folder.color, color: "#fff" }
                              : { backgroundColor: "#3B82F620", color: "#3B82F6" }
                          }
                        >
                          <Folder className="h-5 w-5" />
                        </div>
                        {status !== undefined && (
                          <div
                            className={cn(
                              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                              isComplete
                                ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
                                : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30"
                            )}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {isComplete ? "Al día" : "Pendiente"}
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">
                        {folder.name}
                      </CardTitle>
                      {folder.description && (
                        <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                          {folder.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                        {folder.fileCount} archivo{folder.fileCount !== 1 ? "s" : ""}
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
