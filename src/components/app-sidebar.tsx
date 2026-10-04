import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { NexoraLogo } from "@/components/nexora-logo";
import { mainNav, secondaryNav } from "@/components/app-nav-items";
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
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/nexora-data";

export function AppSidebar() {
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const { setOpenMobile, isMobile } = useSidebar();
  const [signingOut, setSigningOut] = useState(false);

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.error("Couldn't log out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-5">
        <Link to="/" onClick={closeOnMobile}>
          <NexoraLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} onClick={closeOnMobile}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} onClick={closeOnMobile}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {profile?.full_name ?? "Nexora user"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <SidebarMenuButton onClick={() => void handleSignOut()} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          <span>{signingOut ? "Logging out…" : "Log out"}</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
