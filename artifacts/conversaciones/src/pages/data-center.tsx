import { useGetSession, useListFolders, useGetMonthlyStatus, getListFoldersQueryKey, getGetMonthlyStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Folder, Database, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function DataCenter() {
  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const { data: folders, isLoading: isLoadingFolders } = useListFolders(
    { userId },
    { query: { enabled: !!userId, queryKey: getListFoldersQueryKey({ userId }) } }
  );

  const { data: monthlyStatus, isLoading: isLoadingStatus } = useGetMonthlyStatus(
    { userId, year: currentYear, month: currentMonth },
    { query: { enabled: !!userId, queryKey: getGetMonthlyStatusQueryKey({ userId, year: currentYear, month: currentMonth }) } }
  );

  const formatMonthName = () => {
    return format(new Date(), "MMMM yyyy", { locale: es });
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            Centro de Datos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los archivos fuente de información que alimentan el análisis.
          </p>
        </div>

        {/* Cierre de mes Checklist */}
        <Card className="border-primary/20 shadow-md bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Estatus del Mes Actual: <span className="capitalize">{formatMonthName()}</span>
            </CardTitle>
            <CardDescription>
              Para un análisis preciso, asegúrate de que todos los folders contengan información actualizada de este mes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <div className="text-sm text-muted-foreground">Verificando estatus...</div>
            ) : monthlyStatus?.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tienes carpetas asignadas.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthlyStatus?.map((status) => (
                  <div key={status.folderId} className="flex items-center justify-between p-3 rounded-md bg-background border shadow-sm">
                    <span className="font-medium text-sm truncate pr-2">{status.folderName}</span>
                    {status.hasFileForMonth ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Al día
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Pendiente
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Folders Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Carpetas Disponibles</h2>
          
          {isLoadingFolders ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : folders?.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-xl bg-muted/30">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-medium text-lg">No hay carpetas</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1">
                Aún no tienes acceso a ninguna carpeta de datos. Contacta a un administrador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {folders?.map((folder) => {
                const isComplete = monthlyStatus?.find(s => s.folderId === folder.id)?.hasFileForMonth;
                
                return (
                  <WouterLink key={folder.id} href={`/data-center/${folder.id}`}>
                    <Card className="h-full hover:border-primary/50 transition-colors hover:shadow-md cursor-pointer group">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start mb-2">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                            folder.color ? "" : "bg-primary/10 text-primary"
                          )} style={folder.color ? { backgroundColor: folder.color, color: '#fff' } : {}}>
                            <Folder className="h-5 w-5" />
                          </div>
                          {isComplete !== undefined && (
                            <div className={cn(
                              "h-2.5 w-2.5 rounded-full mt-1.5",
                              isComplete ? "bg-emerald-500" : "bg-amber-500"
                            )} title={isComplete ? "Información al día" : "Falta información del mes actual"} />
                          )}
                        </div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">{folder.name}</CardTitle>
                        {folder.description && (
                          <CardDescription className="line-clamp-2 text-xs leading-relaxed h-8">
                            {folder.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs font-medium text-muted-foreground bg-muted inline-flex px-2.5 py-1 rounded-md">
                          {folder.fileCount} archivo{folder.fileCount !== 1 ? 's' : ''}
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
    </div>
  );
}
