import { Link, useLocation } from "@tanstack/react-router";
import { Activity, ListChecks, TrendingDown, User, LogOut, Shield, Crown, Wallet, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!user) return;
    isCurrentUserAdmin().then(({ isAdmin }) => setIsAdmin(isAdmin)).catch(() => {});
  }, [user]);

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
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={path === "/admin"} tooltip="Admin">
                      <Link to="/admin" onClick={handleNavClick}>
                        <Shield className="h-5 w-5" />
                        <span className="text-base">Admin</span>
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
