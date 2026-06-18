import { Link, useLocation } from "@tanstack/react-router";
import { Activity, ListChecks, TrendingDown, User, LogOut, Shield, Crown, Wallet, LifeBuoy, Download } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getMyAccess } from "@/lib/subscription.functions"; // sesuaikan path
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin.functions";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Activity },
  { title: "Watchlist", url: "/watchlist", icon: ListChecks },
  { title: "Trailing Stop", url: "/trailing-stop", icon: TrendingDown },
  { title: "Upgrade Pro", url: "/upgrade", icon: Crown },
  { title: "Support", url: "/support", icon: LifeBuoy },
  { title: "Profil", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const path = useLocation({ select: (l) => l.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupportAgent, setIsSupportAgent] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsSupportAgent(false);
      setAccessChecked(false);
      return;
    }
    let active = true;
    getMyAccess()
      .then((access) => {
        if (!active) return;
        setIsAdmin(access.isAdmin || access.isSuperAdmin);
        setIsSupportAgent(access.isSupportAgent ?? false);
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
        setIsSupportAgent(false);
      })
      .finally(() => {
        if (active) setAccessChecked(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
      if (standalone) setCanInstall(false);
    };

    checkStandalone();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const mqHandler = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setCanInstall(false);
    };
    mediaQuery.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mediaQuery.removeEventListener("change", mqHandler);
    };
  }, [isStandalone]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);


  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" onClick={handleNavClick} className="px-2 py-1 text-sm font-semibold tracking-tight">
          IDX Harmonic
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} onClick={handleNavClick}>
                      <item.icon className="h-5 w-5" />
                      <span className="text-base">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {accessChecked && (isAdmin || isSupportAgent) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={path === "/admin"} tooltip="Admin">
                      <Link to="/admin" onClick={handleNavClick}>
                        <Shield className="h-5 w-5" />
                        <span className="text-base">{isSupportAgent && !isAdmin ? "Support" : "Admin"}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={path === "/admin/payments"} tooltip="Pembayaran">
                      <Link to="/admin/payments" onClick={handleNavClick}>
                        <Wallet className="h-5 w-5" />
                        <span className="text-base">Pembayaran</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="justify-start">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
