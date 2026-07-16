import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Pages
import { UserSelection } from '@/pages/user-selection';
import { RequireAuth } from '@/components/require-auth';
import { ChatList } from '@/pages/chat';
import { ChatDetail } from '@/pages/chat-detail';
import { DataCenter } from '@/pages/data-center';
import { AdminUsers } from './pages/admin-users';
import { AdminFolders } from './pages/admin-folders';
import { FileDetail } from './pages/file-detail';
import { FolderDetail } from './pages/folder-detail';
import { SettingsPage } from './pages/settings';
import { History } from './pages/history';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página no encontrada</p>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return <div className="p-8"><h1>{title}</h1></div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={UserSelection} />
      
      <Route path="/chat">
        <RequireAuth>
          <ChatList />
        </RequireAuth>
      </Route>
      
      <Route path="/chat/:id">
        <RequireAuth>
          <ChatDetail />
        </RequireAuth>
      </Route>
      
      <Route path="/data-center">
        <RequireAuth>
          <DataCenter />
        </RequireAuth>
      </Route>

      <Route path="/data-center/:folderId/files/:fileId">
        <RequireAuth>
          <FileDetail />
        </RequireAuth>
      </Route>

      <Route path="/data-center/:folderId">
        <RequireAuth>
          <FolderDetail />
        </RequireAuth>
      </Route>

      <Route path="/history">
        <RequireAuth>
          <History />
        </RequireAuth>
      </Route>

      <Route path="/admin/folders">
        <RequireAuth>
          <AdminFolders />
        </RequireAuth>
      </Route>

      <Route path="/admin/users">
        <RequireAuth>
          <AdminUsers />
        </RequireAuth>
      </Route>

      <Route path="/settings">
        <RequireAuth>
          <SettingsPage />
        </RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
