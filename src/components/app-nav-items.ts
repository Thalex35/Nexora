import {
  Award,
  BookOpen,
  ChartNoAxesCombined,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Home,
  History,
  NotebookPen,
  ListChecks,
  Settings,
  Target,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  url:
    | "/"
    | "/planning"
    | "/analytics"
    | "/tasks"
    | "/routines"
    | "/goals"
    | "/projects"
    | "/finance"
    | "/learning"
    | "/achievements"
    | "/life-history"
    | "/notes"
    | "/settings"
    | "/profile";
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Plan & review", url: "/planning", icon: CalendarDays },
  { title: "Analytics", url: "/analytics", icon: ChartNoAxesCombined },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Routines", url: "/routines", icon: ListChecks },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Learning", url: "/learning", icon: BookOpen },
  { title: "Achievements", url: "/achievements", icon: Award },
  { title: "Life History", url: "/life-history", icon: History },
  { title: "Notes", url: "/notes", icon: NotebookPen },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Profile", url: "/profile", icon: User },
];
