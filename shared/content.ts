import type { Lesson, SceneId, Slot, Task } from "./types";
export const SCENES = [
  {
    id: "cafe" as const,
    name: "街角咖啡店",
    en: "At the café",
    description: "从一杯咖啡，开始你的第一段对话。",
    color: "peach",
    ability: "点一杯喜欢的饮品",
    icon: "Coffee",
  },
  {
    id: "shop" as const,
    name: "日常小商店",
    en: "At the shop",
    description: "找到喜欢的，问一问，再带它回家。",
    color: "sage",
    ability: "询价并完成购买",
    icon: "ShoppingBag",
  },
  {
    id: "directions" as const,
    name: "城市漫步",
    en: "Around the city",
    description: "抬头看路，也能开口问路。",
    color: "blue",
    ability: "问路并确认方向",
    icon: "MapPin",
  },
  {
    id: "friends" as const,
    name: "认识新朋友",
    en: "Hello, new friend",
    description: "一句 hello，让故事有了开始。",
    color: "lavender",
    ability: "介绍自己与交流喜好",
    icon: "Users",
  },
];
const slot = (
  key: string,
  label: string,
  values: Record<string, string[]>,
): Slot => ({ key, label, values });
const drink = slot("drink", "drink", {
  coffee: ["coffee", "espresso", "latte"],
  tea: ["tea"],
  water: ["water"],
});
const size = slot("size", "size", {
  small: ["small", "little"],
  large: ["large", "big"],
});
const service = slot("service", "service", {
  to_go: ["to go", "take away", "takeaway", "take out", "takeout"],
  for_here: ["for here", "eat in", "dine in", "here"],
});
const item = slot("item", "item", {
  apple: ["apple", "apples"],
  bread: ["bread", "loaf"],
  bag: ["bag", "bags"],
  book: ["book", "books"],
});
const quantity = slot("quantity", "quantity", {
  one: ["one", "1", "a single"],
  two: ["two", "2", "a pair"],
  three: ["three", "3"],
});
const price = slot("price", "price", { ask: ["how much", "price", "cost"] });
const destination = slot("destination", "destination", {
  station: ["station", "train"],
  park: ["park"],
  cafe: ["cafe", "café", "coffee shop"],
  museum: ["museum"],
});
const direction = slot("direction", "direction", {
  left: ["left"],
  right: ["right"],
  straight: ["straight", "ahead"],
});
const clarification = slot("clarification", "clarification", {
  repeat: ["again", "repeat", "say that"],
  slow: ["slow", "slowly"],
});
const personName = slot("name", "name", {
  alex: ["alex"],
  sam: ["sam"],
  mia: ["mia"],
  lee: ["lee"],
});
const origin = slot("origin", "home", {
  china: ["china", "chinese"],
  canada: ["canada", "canadian"],
  italy: ["italy", "italian"],
});
const liking = slot("like", "something you like", {
  music: ["music"],
  coffee: ["coffee"],
  reading: ["reading", "books", "read"],
  tea: ["tea"],
});
const action = slot("action", "action", {
  give: ["give", "here you are"],
  take: ["take"],
  open: ["open"],
  close: ["close"],
});
const object = slot("object", "object", {
  water: ["water"],
  cup: ["cup", "cups"],
  coffee: ["coffee"],
});
function task(
  id: string,
  target: Record<string, string>,
  slots: Slot[],
  opening: string,
  questions: Record<string, string>,
  model: string,
  goal: string,
  zh: string,
  icons: string[],
): Task {
  return { id, target, slots, opening, questions, model, goal, zh, icons };
}
function cafe(id: string, d: string, s: string, m: string, transfer = false) {
  return task(
    id,
    { drink: d, size: s, service: m },
    [drink, size, service],
    transfer ? "Hi there! What can I get you?" : "Hello! What would you like?",
    {
      drink: "What would you like to drink?",
      size: transfer ? "What size would you like?" : "Small or large?",
      service: transfer
        ? "Taking it with you, or staying here?"
        : "For here or to go?",
    },
    `A ${s} ${d}, ${m === "to_go" ? "to go" : "for here"}, please.`,
    `Order a ${s} ${d} ${m === "to_go" ? "to go" : "for here"}.`,
    `点一杯${s === "small" ? "小" : "大"}杯${d === "coffee" ? "咖啡" : d === "tea" ? "茶" : "水"}，${m === "to_go" ? "外带" : "堂食"}。`,
    [
      d === "coffee" ? "☕" : d === "tea" ? "🍵" : "💧",
      s === "small" ? "S" : "L",
      m === "to_go" ? "↗" : "⌂",
    ],
  );
}
function shop(id: string, i: string, q: string) {
  return task(
    id,
    { item: i, quantity: q, price: "ask" },
    [item, quantity, price],
    "Hello! Can I help you?",
    {
      item: "What would you like?",
      quantity: "How many would you like?",
      price: "Anything you want to ask before buying?",
    },
    `${q} ${i}${q !== "one" && i !== "bread" ? "s" : ""}, please. How much is it?`,
    `Buy ${q} ${i}${q !== "one" && i !== "bread" ? "s" : ""} and ask the price.`,
    `买${q === "one" ? "一" : q === "two" ? "两" : "三"}件商品，并问价格。`,
    [
      i === "apple" ? "🍎" : i === "bread" ? "🍞" : i === "bag" ? "👜" : "📖",
      q === "one" ? "1" : q === "two" ? "2" : "3",
      "?",
    ],
  );
}
function route(id: string, d: string, r: string, c: string) {
  return task(
    id,
    { destination: d, clarification: c, direction: r },
    [destination, clarification, direction],
    "Hello! Do you need help?",
    {
      destination: "Where would you like to go?",
      clarification: `Go ${r}. ${c === "repeat" ? "You did not catch that. Ask me to repeat." : "Ask me to speak more slowly."}`,
      direction: `Go ${r}. Which way are you going?`,
    },
    `Where is the ${d}? ${c === "repeat" ? "Again, please." : "Slowly, please."} ${r === "straight" ? "Go straight." : `Turn ${r}.`}`,
    `Find the ${d}, ask ${c === "repeat" ? "to hear it again" : "for slower speech"}, then confirm: ${r}.`,
    `找目的地，主动请求${c === "repeat" ? "重复" : "放慢"}，再确认方向。`,
    [
      d === "park"
        ? "🌳"
        : d === "station"
          ? "🚉"
          : d === "museum"
            ? "🏛"
            : "☕",
      c === "repeat" ? "↻" : "◷",
      r === "left" ? "←" : r === "right" ? "→" : "↑",
    ],
  );
}
function friend(id: string, n: string, o: string, l: string) {
  return task(
    id,
    { name: n, origin: o, like: l },
    [personName, origin, liking],
    "Hi! I’m Jamie. What’s your name?",
    {
      name: "What is your name?",
      origin: "Where are you from?",
      like: "What do you like?",
    },
    `I'm ${n[0].toUpperCase() + n.slice(1)}. I'm from ${o[0].toUpperCase() + o.slice(1)}. I like ${l}.`,
    `You are ${n[0].toUpperCase() + n.slice(1)} from ${o[0].toUpperCase() + o.slice(1)}. You like ${l}.`,
    `扮演卡片中的人物，介绍姓名、来源与喜好。`,
    [
      "👋",
      o === "china" ? "🇨🇳" : o === "canada" ? "🇨🇦" : "🇮🇹",
      l === "music" ? "🎵" : l === "coffee" ? "☕" : "📖",
    ],
  );
}
const foundationConfigs: {
  title: string;
  subtitle: string;
  words: string[];
  prompt: string;
  answer: string;
  options: string[][];
  target: Record<string, string>;
  other: Record<string, string>;
  slots: Slot[];
  opening: string;
  questions: Record<string, string>;
  model: string;
  otherModel: string;
  goal: string;
  otherGoal: string;
  zh: string;
  icons: string[];
}[] = [
  {
    title: "从一杯水开始",
    subtitle: "Objects & pointing",
    words: ["Water.", "A cup.", "Coffee, please."],
    prompt: "Water.",
    answer: "water",
    options: [
      ["coffee", "Coffee", "☕"],
      ["water", "Water", "💧"],
      ["cup", "A cup", "🥛"],
    ],
    target: { object: "water" },
    other: { object: "cup" },
    slots: [object],
    opening: "What would you like?",
    questions: { object: "Water, a cup, or coffee?" },
    model: "Water, please.",
    otherModel: "A cup, please.",
    goal: "Ask for water.",
    otherGoal: "Ask for a cup.",
    zh: "请求一杯水。",
    icons: ["💧"],
  },
  {
    title: "我、你和一个动作",
    subtitle: "People & actions",
    words: ["I. You.", "Give me a cup, please.", "Take the cup."],
    prompt: "Give me a cup, please.",
    answer: "give",
    options: [
      ["take", "Take", "🤲"],
      ["give", "Give", "🫴"],
      ["open", "Open", "🚪"],
    ],
    target: { action: "give", object: "cup" },
    other: { action: "take", object: "water" },
    slots: [action, object],
    opening: "What can I do for you?",
    questions: { action: "Give or take?", object: "What object?" },
    model: "Give me a cup, please.",
    otherModel: "Take the water, please.",
    goal: "Ask me to give you a cup.",
    otherGoal: "Ask me to take the water.",
    zh: "请求对方递来杯子。",
    icons: ["🫴", "🥛"],
  },
  {
    title: "一个，还是两个",
    subtitle: "Numbers & choices",
    words: ["One cup.", "Two cups.", "A small cup."],
    prompt: "Two cups.",
    answer: "two",
    options: [
      ["one", "One cup", "🥛"],
      ["two", "Two cups", "🥛🥛"],
      ["three", "Three cups", "🥛🥛🥛"],
    ],
    target: { quantity: "two", object: "cup" },
    other: { quantity: "one", object: "coffee" },
    slots: [quantity, object],
    opening: "What would you like?",
    questions: { quantity: "One or two?", object: "A cup, coffee, or water?" },
    model: "Two cups, please.",
    otherModel: "One coffee, please.",
    goal: "Ask for two cups.",
    otherGoal: "Ask for one coffee.",
    zh: "请求两个杯子。",
    icons: ["2", "🥛"],
  },
  {
    title: "说出需求，也能求助",
    subtitle: "Requests & getting help",
    words: ["Water, please.", "Again, please.", "Slowly, please."],
    prompt: "Again, please.",
    answer: "repeat",
    options: [
      ["repeat", "Hear it again", "↻"],
      ["slow", "Speak slowly", "◷"],
      ["yes", "Yes", "✓"],
    ],
    target: { object: "water", clarification: "repeat" },
    other: { object: "coffee", clarification: "slow" },
    slots: [object, clarification],
    opening: "Hello! What do you need?",
    questions: {
      object: "What would you like?",
      clarification: "Would you like me to say that again, or speak slowly?",
    },
    model: "Water, please. Again, please.",
    otherModel: "Coffee, please. Slowly, please.",
    goal: "Ask for water. Ask to hear it again.",
    otherGoal: "Ask for coffee. Ask me to speak slowly.",
    zh: "请求水，并主动请对方重复。",
    icons: ["💧", "↻"],
  },
];
const foundation: Lesson[] = foundationConfigs.map((c, i) => ({
  id: `foundation-${i + 1}`,
  scene: "foundation",
  order: i,
  title: c.title,
  subtitle: c.subtitle,
  minutes: 6,
  expressions: c.words,
  concept: {
    prompt: c.prompt,
    answer: c.answer,
    options: c.options.map(([value, label, icon]) => ({ value, label, icon })),
  },
  task: task(
    `foundation-${i + 1}-learn`,
    c.target as Record<string, string>,
    c.slots,
    c.opening,
    c.questions,
    c.model,
    c.goal,
    c.zh,
    c.icons,
  ),
  transfer: task(
    `foundation-${i + 1}-transfer`,
    c.other as Record<string, string>,
    c.slots,
    c.opening,
    c.questions,
    c.otherModel,
    c.otherGoal,
    "换一个对象，独立再试一次。",
    i === 0
      ? ["🥛"]
      : i === 1
        ? ["🤲", "💧"]
        : i === 2
          ? ["1", "☕"]
          : ["☕", "◷"],
  ),
  version: 1,
  status: "pilot",
}));
function makeScene(
  scene: SceneId,
  titles: string[],
  subtitles: string[],
  expressions: string[][],
  tasks: Task[],
  transfers: Task[],
  concepts: Lesson["concept"][],
): Lesson[] {
  return titles.map((title, i) => ({
    id: `${scene}-${i + 1}`,
    scene,
    order:
      i +
      4 +
      (scene === "cafe"
        ? 0
        : scene === "shop"
          ? 4
          : scene === "directions"
            ? 8
            : 12),
    title,
    subtitle: subtitles[i],
    minutes: i === 3 ? 12 : 10,
    expressions: expressions[i],
    task: tasks[i],
    transfer: transfers[i],
    concept: concepts[i],
    version: 1,
    status: "pilot",
  }));
}
const choice = (
  prompt: string,
  answer: string,
  values: [string, string, string][],
): Lesson["concept"] => ({
  prompt,
  answer,
  options: values.map(([value, label, icon]) => ({ value, label, icon })),
});
export const LESSONS: Lesson[] = [
  ...foundation,
  ...makeScene(
    "cafe",
    [
      "你的第一杯咖啡",
      "小杯，还是大杯",
      "坐一会儿，或带走",
      "换一家店，再试一次",
    ],
    [
      "Your first order",
      "A little choice",
      "For here or to go",
      "A fresh conversation",
    ],
    [
      ["Coffee, please.", "Can I have a coffee?", "Thank you."],
      ["Small, please.", "A large tea, please.", "Small or large?"],
      ["To go, please.", "For here, please.", "That’s right."],
      ["What can I get you?", "I’d like a tea.", "Yes, please."],
    ],
    [
      cafe("cafe-1-learn", "coffee", "small", "for_here"),
      cafe("cafe-2-learn", "tea", "large", "for_here"),
      cafe("cafe-3-learn", "coffee", "small", "to_go"),
      cafe("cafe-4-learn", "tea", "small", "to_go"),
    ],
    [
      cafe("cafe-1-transfer", "tea", "large", "to_go", true),
      cafe("cafe-2-transfer", "coffee", "small", "to_go", true),
      cafe("cafe-3-transfer", "tea", "large", "for_here", true),
      cafe("cafe-4-transfer", "coffee", "large", "for_here", true),
    ],
    [
      choice("Coffee.", "coffee", [
        ["tea", "Tea", "🍵"],
        ["coffee", "Coffee", "☕"],
        ["water", "Water", "💧"],
      ]),
      choice("A large tea.", "large", [
        ["small", "Small tea", "🍵"],
        ["large", "Large tea", "🍵"],
        ["water", "Water", "💧"],
      ]),
      choice("To go, please.", "to_go", [
        ["for_here", "Stay here", "🪑"],
        ["to_go", "Take it with you", "🛍"],
        ["no", "No drink", "✕"],
      ]),
      choice("A small tea for here.", "tea", [
        ["coffee", "Coffee", "☕"],
        ["tea", "Tea", "🍵"],
        ["water", "Water", "💧"],
      ]),
    ],
  ),
  ...makeScene(
    "shop",
    ["找到你喜欢的", "这个多少钱", "一个还是两个", "在新的小店里"],
    ["This one, please", "Ask the price", "How many?", "A new little shop"],
    [
      ["An apple, please.", "This one, please.", "Thank you."],
      ["How much is it?", "What’s the price?", "Two, please."],
      ["One book, please.", "Two apples, please.", "How much are they?"],
      ["Can I have a bag?", "Three, please.", "How much does it cost?"],
    ],
    [
      shop("shop-1-learn", "apple", "one"),
      shop("shop-2-learn", "bread", "two"),
      shop("shop-3-learn", "book", "two"),
      shop("shop-4-learn", "bag", "one"),
    ],
    [
      shop("shop-1-transfer", "bread", "two"),
      shop("shop-2-transfer", "apple", "three"),
      shop("shop-3-transfer", "bag", "one"),
      shop("shop-4-transfer", "book", "three"),
    ],
    [
      choice("An apple.", "apple", [
        ["bread", "Bread", "🍞"],
        ["apple", "Apple", "🍎"],
        ["book", "Book", "📖"],
      ]),
      choice("How much is it?", "price", [
        ["price", "Ask the price", "🏷"],
        ["quantity", "Ask how many", "🔢"],
        ["no", "Say goodbye", "👋"],
      ]),
      choice("Two books.", "two", [
        ["one", "One book", "📖"],
        ["two", "Two books", "📚"],
        ["three", "Three books", "📚📖"],
      ]),
      choice("A bag, please.", "bag", [
        ["apple", "Apple", "🍎"],
        ["bag", "Bag", "👜"],
        ["book", "Book", "📖"],
      ]),
    ],
  ),
  ...makeScene(
    "directions",
    [
      "想去的那个地方",
      "向左，向右，向前",
      "没听清，也没关系",
      "换条路，出发吧",
    ],
    [
      "Where is the park?",
      "Find your way",
      "Again, please",
      "A different destination",
    ],
    [
      ["Where is the park?", "Go left.", "Again, please."],
      ["Turn right.", "Go straight.", "Where is the station?"],
      ["Again, please.", "Slowly, please.", "Thank you for your help."],
      ["Where is the museum?", "Turn left.", "Is it this way?"],
    ],
    [
      route("directions-1-learn", "park", "left", "repeat"),
      route("directions-2-learn", "station", "right", "slow"),
      route("directions-3-learn", "cafe", "straight", "repeat"),
      route("directions-4-learn", "museum", "left", "slow"),
    ],
    [
      route("directions-1-transfer", "station", "right", "slow"),
      route("directions-2-transfer", "park", "straight", "repeat"),
      route("directions-3-transfer", "museum", "left", "slow"),
      route("directions-4-transfer", "cafe", "right", "repeat"),
    ],
    [
      choice("The park.", "park", [
        ["park", "Park", "🌳"],
        ["station", "Station", "🚉"],
        ["cafe", "Café", "☕"],
      ]),
      choice("Turn right.", "right", [
        ["left", "Left", "←"],
        ["straight", "Straight", "↑"],
        ["right", "Right", "→"],
      ]),
      choice("Again, please.", "repeat", [
        ["repeat", "Hear it again", "↻"],
        ["left", "Turn left", "←"],
        ["bye", "Goodbye", "👋"],
      ]),
      choice("The museum.", "museum", [
        ["park", "Park", "🌳"],
        ["museum", "Museum", "🏛"],
        ["station", "Station", "🚉"],
      ]),
    ],
  ),
  ...makeScene(
    "friends",
    ["从一句 Hello 开始", "你来自哪里", "一点共同的喜欢", "认识另一位新朋友"],
    [
      "Nice to meet you",
      "Where are you from?",
      "Something in common",
      "A new hello",
    ],
    [
      ["Hi, I’m Alex.", "What’s your name?", "Nice to meet you."],
      ["I’m from China.", "Where are you from?", "I’m Sam."],
      ["I like music.", "What do you like?", "I like reading."],
      ["Hello, I’m Mia.", "I’m from Italy.", "I like coffee."],
    ],
    [
      friend("friends-1-learn", "alex", "china", "music"),
      friend("friends-2-learn", "sam", "canada", "reading"),
      friend("friends-3-learn", "lee", "china", "coffee"),
      friend("friends-4-learn", "mia", "italy", "music"),
    ],
    [
      friend("friends-1-transfer", "mia", "italy", "reading"),
      friend("friends-2-transfer", "alex", "china", "coffee"),
      friend("friends-3-transfer", "sam", "canada", "music"),
      friend("friends-4-transfer", "lee", "china", "reading"),
    ],
    [
      choice("Hello!", "hello", [
        ["hello", "Say hello", "👋"],
        ["bye", "Leave", "🚶"],
        ["no", "Say no", "✕"],
      ]),
      choice("I’m from China.", "china", [
        ["canada", "Canada", "🇨🇦"],
        ["china", "China", "🇨🇳"],
        ["italy", "Italy", "🇮🇹"],
      ]),
      choice("I like music.", "music", [
        ["reading", "Reading", "📖"],
        ["coffee", "Coffee", "☕"],
        ["music", "Music", "🎵"],
      ]),
      choice("I like reading.", "reading", [
        ["music", "Music", "🎵"],
        ["reading", "Reading", "📖"],
        ["tea", "Tea", "🍵"],
      ]),
    ],
  ),
];

// Parallel review tasks are selected by review history, separate from teaching tasks.
export function reviewLesson(base: Lesson, repetition: number): Lesson {
  const copy = structuredClone(base),
    n = Math.max(1, repetition),
    id = `${base.id}-review-${n}`;
  if (base.scene === "cafe")
    copy.transfer = cafe(
      id,
      ["water", "tea", "coffee"][n % 3],
      n % 2 ? "large" : "small",
      n % 2 ? "for_here" : "to_go",
      true,
    );
  else if (base.scene === "shop")
    copy.transfer = shop(
      id,
      ["book", "apple", "bag", "bread"][n % 4],
      ["three", "one", "two"][n % 3],
    );
  else if (base.scene === "directions")
    copy.transfer = route(
      id,
      ["museum", "park", "station", "cafe"][n % 4],
      ["straight", "right", "left"][n % 3],
      n % 2 ? "slow" : "repeat",
    );
  else if (base.scene === "friends")
    copy.transfer = friend(
      id,
      ["lee", "mia", "sam", "alex"][n % 4],
      ["canada", "china", "italy"][n % 3],
      ["reading", "music", "coffee"][n % 3],
    );
  else {
    copy.transfer = structuredClone(n % 2 ? base.task : base.transfer);
    copy.transfer.id = id;
  }
  return copy;
}
