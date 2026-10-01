import {
  Award,
  BookOpen,
  CheckSquare,
  FolderKanban,
  Home,
  NotebookPen,
  Settings,
  Target,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: "/" | "/tasks" | "/goals" | "/projects" | "/finance" | "/learning" | "/achievements" | "/notes" | "/settings" | "/profile";
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
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
