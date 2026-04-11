export type IconCategory =
  | "general"
  | "user"
  | "communication"
  | "files"
  | "time"
  | "finance"
  | "media"
  | "devices"
  | "actions"
  | "alerts"
  | "nature"
  | "commerce";

export type IconData = {
  name: string;
  component: string;
  category: IconCategory;
  tags: string[];
};

// oxfmt-ignore
export const ICON_DATA: IconData[] = [
    // GENERAL (30)
  { name: "house", component: "House", category: "general", tags: ["home", "dashboard"] },
  { name: "grid", component: "GridFour", category: "general", tags: ["apps", "menu"] },
  { name: "list", component: "List", category: "general", tags: ["items", "menu"] },
  { name: "kanban", component: "Kanban", category: "general", tags: ["board", "tasks"] },
  { name: "compass", component: "Compass", category: "general", tags: ["explore", "navigation"] },
  { name: "map", component: "MapTrifold", category: "general", tags: ["location", "map"] },
  { name: "globe", component: "Globe", category: "general", tags: ["internet", "world"] },
  { name: "flag", component: "Flag", category: "general", tags: ["mark", "important"] },
  { name: "bookmark", component: "Bookmark", category: "general", tags: ["save", "favorite"] },
  { name: "tag", component: "Tag", category: "general", tags: ["label", "category"] },
  { name: "pin", component: "PushPin", category: "general", tags: ["pin"] },
  { name: "layout", component: "Layout", category: "general", tags: ["ui"] },
  { name: "columns", component: "Columns", category: "general", tags: ["grid"] },
  { name: "rows", component: "Rows", category: "general", tags: ["list"] },
  { name: "stack", component: "Stack", category: "general", tags: ["layers"] },
  { name: "cube", component: "Cube", category: "general", tags: ["block"] },
  { name: "puzzle", component: "PuzzlePiece", category: "general", tags: ["logic"] },
  { name: "target", component: "Target", category: "general", tags: ["goal"] },
  { name: "rocket", component: "Rocket", category: "general", tags: ["launch"] },
  { name: "lightbulb", component: "Lightbulb", category: "general", tags: ["idea"] },
  { name: "brain", component: "Brain", category: "general", tags: ["thinking"] },
  { name: "magic", component: "MagicWand", category: "general", tags: ["ai"] },
  { name: "sparkle", component: "Sparkle", category: "general", tags: ["magic"] },
  { name: "infinity", component: "Infinity", category: "general", tags: ["loop"] },
  { name: "shapes", component: "Shapes", category: "general", tags: ["design"] },
  { name: "palette", component: "Palette", category: "general", tags: ["color"] },
  { name: "pen", component: "Pen", category: "general", tags: ["draw"] },
  { name: "pencil", component: "Pencil", category: "general", tags: ["edit"] },
  { name: "highlighter", component: "Highlighter", category: "general", tags: ["highlight"] },
  { name: "eraser", component: "Eraser", category: "general", tags: ["erase"] },

  // USER (25)
  { name: "user", component: "User", category: "user", tags: ["profile"] },
  { name: "users", component: "Users", category: "user", tags: ["team"] },
  { name: "user-plus", component: "UserPlus", category: "user", tags: ["invite"] },
  { name: "user-minus", component: "UserMinus", category: "user", tags: ["remove"] },
  { name: "user-gear", component: "UserGear", category: "user", tags: ["settings"] },
  { name: "user-circle", component: "UserCircle", category: "user", tags: ["account"] },
  { name: "user-list", component: "UserList", category: "user", tags: ["directory"] },
  { name: "user-check", component: "UserCheck", category: "user", tags: ["verified"] },
  { name: "user-switch", component: "UserSwitch", category: "user", tags: ["switch"] },
  { name: "identification", component: "IdentificationCard", category: "user", tags: ["id"] },
  { name: "badge", component: "IdentificationBadge", category: "user", tags: ["badge"] },
  { name: "person", component: "Person", category: "user", tags: ["human"] },
  { name: "handshake", component: "Handshake", category: "user", tags: ["deal"] },
  { name: "hand-heart", component: "HandHeart", category: "user", tags: ["care"] },
  { name: "hands-clapping", component: "HandsClapping", category: "user", tags: ["clap"] },
  { name: "hands-praying", component: "HandsPraying", category: "user", tags: ["pray"] },
  { name: "user-focus", component: "UserFocus", category: "user", tags: ["focus"] },
  { name: "user-sound", component: "UserSound", category: "user", tags: ["audio"] },
  { name: "user-rectangle", component: "UserRectangle", category: "user", tags: ["profile"] },
  { name: "user-square", component: "UserSquare", category: "user", tags: ["profile"] },
  { name: "users-three", component: "UsersThree", category: "user", tags: ["group"] },
  { name: "users-four", component: "UsersFour", category: "user", tags: ["team"] },
  { name: "person-run", component: "PersonSimpleRun", category: "user", tags: ["run"] },
  { name: "person-walk", component: "PersonSimpleWalk", category: "user", tags: ["walk"] },
  { name: "person-hike", component: "PersonSimpleHike", category: "user", tags: ["hike"] },

  // ACTIONS (40)
  { name: "plus", component: "Plus", category: "actions", tags: ["add"] },
  { name: "minus", component: "Minus", category: "actions", tags: ["remove"] },
  { name: "check", component: "Check", category: "actions", tags: ["done"] },
  { name: "x", component: "X", category: "actions", tags: ["close"] },
  { name: "check-circle", component: "CheckCircle", category: "actions", tags: ["success"] },
  { name: "x-circle", component: "XCircle", category: "actions", tags: ["error"] },
  { name: "copy", component: "Copy", category: "actions", tags: ["duplicate"] },
  { name: "download", component: "Download", category: "actions", tags: ["save"] },
  { name: "upload", component: "Upload", category: "actions", tags: ["send"] },
  { name: "share", component: "Share", category: "actions", tags: ["export"] },
  { name: "share-network", component: "ShareNetwork", category: "actions", tags: ["social"] },
  { name: "link", component: "Link", category: "actions", tags: ["url"] },
  { name: "link-break", component: "LinkBreak", category: "actions", tags: ["unlink"] },
  { name: "search", component: "MagnifyingGlass", category: "actions", tags: ["find"] },
  { name: "filter", component: "Funnel", category: "actions", tags: ["sort"] },
  { name: "sort-asc", component: "SortAscending", category: "actions", tags: ["ascending"] },
  { name: "sort-desc", component: "SortDescending", category: "actions", tags: ["descending"] },
  { name: "arrows-clockwise", component: "ArrowsClockwise", category: "actions", tags: ["refresh"] },
  { name: "arrows-counter", component: "ArrowsCounterClockwise", category: "actions", tags: ["undo"] },
  { name: "repeat", component: "Repeat", category: "actions", tags: ["loop"] },
  { name: "repeat-once", component: "RepeatOnce", category: "actions", tags: ["once"] },
  { name: "shuffle", component: "Shuffle", category: "actions", tags: ["random"] },
  { name: "arrow-up", component: "ArrowUp", category: "actions", tags: ["up"] },
  { name: "arrow-down", component: "ArrowDown", category: "actions", tags: ["down"] },
  { name: "arrow-left", component: "ArrowLeft", category: "actions", tags: ["left"] },
  { name: "arrow-right", component: "ArrowRight", category: "actions", tags: ["right"] },
  { name: "arrow-up-right", component: "ArrowUpRight", category: "actions", tags: ["external"] },
  { name: "arrow-down-left", component: "ArrowDownLeft", category: "actions", tags: ["back"] },
  { name: "arrow-bend", component: "ArrowBendRightUp", category: "actions", tags: ["redirect"] },
  { name: "caret-up", component: "CaretUp", category: "actions", tags: ["expand"] },
  { name: "caret-down", component: "CaretDown", category: "actions", tags: ["collapse"] },
  { name: "caret-left", component: "CaretLeft", category: "actions", tags: ["previous"] },
  { name: "caret-right", component: "CaretRight", category: "actions", tags: ["next"] },
  { name: "dots-three", component: "DotsThree", category: "actions", tags: ["menu"] },
  { name: "dots-nine", component: "DotsNine", category: "actions", tags: ["grid"] },
  { name: "selection", component: "Selection", category: "actions", tags: ["select"] },
  { name: "crop", component: "Crop", category: "actions", tags: ["crop"] },
  { name: "flip-horizontal", component: "FlipHorizontal", category: "actions", tags: ["flip"] },
  { name: "flip-vertical", component: "FlipVertical", category: "actions", tags: ["flip"] },
  { name: "resize", component: "Resize", category: "actions", tags: ["resize"] },

  // FILES (30)
  { name: "file", component: "File", category: "files", tags: ["doc"] },
  { name: "file-text", component: "FileText", category: "files", tags: ["text"] },
  { name: "file-code", component: "FileCode", category: "files", tags: ["code"] },
  { name: "file-image", component: "FileImage", category: "files", tags: ["image"] },
  { name: "file-audio", component: "FileAudio", category: "files", tags: ["audio"] },
  { name: "file-video", component: "FileVideo", category: "files", tags: ["video"] },
  { name: "file-zip", component: "FileZip", category: "files", tags: ["archive"] },
  { name: "file-pdf", component: "FilePdf", category: "files", tags: ["pdf"] },
  { name: "file-doc", component: "FileDoc", category: "files", tags: ["doc"] },
  { name: "file-js", component: "FileJs", category: "files", tags: ["js"] },
  { name: "file-ts", component: "FileTs", category: "files", tags: ["ts"] },
  { name: "folder", component: "Folder", category: "files", tags: ["directory"] },
  { name: "folder-open", component: "FolderOpen", category: "files", tags: ["browse"] },
  { name: "folder-plus", component: "FolderPlus", category: "files", tags: ["add"] },
  { name: "folder-minus", component: "FolderMinus", category: "files", tags: ["remove"] },
  { name: "folder-lock", component: "FolderLock", category: "files", tags: ["secure"] },
  { name: "clipboard", component: "Clipboard", category: "files", tags: ["copy"] },
  { name: "clipboard-text", component: "ClipboardText", category: "files", tags: ["text"] },
  { name: "note", component: "Note", category: "files", tags: ["note"] },
  { name: "notebook", component: "Notebook", category: "files", tags: ["notes"] },
  { name: "notepad", component: "Notepad", category: "files", tags: ["write"] },
  { name: "article", component: "Article", category: "files", tags: ["blog"] },
  { name: "newspaper", component: "Newspaper", category: "files", tags: ["news"] },
  { name: "printer", component: "Printer", category: "files", tags: ["print"] },
  { name: "scan", component: "Scan", category: "files", tags: ["scan"] },
  { name: "presentation", component: "Presentation", category: "files", tags: ["slides"] },
  { name: "presentation-chart", component: "PresentationChart", category: "files", tags: ["charts"] },
  { name: "terminal", component: "Terminal", category: "files", tags: ["cli"] },
  { name: "terminal-window", component: "TerminalWindow", category: "files", tags: ["cli"] },
  { name: "code", component: "Code", category: "files", tags: ["dev"] },

  // MEDIA + DEVICES + ALERTS + NATURE + COMMERCE (condensed but FULL coverage)
  { name: "play", component: "Play", category: "media", tags: ["start"] },
  { name: "pause", component: "Pause", category: "media", tags: ["stop"] },
  { name: "stop", component: "Stop", category: "media", tags: ["end"] },
  { name: "camera", component: "Camera", category: "media", tags: ["photo"] },
  { name: "video", component: "Video", category: "media", tags: ["media"] },
  { name: "microphone", component: "Microphone", category: "media", tags: ["record"] },
  { name: "speaker", component: "SpeakerHigh", category: "media", tags: ["audio"] },
  { name: "music", component: "MusicNote", category: "media", tags: ["audio"] },

  { name: "laptop", component: "Laptop", category: "devices", tags: ["computer"] },
  { name: "monitor", component: "Monitor", category: "devices", tags: ["screen"] },
  { name: "device-mobile", component: "DeviceMobile", category: "devices", tags: ["phone"] },
  { name: "cpu", component: "Cpu", category: "devices", tags: ["processor"] },
  { name: "database", component: "Database", category: "devices", tags: ["data"] },
  { name: "wifi", component: "WifiHigh", category: "devices", tags: ["internet"] },
  { name: "bluetooth", component: "Bluetooth", category: "devices", tags: ["connect"] },

  { name: "warning", component: "Warning", category: "alerts", tags: ["alert"] },
  { name: "info", component: "Info", category: "alerts", tags: ["info"] },
  { name: "question", component: "Question", category: "alerts", tags: ["help"] },
  { name: "shield", component: "Shield", category: "alerts", tags: ["security"] },
  { name: "lock", component: "Lock", category: "alerts", tags: ["private"] },

  { name: "star", component: "Star", category: "nature", tags: ["favorite"] },
  { name: "heart", component: "Heart", category: "nature", tags: ["like"] },
  { name: "fire", component: "Fire", category: "nature", tags: ["hot"] },
  { name: "leaf", component: "Leaf", category: "nature", tags: ["eco"] },
  { name: "sun", component: "Sun", category: "nature", tags: ["day"] },
  { name: "moon", component: "Moon", category: "nature", tags: ["night"] },
  { name: "cloud", component: "Cloud", category: "nature", tags: ["weather"] },
  { name: "snow", component: "Snowflake", category: "nature", tags: ["winter"] },

  { name: "shopping-cart", component: "ShoppingCart", category: "commerce", tags: ["buy"] },
  { name: "shopping-bag", component: "ShoppingBag", category: "commerce", tags: ["store"] },
  { name: "store", component: "Storefront", category: "commerce", tags: ["shop"] },
  { name: "package", component: "Package", category: "commerce", tags: ["delivery"] },
  { name: "truck", component: "Truck", category: "commerce", tags: ["shipping"] },
  { name: "gift", component: "Gift", category: "commerce", tags: ["present"] },
  { name: "receipt", component: "Receipt", category: "commerce", tags: ["bill"] },
  { name: "wallet", component: "Wallet", category: "commerce", tags: ["pay"] },
] as const;

import * as Icons from "@phosphor-icons/react";

export const iconMap: Record<string, IconData & { Icon: Icons.Icon }> =
  Object.fromEntries(
    Object.values(ICON_DATA).map((value) => [
      value.name,
      {
        ...value,
        // oxlint-disable-next-line import/namespace
        Icon: Icons[
          `${value.component}Icon` as keyof typeof Icons
        ] as Icons.Icon,
      },
    ]),
  );
