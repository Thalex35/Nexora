import {
  Award,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Home,
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
    | "/tasks"
    | "/routines"
    | "/goals"
    | "/projects"
    | "/finance"
    | "/learning"
    | "/achievements"
    | "/notes"
    | "/settings"
    | "/profile";
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Plan & review", url: "/planning", icon: CalendarDays },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Routines", url: "/routines", icon: ListChecks },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Learning", url: "/learning", icon: BookOpen },
  { title: "Achievements", url: "/achievements", icon: Award },
  { title: "Notes", url: "/notes", icon: NotebookPen },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Profile", url: "/profile", icon: User },
];
