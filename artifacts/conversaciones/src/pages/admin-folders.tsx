import { useState } from "react";
import {
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListUsers,
  useGrantFolderPermission,
  useRevokeFolderPermission,
  getGetFolderPermissionsQueryKey,
  getListFoldersQueryKey,
  useGetFolderPermissions,
  Folder,
  FolderInputScope,
  FolderUpdateScope,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Globe,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BRANDS = [
  "Toyota",
  "Volkswagen",
  "Ford",
  "Chevrolet",
  "Renault",
  "Peugeot",
  "Fiat",
  "Honda",
  "Hyundai",
  "Otra",
];

const COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#06B6D4", "#F97316", "#84CC16",
  "#EC4899", "#6B7280",
];

type FolderScope = "market" | "brand";

interface FolderFormState {
  name: string;
  description: string;
  color: string;
  scope: FolderScope;
  brand: string;
  customBrand: string;
}

const DEFAULT_FORM: FolderFormState = {
  name: "",
  description: "",
  color: "#3B82F6",
  scope: "market",
  brand: "",
  customBrand: "",
};

function FolderFormDialog({
  open,
  onOpenChange,
  folder,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folder?: Folder | null;
  onSave: (data: { name: string; description?: string; color?: string; scope: FolderInputScope & FolderUpdateScope; brand?: string }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FolderFormState>(() =>
    folder
      ? {
          name: folder.name,
          description: folder.description ?? "",
          color: folder.color ?? "#3B82F6",
          scope: (folder.scope as FolderScope) ?? "market",
          brand: BRANDS.includes(folder.brand ?? "") ? (folder.brand ?? "") : folder.brand ? "Otra" : "",
          customBrand: !BRANDS.includes(folder.brand ?? "") && folder.brand ? folder.brand : "",
        }
      : DEFAULT_FORM,
  );

  const effectiveBrand = form.brand === "Otra" ? form.customBrand : form.brand;

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color,
      scope: form.scope,
      brand: form.scope === "brand" ? (effectiveBrand || undefined) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{folder ? "Editar Carpeta" : "Nueva Carpeta"}</DialogTitle>
          <DialogDescription>
            Configurá el nombre, alcance y marca de la carpeta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Nombre *</Label>
            <Input
              id="folder-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Ventas Toyota Julio"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="folder-desc">Descripción</Label>
            <Textarea
              id="folder-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descripción opcional de la carpeta"
              rows={2}
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Alcance</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, scope: "market", brand: "" }))}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                  form.scope === "market"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                <Globe className="h-5 w-5" />
                Todo el mercado
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, scope: "brand" }))}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                  form.scope === "brand"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                <Car className="h-5 w-5" />
                Marca específica
              </button>
            </div>
          </div>

          {/* Brand */}
          {form.scope === "brand" && (
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Select
                value={form.brand}
                onValueChange={(v) => setForm((f) => ({ ...f, brand: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná la marca" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.brand === "Otra" && (
                <Input
                  className="mt-2"
                  value={form.customBrand}
                  onChange={(e) => setForm((f) => ({ ...f, customBrand: e.target.value }))}
                  placeholder="Nombre de la marca"
                />
              )}
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    form.color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || loading}>
            {loading ? "Guardando..." : folder ? "Guardar cambios" : "Crear carpeta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: {
  folderId: number;
  folderName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allUsers } = useListUsers();
  const { data: permissions, isLoading } = useGetFolderPermissions(folderId, {
    query: {
      enabled: open,
      queryKey: getGetFolderPermissionsQueryKey(folderId),
    },
  });

  const grant = useGrantFolderPermission();
  const revoke = useRevokeFolderPermission();

  const permittedIds = new Set(permissions?.map((p) => p.userId) ?? []);

  const handleToggle = (userId: number, hasAccess: boolean) => {
    if (hasAccess) {
      revoke.mutate(
        { folderId, userId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFolderPermissionsQueryKey(folderId) });
            toast({ title: "Acceso revocado" });
          },
        },
      );
    } else {
      grant.mutate(
        { folderId, data: { userId } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFolderPermissionsQueryKey(folderId) });
            toast({ title: "Acceso otorgado" });
          },
        },
      );
    }
  };

  const analysts = allUsers?.filter((u) => u.role === "analyst") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accesos — {folderName}</DialogTitle>
          <DialogDescription>
            Controlá qué analistas pueden ver esta carpeta. Los admins siempre tienen acceso completo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : analysts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay analistas registrados.</div>
          ) : (
            analysts.map((user) => {
              const hasAccess = permittedIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <Button
                    variant={hasAccess ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => handleToggle(user.id, hasAccess)}
                  >
                    {hasAccess ? "Revocar" : "Dar acceso"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminFolders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: folders, isLoading } = useListFolders({}, { query: { queryKey: getListFoldersQueryKey({}) } });

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [permFolder, setPermFolder] = useState<Folder | null>(null);

  const handleCreate = (data: Parameters<typeof createFolder.mutate>[0]["data"]) => {
    createFolder.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey({}) });
          setCreateOpen(false);
          toast({ title: "Carpeta creada" });
        },
        onError: () => toast({ title: "Error al crear la carpeta", variant: "destructive" }),
      },
    );
  };

  const handleEdit = (data: Parameters<typeof updateFolder.mutate>[0]["data"]) => {
    if (!editFolder) return;
    updateFolder.mutate(
      { folderId: editFolder.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey({}) });
          setEditFolder(null);
          toast({ title: "Carpeta actualizada" });
        },
        onError: () => toast({ title: "Error al actualizar la carpeta", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (folder: Folder) => {
    if (!confirm(`¿Eliminar la carpeta "${folder.name}"? Esto también eliminará todos sus archivos.`)) return;
    deleteFolder.mutate(
      { folderId: folder.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey({}) });
          toast({ title: "Carpeta eliminada" });
        },
        onError: () => toast({ title: "Error al eliminar la carpeta", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Carpetas</h1>
            <p className="text-muted-foreground mt-1">
              Creá y administrá las carpetas de datos y sus accesos.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Nueva Carpeta
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground font-medium">
              {folders?.length ?? 0} carpeta{folders?.length !== 1 ? "s" : ""} registrada{folders?.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Carpeta</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Archivos</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : folders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No hay carpetas. Creá la primera.
                    </TableCell>
                  </TableRow>
                ) : (
                  folders?.map((folder) => (
                    <TableRow key={folder.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: folder.color ?? "#3B82F6", color: "#fff" }}
                          >
                            <span className="text-xs font-bold">
                              {folder.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{folder.name}</div>
                            {folder.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {folder.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {folder.scope === "brand" ? (
                          <Badge variant="outline" className="gap-1 text-xs border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                            <Car className="h-3 w-3" />
                            {folder.brand ?? "Sin especificar"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                            <Globe className="h-3 w-3" />
                            Todo el mercado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {folder.fileCount} archivo{folder.fileCount !== 1 ? "s" : ""}
                        </span>
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
                            <DropdownMenuItem onClick={() => setEditFolder(folder)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPermFolder(folder)}>
                              <Users className="mr-2 h-4 w-4" /> Gestionar accesos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(folder)}
                            >
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
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <FolderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        loading={createFolder.isPending}
      />

      {/* Edit dialog */}
      {editFolder && (
        <FolderFormDialog
          open={!!editFolder}
          onOpenChange={(v) => !v && setEditFolder(null)}
          folder={editFolder}
          onSave={handleEdit}
          loading={updateFolder.isPending}
        />
      )}

      {/* Permissions dialog */}
      {permFolder && (
        <PermissionsDialog
          folderId={permFolder.id}
          folderName={permFolder.name}
          open={!!permFolder}
          onOpenChange={(v) => !v && setPermFolder(null)}
        />
      )}
    </div>
  );
}
