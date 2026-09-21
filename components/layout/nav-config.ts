import { Home, FileText, Settings } from "lucide-react"
import type { NavItemConfig } from "./nav-item"

/** Central nav items config shared by Sidebar and DrawerNav */
export const navItems: NavItemConfig[] = [
  { icon: Home, label: "Home", href: "/app", id: "nav-home" },
  { icon: FileText, label: "CV Library", href: "/app/documents?type=cv", id: "nav-cv" },
  { icon: Settings, label: "Settings", href: "/app/settings", id: "nav-settings" },
]
