// Icônes : jeu Lucide, une seule épaisseur de trait (1,75). Même API qu'avant : <Icon name="…" />.
// Interface + pictogrammes de domaine (repli quand une image du jeu manque).
import type { ComponentType, SVGAttributes } from 'preact';
import {
  Anchor, ArrowLeft, Axe, BookOpen, Bug, Building2, Cake, Calendar, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock, CloudLightning, CloudRain,
  CloudSnow, Coins, Compass, CookingPot, Copy, Download, Egg, ExternalLink, Eye, Fish, Flower2, Gem, Gift, Grid2x2, Hammer, Heart, Info, Landmark, LayoutGrid, Leaf,
  List, MapPin, Minus, Moon, MoreHorizontal, Mountain, Package, PartyPopper, PawPrint, Pencil, Pickaxe, Pin, PinOff, Plus, RotateCcw, ScrollText, Search, Settings,
  Shell, Shirt, Skull, Smartphone, Snowflake, Sofa, Sparkles, Sprout, Star, Store, Sun, Sunrise, Swords, Trash2, TreePine, Trophy, Undo2, Upload, User, Users, Waves,
  Wheat, Wind, Wrench, X, Sailboat, Shrub,
} from 'lucide-preact';

type P = SVGAttributes<SVGSVGElement> & { title?: string };

const MAP: Record<string, ComponentType<any>> = {
  // Interface
  today: Sunrise,
  explore: Compass,
  progress: Trophy,
  session: Pin,
  search: Search,
  book: BookOpen,
  check: Check,
  more: MoreHorizontal,
  back: ArrowLeft,
  chevron: ChevronRight,
  'chevron-down': ChevronDown,
  close: X,
  sun: Sun,
  sunny: Sun,
  moon: Moon,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
  windy: Wind,
  blizzard: CloudSnow,
  external: ExternalLink,
  wave: Waves,
  info: Info,
  minus: Minus,
  plus: Plus,
  clock: Clock,
  cake: Cake,
  shop: Store,
  star: Star,
  'star-on': Star,
  edit: Pencil,
  trash: Trash2,
  download: Download,
  upload: Upload,
  list: List,
  grid: LayoutGrid,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  coin: Coins,
  undo: Undo2,
  pin: Pin,
  unpin: PinOff,
  copy: Copy,
  eye: Eye,
  reset: RotateCcw,
  settings: Settings,
  heart: Heart,
  gift: Gift,
  phone: Smartphone,
  help: CircleHelp,
  // Domaines
  cultures: Sprout,
  arbres: TreePine,
  cueillette: Flower2,
  elevage: PawPrint,
  poissons: Fish,
  insectes: Bug,
  'creatures-marines': Shell,
  mineraux: Gem,
  ressources: Package,
  monstres: Skull,
  artisanat: Hammer,
  cuisine: CookingPot,
  outils: Pickaxe,
  armes: Swords,
  pnj: User,
  habitants: Users,
  lieux: MapPin,
  festivals: PartyPopper,
  batiments: Building2,
  quetes: ScrollText,
  maitrises: Sparkles,
  succes: Trophy,
  vetements: Shirt,
  mobilier: Sofa,
  objets: Package,
  groupes: Grid2x2,
  guides: BookOpen,
  temple: Landmark,
  musee: Landmark,
  mines: Mountain,
  ocean: Sailboat,
  oeuf: Egg,
  ble: Wheat,
  feuille: Leaf,
  arbuste: Shrub,
  ancre: Anchor,
  hache: Axe,
  cle: Wrench,
};

export function Icon({ name, title, class: cls, ...p }: P & { name: string }) {
  const C = MAP[name] ?? Package;
  return (
    <C
      {...(p as any)}
      class={cls as string}
      strokeWidth={1.75}
      fill={name === 'star-on' ? 'currentColor' : 'none'}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
