import type { ComponentType } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CircleDollarSign,
  HeartPulse,
  Home,
  ListChecks,
  Sparkles,
  Users,
  Video
} from "lucide-react";
import type { EventType } from "../../types/event";

const ICONS: Record<EventType, ComponentType<{ size?: number; className?: string }>> = {
  session: Sparkles,
  meeting: Video,
  task: ListChecks,
  reminder: Bell,
  family: Home,
  foundation: BriefcaseBusiness,
  personal: CalendarCheck,
  medical: HeartPulse,
  payment: CircleDollarSign,
  other: Users
};

interface EventTypeIconProps {
  type: EventType;
  size?: number;
  className?: string;
}

export function EventTypeIcon({ type, size = 16, className = "" }: EventTypeIconProps) {
  const Icon = ICONS[type] || ICONS.other;
  return <Icon size={size} className={className} />;
}

