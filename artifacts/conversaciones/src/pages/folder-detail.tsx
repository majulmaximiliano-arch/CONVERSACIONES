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
  ChevronRight, FolderOpen, Upload, FileSpreadsheet, 
  MoreVertical, Trash2, Eye, FileWarning, CheckCircle2, Shield
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
import { Link as WouterLink } from "wouter";

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
          <Upload className="h-4 w-4" />
          Subir Archivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Archivo Excel</DialogTitle>
          <DialogDescription>
            Seleccioná un archivo .xlsx o .xls. Se creará una nueva versión sin sobrescribir las anteriores.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="file-upload">Archivo Excel</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mt-1.5 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Seleccionado: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Subiendo..." : "Subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FolderDetail() {
  const { marcaId, tipoNegocioId, folderId } = useParams<{ marcaId: string; tipoNegocioId: string; folderId: string }>();
  const [, navigate] = useLocation();
  const folderIdNum = parseInt(folderId ?? "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: folder, isLoading, refetch } = useGetFolder(folderIdNum, {
    query: { enabled: !!folderIdNum, queryKey: getGetFolderQueryKey(folderIdNum) }
  });

  const deleteFile = useDeleteFile();

  const handleDeleteFile = async (fileId: number, filename: string) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return;
    deleteFile.mutate(
      { fileId },
      {
        onSuccess: () => {
          toast({ title: "Archivo eliminado" });
          refetch();
        },
        onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Cargando carpeta...</div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Carpeta no encontrada o sin acceso.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card px-8 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
          <WouterLink href="/data-center" className="hover:text-foreground transition-colors">
            Centro de Datos
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <WouterLink href={`/data-center/${marcaId}`} className="hover:text-foreground transition-colors">
            {folder.marcaName}
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <WouterLink href={`/data-center/${marcaId}/${tipoNegocioId}`} className="hover:text-foreground transition-colors">
            {folder.tipoNegocioName}
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{folder.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={
                folder.color
                  ? { backgroundColor: folder.color, color: "#fff" }
                  : { backgroundColor: "#3B82F620", color: "#3B82F6" }
              }
            >
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">{folder.name}</h1>
              {folder.description && (
                <p className="text-sm text-muted-foreground mt-1">{folder.description}</p>
              )}
            </div>
          </div>
          <FileUploader folderId={folderIdNum} onSuccess={() => refetch()} />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          {folder.files.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <FileWarning className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Sin archivos</p>
              <p className="text-sm mt-1">Subí el primer archivo Excel para esta carpeta.</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Archivo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Filas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Subido</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folder.files.map((file: DataFile) => (
                    <TableRow key={file.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-sm line-clamp-1">{file.originalFilename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {file.periodMonth && file.periodYear
                          ? `${file.periodMonth}/${file.periodYear}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {file.rowCount?.toLocaleString("es-AR") ?? "—"}
                      </TableCell>
                      <TableCell>
                        {file.status === "confirmed" ? (
                          <Badge variant="outline" className="gap-1 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Confirmado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                            <Shield className="h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(file.uploadedAt), "d MMM yy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/data-center/${marcaId}/${tipoNegocioId}/${folderId}/files/${file.id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" /> Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteFile(file.id, file.originalFilename)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
