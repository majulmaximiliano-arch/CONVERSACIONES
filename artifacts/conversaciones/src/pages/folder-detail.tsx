import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetFolder, 
  useGetSession, 
  useDeleteFile,
  getGetFolderQueryKey,
  DataFile
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChevronLeft, FolderOpen, Upload, FileSpreadsheet, 
  MoreVertical, Trash2, Eye, FileWarning, CheckCircle2, Shield, Globe, Car
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function FileUploader({ folderId, onSuccess }: { folderId: number, onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session } = useGetSession();
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !session?.user?.id) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', String(session.user.id));
    
    try {
      const response = await fetch(`/api/folders/${folderId}/upload`, { 
        method: 'POST', 
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      toast({ title: "Archivo subido", description: "El archivo se está procesando." });
      setOpen(false);
      setFile(null);
      onSuccess();
    } catch (err) {
      toast({ 
        title: "Error al subir", 
        description: "Hubo un problema al subir el archivo.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" /> Subir Archivo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir Nuevo Archivo</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx, .xls) o CSV. El sistema detectará automáticamente las columnas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="file">Archivo de datos</Label>
            <Input 
              id="file" 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Subiendo..." : "Subir y Analizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FolderDetail() {
  const { id } = useParams();
  const folderId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: folder, isLoading } = useGetFolder(
    folderId,
    { query: { enabled: !!folderId, queryKey: getGetFolderQueryKey(folderId) } }
  );

  const deleteFile = useDeleteFile();

  const handleDelete = (fileId: number) => {
    if (confirm("¿Estás seguro de eliminar este archivo? Esto no se puede deshacer.")) {
      deleteFile.mutate(
        { fileId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderId) });
            toast({ title: "Archivo eliminado" });
          }
        }
      );
    }
  };

  const getMonthName = (month?: number | null) => {
    if (!month) return '-';
    const date = new Date();
    date.setMonth(month - 1);
    return format(date, "MMMM", { locale: es });
  };

  if (isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!folder) {
    return <div className="p-8">Carpeta no encontrada</div>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-8 py-4 flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/data-center')} className="shrink-0 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm" style={folder.color ? { backgroundColor: folder.color, color: '#fff' } : { backgroundColor: 'hsl(var(--primary))', color: '#fff' }}>
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight leading-none">{folder.name}</h1>
                {folder.scope === 'brand' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                    <Car className="h-3 w-3" />{folder.brand ?? 'Marca'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    <Globe className="h-3 w-3" />Todo el mercado
                  </span>
                )}
              </div>
              {folder.description && (
                <p className="text-sm text-muted-foreground mt-1">{folder.description}</p>
              )}
            </div>
          </div>
        </div>
        <FileUploader folderId={folderId} onSuccess={() => queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderId) })} />
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Main Content - Files List */}
          <div className="xl:col-span-3 space-y-6">
            <h2 className="text-lg font-semibold">Archivos Históricos</h2>
            
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Archivo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Filas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folder.files?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No hay archivos en esta carpeta.
                      </TableCell>
                    </TableRow>
                  ) : (
                    folder.files?.map((file) => (
                      <TableRow key={file.id} className="group">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-primary/70" />
                              {file.originalFilename}
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              Subido {format(new Date(file.uploadedAt), "dd/MM/yyyy", { locale: es })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.periodYear && file.periodMonth ? (
                            <div className="capitalize">{getMonthName(file.periodMonth)} {file.periodYear}</div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{file.brand || '-'}</TableCell>
                        <TableCell>{file.rowCount ? new Intl.NumberFormat().format(file.rowCount) : '-'}</TableCell>
                        <TableCell>
                          {file.status === 'confirmed' ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 border-0">
                              <CheckCircle2 className="h-3 w-3" /> Confirmado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 gap-1">
                              <FileWarning className="h-3 w-3" /> Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/data-center/${folderId}/files/${file.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> Revisar Detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(file.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Right Sidebar - Permissions */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Accesos
            </h2>
            <Card>
              <div className="p-4 flex flex-col gap-3">
                {folder.permissions?.map((perm) => (
                  <div key={perm.userId} className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-medium text-xs">
                      {perm.userName?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate">{perm.userName}</div>
                      <div className="text-xs text-muted-foreground truncate">{perm.userEmail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
