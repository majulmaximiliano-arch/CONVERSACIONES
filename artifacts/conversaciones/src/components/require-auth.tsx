import { useGetSession } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { UserSelection } from "@/pages/user-selection";
import { MainLayout } from "@/components/layout";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useGetSession();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !session?.userId && location !== "/") {
      setLocation("/");
    }
  }, [session, isLoading, location, setLocation]);

  if (isLoading) {
    return <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/20" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    </div>;
  }

  if (!session?.userId) {
    return <UserSelection />;
  }

  return <MainLayout>{children}</MainLayout>;
}
