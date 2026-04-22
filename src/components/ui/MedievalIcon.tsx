import { cn } from "@/lib/utils";
import {
  Castle,
  Swords,
  Crown,
  Scroll,
  Shield,
  Gem,
  Flame,
  Anchor,
  Trophy,
  Target,
  Mountain,
  BookOpen,
  Dumbbell,
  Sparkles,
  Key,
  Map,
  Award,
} from "lucide-react";
import type { GoalIcon, GroupIcon, RewardIcon } from "@/types";

/** Forziere custom — icona bandiera per i premi */
const Chest = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2.5" y="9" width="19" height="11" rx="1.5" />
    <path d="M2.5 9 Q12 2 21.5 9" />
    <rect x="2.5" y="11.5" width="19" height="2" />
    <circle cx="12" cy="14.5" r="1.2" />
    <path d="M12 15.5V18" />
  </svg>
);

/** Pozione */
const Potion = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 3h6" />
    <path d="M10 3v4.5" />
    <path d="M14 3v4.5" />
    <path d="M6 14.5c0-3 3-5 6-7 3 2 6 4 6 7a6 6 0 0 1-12 0z" />
    <path d="M10 15.5c1 1 3 1 4 0" />
  </svg>
);

/** Spada */
const Sword = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14.5 17.5 21 3l-4 4L7 17.5" />
    <path d="M5 19l2-2" />
    <path d="M8 19H3v-5" />
    <path d="M15 21 18 18" />
  </svg>
);

/** Medaglia */
const Medal = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7 4h10l-3 6H10L7 4z" />
    <circle cx="12" cy="15" r="5" />
    <path d="M12 13v4" />
    <path d="M10 15h4" />
  </svg>
);

const rewardMap: Record<RewardIcon, React.FC<React.SVGProps<SVGSVGElement>>> = {
  chest: Chest,
  sword: Sword,
  shield: Shield as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  potion: Potion,
  gem: Gem as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  crown: Crown as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  scroll: Scroll as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  medal: Medal,
  key: Key as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  map: Map as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
};

const groupMap: Record<GroupIcon, React.FC<React.SVGProps<SVGSVGElement>>> = {
  castle: Castle as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  swords: Swords as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  crown: Crown as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  scroll: Scroll as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  shield: Shield as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  gem: Gem as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  flame: Flame as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  anchor: Anchor as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
};

const goalMap: Record<GoalIcon, React.FC<React.SVGProps<SVGSVGElement>>> = {
  trophy: Trophy as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  target: Target as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  mountain: Mountain as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  scroll: Scroll as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  crown: Crown as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  book: BookOpen as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  dumbbell: Dumbbell as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
  sparkles: Sparkles as unknown as React.FC<React.SVGProps<SVGSVGElement>>,
};

export const REWARD_ICONS: RewardIcon[] = [
  "chest",
  "sword",
  "shield",
  "potion",
  "gem",
  "crown",
  "scroll",
  "medal",
  "key",
  "map",
];
export const GROUP_ICONS: GroupIcon[] = [
  "castle",
  "swords",
  "crown",
  "scroll",
  "shield",
  "gem",
  "flame",
  "anchor",
];
export const GOAL_ICONS: GoalIcon[] = [
  "trophy",
  "target",
  "mountain",
  "scroll",
  "crown",
  "book",
  "dumbbell",
  "sparkles",
];

interface IconProps {
  name: RewardIcon | GroupIcon | GoalIcon;
  className?: string;
  size?: number;
}

export function RewardIconView({ name, className, size = 20 }: { name: RewardIcon; className?: string; size?: number }) {
  const Cmp = rewardMap[name];
  return <Cmp className={cn("", className)} width={size} height={size} />;
}

export function GroupIconView({ name, className, size = 20 }: { name: GroupIcon; className?: string; size?: number }) {
  const Cmp = groupMap[name];
  return <Cmp className={cn("", className)} width={size} height={size} />;
}

export function GoalIconView({ name, className, size = 20 }: { name: GoalIcon; className?: string; size?: number }) {
  const Cmp = goalMap[name];
  return <Cmp className={cn("", className)} width={size} height={size} />;
}

// Gem award-badge: icona decorativa "trofeo" usata in più punti
export function AwardBadge({ className, size = 24, unlocked = false }: { className?: string; size?: number; unlocked?: boolean }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full medieval-border",
        unlocked ? "bg-accent/20 text-accent-foreground" : "bg-muted/40 text-muted-foreground",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Award className={cn(unlocked && "animate-float")} width={size * 0.6} height={size * 0.6} />
    </div>
  );
}

export type { IconProps };
