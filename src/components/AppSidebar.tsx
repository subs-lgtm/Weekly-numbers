"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, Users, Mail, Calendar, Search,
  Building2, Megaphone,
  Handshake, Cloud, Briefcase, MessageSquare,
  LogOut, PenLine, BarChart2, Globe, Share2, Mic, Cog,
  Palette, FlaskConical, Video, BookOpen, DollarSign, Newspaper, BookMarked, Star, Award, Bot,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard };

const summary: NavItem[] = [
  { title: "Summary", url: "/", icon: LayoutDashboard },
  { title: "MQLs", url: "/mqls", icon: Target },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Agent Studio Leads", url: "/agent-studio-leads", icon: Bot },
];

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "SEO",
    items: [
      { title: "SEO", url: "/seo", icon: Search },
      { title: "Content / Blogs", url: "/content", icon: PenLine },
    ],
  },
  {
    label: "Website",
    items: [
      { title: "Website", url: "/pages", icon: Globe },
      { title: "UI/UX Design", url: "/ui-ux", icon: Palette },
      { title: "PR (News Channels)", url: "/pr-news", icon: Newspaper },
    ],
  },
  {
    label: "DevRel",
    items: [
      { title: "DevRel", url: "/architect", icon: Building2 },
      { title: "Docs & Tutorials", url: "/docs-tutorials", icon: BookMarked },
    ],
  },
  {
    label: "Social & Influencers",
    items: [
      { title: "Social & Influencers", url: "/social-influencers", icon: Share2 },
      { title: "Reddit", url: "/reddit", icon: MessageSquare },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Email Marketing", url: "/email", icon: Mail },
      { title: "Events", url: "/events", icon: Calendar },
      { title: "Webinars", url: "/webinars", icon: Video },
      { title: "Ads", url: "/ads", icon: Megaphone },
      { title: "Podcasts & Reach Out", url: "/podcasts", icon: Mic },
      { title: "Content Engine", url: "/content-engine", icon: Cog },
      { title: "Video Pipeline", url: "/video-pipeline", icon: Video },
      { title: "Collaterals", url: "/collaterals", icon: BookOpen },
      { title: "Experiments & Videos", url: "/experiments-videos", icon: FlaskConical },
      { title: "Spotlight CVC", url: "/spotlight-cvc", icon: Star },
      { title: "Analyst Relations", url: "/analyst-relations", icon: BarChart2 },
      { title: "G2", url: "/g2", icon: Award },
    ],
  },
  {
    label: "Partners",
    items: [
      { title: "Emerging Partners", url: "/partners-emerging", icon: Handshake },
      { title: "AWS & Hyperscalers", url: "/partners-aws", icon: Cloud },
      { title: "GSI & SI", url: "/partners-gsi", icon: Briefcase },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Meetings Tracker",      url: "/meetings-tracker",      icon: Calendar },
      { title: "Sales Performance",     url: "/sales-performance",     icon: BarChart2 },
      { title: "Reachout Activity",     url: "/reachout-activity",     icon: Target },
    ],
  },
];

const ADMIN_EMAILS = ['nirupam@lyzr.ai', 'ani@lyzr.ai', 'vaibhav@lyzr.ai', 'pranamya@lyzr.ai']

export function AppSidebar() {
  const pathname = usePathname();
  const { user, signOut, isAdmin } = useAuth();
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname?.startsWith(path) ?? false;
  const canAdmin = isAdmin || (user?.email && ADMIN_EMAILS.includes(user.email))

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="border-b border-[#D4CBC0] bg-[#F2EDE8]">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-[700] text-[#F9F5F1]"
            style={{ background: 'linear-gradient(135deg, #6B4C4C, #8A6060)' }}
          >
            L
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-['DM_Sans'] text-[13px] font-[600] text-[#2A1F1A] leading-tight">
              Lyzr Marketing
            </span>
            <span className="caption">Weekly Numbers</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#F2EDE8]">
        {/* Overview */}
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow px-3 py-2">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {summary.map((s) => (
                <SidebarMenuItem key={s.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(s.url)}
                    tooltip={s.title}
                    className={
                      isActive(s.url)
                        ? "bg-[rgba(107,76,76,.10)] text-[#6B4C4C] border-l-2 border-[#6B4C4C] rounded-l-none font-[500]"
                        : "text-[#2A1F1A] hover:bg-[rgba(107,76,76,.06)] hover:text-[#6B4C4C]"
                    }
                  >
                    <Link href={s.url}>
                      <s.icon className="h-4 w-4" strokeWidth={1.5} />
                      <span className="font-['DM_Sans'] text-[13px]">{s.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dynamic groups */}
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="eyebrow px-3 py-2">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((s) => (
                  <SidebarMenuItem key={s.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(s.url)}
                      tooltip={s.title}
                      className={
                        isActive(s.url)
                          ? "bg-[rgba(107,76,76,.10)] text-[#6B4C4C] border-l-2 border-[#6B4C4C] rounded-l-none font-[500]"
                          : "text-[#2A1F1A] hover:bg-[rgba(107,76,76,.06)] hover:text-[#6B4C4C]"
                      }
                    >
                      <Link href={s.url}>
                        <s.icon className="h-4 w-4" strokeWidth={1.5} />
                        <span className="font-['DM_Sans'] text-[13px]">{s.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow px-3 py-2">Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {canAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin")}
                    tooltip="Admin"
                    className={
                      isActive("/admin")
                        ? "bg-[rgba(107,76,76,.10)] text-[#6B4C4C] border-l-2 border-[#6B4C4C] rounded-l-none font-[500]"
                        : "text-[#2A1F1A] hover:bg-[rgba(107,76,76,.06)] hover:text-[#6B4C4C]"
                    }
                  >
                    <Link href="/admin">
                      <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
                      <span className="font-['DM_Sans'] text-[13px]">Goals & Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/assistant")}
                  tooltip="AI Assistant"
                  className={
                    isActive("/assistant")
                      ? "bg-[rgba(107,76,76,.10)] text-[#6B4C4C] border-l-2 border-[#6B4C4C] rounded-l-none font-[500]"
                      : "text-[#2A1F1A] hover:bg-[rgba(107,76,76,.06)] hover:text-[#6B4C4C]"
                  }
                >
                  <Link href="/assistant">
                    <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                    <span className="font-['DM_Sans'] text-[13px]">AI Assistant</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/budgeting")}
                  tooltip="Budgeting"
                  className={
                    isActive("/budgeting")
                      ? "bg-[rgba(107,76,76,.10)] text-[#6B4C4C] border-l-2 border-[#6B4C4C] rounded-l-none font-[500]"
                      : "text-[#2A1F1A] hover:bg-[rgba(107,76,76,.06)] hover:text-[#6B4C4C]"
                  }
                >
                  <Link href="/budgeting">
                    <DollarSign className="h-4 w-4" strokeWidth={1.5} />
                    <span className="font-['DM_Sans'] text-[13px]">Budgeting</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-[#D4CBC0] bg-[#F2EDE8]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-['DM_Sans'] text-[12px] font-[500] text-[#2A1F1A] truncate">
              {user?.email}
            </span>
            <span className="caption">{isAdmin ? "Admin" : "Member"}</span>
          </div>
          <button
            onClick={() => void signOut()}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7A6A60] hover:bg-[rgba(107,76,76,.08)] hover:text-[#6B4C4C] transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
