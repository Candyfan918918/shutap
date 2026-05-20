// Shutap Relationship Scan question bank.
// ~26 questions across 7 categories. Localized for en + zh (other locales
// fall back to en automatically via the i18n resolver in question-engine.ts).
import type { Question } from "./types";

export const QUESTION_BANK: Question[] = [
  // ============================== FOUNDATION ==============================
  {
    id: "years_together",
    category: "foundation",
    type: "single",
    maxScore: 20,
    base: {
      title: "How long have you been together?",
      subtitle: "Time is the silent main character.",
      options: [
        { id: "lt1", label: "Less than a year", score: 5 },
        { id: "1to3", label: "1–3 years", score: 8 },
        { id: "4to7", label: "4–7 years", score: 12 },
        { id: "8to15", label: "8–15 years", score: 16 },
        { id: "gt15", label: "15+ years", score: 20 },
      ],
    },
    i18n: {
      zh: {
        title: "你们在一起多久了？",
        subtitle: "时间是这部剧的隐形主角。",
        options: [
          { id: "lt1", label: "不到一年", score: 5 },
          { id: "1to3", label: "1–3 年", score: 8 },
          { id: "4to7", label: "4–7 年", score: 12 },
          { id: "8to15", label: "8–15 年", score: 16 },
          { id: "gt15", label: "15 年以上", score: 20 },
        ],
      },
    },
  },
  {
    id: "marriage_status",
    category: "foundation",
    type: "single",
    maxScore: 0,
    base: {
      title: "Where are you in the marriage timeline?",
      options: [
        { id: "dating", label: "Dating — but it feels marriage-coded" },
        { id: "engaged", label: "Engaged", tag: "engaged" },
        { id: "married", label: "Married", tag: "married" },
        { id: "separated", label: "Separated", tag: "separated", score: 30 },
        { id: "divorced", label: "Divorced", tag: "divorced", score: 40 },
        { id: "remarried", label: "Remarried", tag: "remarried", score: 20 },
      ],
    },
    i18n: {
      zh: {
        title: "你目前在婚姻时间线的哪里？",
        options: [
          { id: "dating", label: "恋爱中——但已经很像婚姻" },
          { id: "engaged", label: "订婚了", tag: "engaged" },
          { id: "married", label: "已婚", tag: "married" },
          { id: "separated", label: "分居中", tag: "separated", score: 30 },
          { id: "divorced", label: "离婚了", tag: "divorced", score: 40 },
          { id: "remarried", label: "再婚了", tag: "remarried", score: 20 },
        ],
      },
    },
  },
  {
    id: "has_kids",
    category: "foundation",
    type: "single",
    maxScore: 0,
    base: {
      title: "Are kids part of the story?",
      options: [
        { id: "no", label: "No kids" },
        { id: "yes_young", label: "Yes — young", tag: "kids" },
        { id: "yes_teen", label: "Yes — teens", tag: "kids" },
        { id: "yes_adult", label: "Yes — adults", tag: "kids" },
        { id: "stepkids", label: "Stepkids in the mix", tag: "stepkids", score: 20 },
      ],
    },
    i18n: {
      zh: {
        title: "故事里有孩子吗？",
        options: [
          { id: "no", label: "没有孩子" },
          { id: "yes_young", label: "有——还小", tag: "kids" },
          { id: "yes_teen", label: "有——青春期", tag: "kids" },
          { id: "yes_adult", label: "有——成年了", tag: "kids" },
          { id: "stepkids", label: "继子女在场", tag: "stepkids", score: 20 },
        ],
      },
    },
  },

  // ============================== PLOT TWISTS ==============================
  {
    id: "cheating",
    category: "plot_twists",
    type: "single",
    maxScore: 80,
    base: {
      title: "Was there ever cheating?",
      subtitle: "Be honest. We don't judge here.",
      options: [
        { id: "never", label: "Never (that I know of)", score: 0 },
        { id: "emotional", label: "Emotional affair", score: 35, tag: "emotional-affair" },
        { id: "physical", label: "Physical cheating", score: 60, tag: "cheating" },
        { id: "both", label: "Both. It was a season.", score: 80, tag: "cheating" },
        { id: "suspected", label: "Suspected. Never confirmed.", score: 30, tag: "suspicion" },
      ],
    },
    i18n: {
      zh: {
        title: "有出过轨吗？",
        subtitle: "诚实点，我们不评判。",
        options: [
          { id: "never", label: "从来没有（我所知道的）", score: 0 },
          { id: "emotional", label: "精神出轨", score: 35, tag: "emotional-affair" },
          { id: "physical", label: "身体出轨", score: 60, tag: "cheating" },
          { id: "both", label: "都有，那是完整一季", score: 80, tag: "cheating" },
          { id: "suspected", label: "怀疑过，没确认", score: 30, tag: "suspicion" },
        ],
      },
    },
  },
  {
    id: "secret_phone",
    category: "plot_twists",
    type: "single",
    maxScore: 40,
    conditional: { hideIf: { q: "cheating", eq: "never" } },
    base: {
      title: "Was a secret phone or hidden account involved?",
      options: [
        { id: "no", label: "No", score: 0 },
        { id: "phone", label: "Secret phone", score: 30, tag: "secret-phone" },
        { id: "accounts", label: "Hidden accounts / messages", score: 25, tag: "hidden-account" },
        { id: "both", label: "Both. A whole double life.", score: 40, tag: "double-life" },
      ],
    },
    i18n: {
      zh: {
        title: "有出现过秘密手机或隐藏账号吗？",
        options: [
          { id: "no", label: "没有", score: 0 },
          { id: "phone", label: "有秘密手机", score: 30, tag: "secret-phone" },
          { id: "accounts", label: "隐藏账号 / 消息", score: 25, tag: "hidden-account" },
          { id: "both", label: "都有，完整的双面人生", score: 40, tag: "double-life" },
        ],
      },
    },
  },
  {
    id: "divorce_threats",
    category: "plot_twists",
    type: "emoji_scale",
    maxScore: 40,
    weight: 40,
    base: {
      title: "How often has the D-word been thrown around?",
      subtitle: "From 'never' to 'lawyer on speed dial'.",
      minLabel: "Never",
      maxLabel: "Constantly",
    },
    i18n: {
      zh: {
        title: "&ldquo;离婚&rdquo;这两个字出现过几次？",
        subtitle: "从『从没』到『律师在快捷拨号』。",
        minLabel: "从没",
        maxLabel: "天天讲",
      },
    },
  },
  {
    id: "ghosting_moment",
    category: "plot_twists",
    type: "single",
    maxScore: 40,
    base: {
      title: "Has anyone disappeared for days without a word?",
      options: [
        { id: "never", label: "Never", score: 0 },
        { id: "once", label: "Once. It was tense.", score: 15 },
        { id: "few", label: "A few times", score: 25, tag: "ghosting" },
        { id: "many", label: "Multiple disappearing acts", score: 40, tag: "ghosting" },
      ],
    },
    i18n: {
      zh: {
        title: "有人玩过『消失几天音讯全无』吗？",
        options: [
          { id: "never", label: "没有", score: 0 },
          { id: "once", label: "一次，挺紧绷的", score: 15 },
          { id: "few", label: "好几次", score: 25, tag: "ghosting" },
          { id: "many", label: "经常上演消失术", score: 40, tag: "ghosting" },
        ],
      },
    },
  },

  // ============================== EMOTIONAL ==============================
  {
    id: "crying_frequency",
    category: "emotional",
    type: "emoji_scale",
    maxScore: 50,
    weight: 50,
    base: {
      title: "How often do you cry about the relationship?",
      minLabel: "Almost never",
      maxLabel: "Weekly",
    },
    i18n: {
      zh: {
        title: "因为这段关系哭的频率？",
        minLabel: "几乎没有",
        maxLabel: "每周都哭",
      },
    },
  },
  {
    id: "emotional_safety",
    category: "emotional",
    type: "emoji_scale",
    maxScore: 60,
    // High UNSAFETY = high score. We invert at scoring time.
    weight: -60,
    base: {
      title: "How emotionally safe do you feel?",
      minLabel: "Not at all",
      maxLabel: "Completely",
    },
    i18n: {
      zh: {
        title: "你在这段关系里有多少情绪安全感？",
        minLabel: "完全没有",
        maxLabel: "非常安全",
      },
    },
  },
  {
    id: "loneliness",
    category: "emotional",
    type: "emoji_scale",
    maxScore: 50,
    weight: 50,
    base: {
      title: "Do you feel lonely even when you're together?",
      minLabel: "Never",
      maxLabel: "All the time",
    },
    i18n: {
      zh: {
        title: "你们在一起时你会感到孤独吗？",
        minLabel: "从不",
        maxLabel: "经常如此",
      },
    },
  },
  {
    id: "trust_level",
    category: "emotional",
    type: "emoji_scale",
    maxScore: 40,
    weight: -40,
    base: {
      title: "How much do you trust them, deep down?",
      minLabel: "Not at all",
      maxLabel: "With my life",
    },
    i18n: {
      zh: {
        title: "你内心深处有多信任TA？",
        minLabel: "完全不信",
        maxLabel: "全心信任",
      },
    },
  },
  {
    id: "healing_question",
    category: "emotional",
    type: "single",
    maxScore: 20,
    // Only show after a high emotional damage signal — engine injects this.
    conditional: { showIf: { any: [{ q: "crying_frequency", gt: 60 }, { q: "loneliness", gt: 60 }] } },
    base: {
      title: "Have you done any healing work around this?",
      subtitle: "We're rooting for you, btw.",
      options: [
        { id: "therapy", label: "Therapy — solo or couples", score: -10, tag: "healing" },
        { id: "journaling", label: "Journaling / reading", score: -5, tag: "healing" },
        { id: "trying", label: "Trying, slowly", score: 5 },
        { id: "no", label: "Not yet", score: 20 },
      ],
    },
    i18n: {
      zh: {
        title: "你为这件事做过疗愈吗？",
        subtitle: "顺带一提，我们站你。",
        options: [
          { id: "therapy", label: "做过咨询——个人或伴侣", score: -10, tag: "healing" },
          { id: "journaling", label: "写日记 / 看书", score: -5, tag: "healing" },
          { id: "trying", label: "慢慢在尝试", score: 5 },
          { id: "no", label: "还没有", score: 20 },
        ],
      },
    },
  },

  // ============================ COMMUNICATION ============================
  {
    id: "conflict_style",
    category: "communication",
    type: "single",
    maxScore: 50,
    base: {
      title: "Your usual conflict style is…",
      options: [
        { id: "talk", label: "We talk it out", score: 0 },
        { id: "yell", label: "Loud — voices raised", score: 30, tag: "yelling" },
        { id: "silent", label: "Silent treatment for days", score: 40, tag: "silent-treatment" },
        { id: "avoid", label: "Avoid forever, hope it dies", score: 35, tag: "avoidance" },
        { id: "mixed", label: "All of the above, depending on day", score: 25 },
      ],
    },
    i18n: {
      zh: {
        title: "你们的冲突方式通常是？",
        options: [
          { id: "talk", label: "好好谈", score: 0 },
          { id: "yell", label: "大声吵架", score: 30, tag: "yelling" },
          { id: "silent", label: "冷战好几天", score: 40, tag: "silent-treatment" },
          { id: "avoid", label: "永远回避，等它自己消失", score: 35, tag: "avoidance" },
          { id: "mixed", label: "看情况，啥都来过", score: 25 },
        ],
      },
    },
  },
  {
    id: "resolution",
    category: "communication",
    type: "emoji_scale",
    maxScore: 50,
    weight: -50,
    base: {
      title: "When you fight, how well do you actually resolve it?",
      minLabel: "We don't",
      maxLabel: "Cleanly, every time",
    },
    i18n: {
      zh: {
        title: "吵完架后能真正解决问题吗？",
        minLabel: "完全不能",
        maxLabel: "每次都能干净解决",
      },
    },
  },
  {
    id: "read_receipts",
    category: "communication",
    type: "single",
    maxScore: 30,
    base: {
      title: "Read receipts in your relationship are…",
      options: [
        { id: "normal", label: "Normal, no weapon", score: 0 },
        { id: "weapon", label: "100% a weapon of war", score: 30, tag: "read-receipts" },
        { id: "anxious", label: "A daily anxiety trigger", score: 20, tag: "anxious-attachment" },
        { id: "off", label: "We turned them off", score: 5 },
      ],
    },
    i18n: {
      zh: {
        title: "&ldquo;已读不回&rdquo;在你们这里是…",
        options: [
          { id: "normal", label: "正常，不是武器", score: 0 },
          { id: "weapon", label: "100% 战略武器", score: 30, tag: "read-receipts" },
          { id: "anxious", label: "每天的焦虑触发器", score: 20, tag: "anxious-attachment" },
          { id: "off", label: "我们关掉了", score: 5 },
        ],
      },
    },
  },

  // ============================== FINANCIAL ==============================
  {
    id: "money_fights",
    category: "financial",
    type: "emoji_scale",
    maxScore: 60,
    weight: 60,
    base: {
      title: "How often do you fight about money?",
      minLabel: "Never",
      maxLabel: "Weekly",
    },
    i18n: {
      zh: {
        title: "你们多久会为钱吵一次？",
        minLabel: "从不",
        maxLabel: "每周都吵",
      },
    },
  },
  {
    id: "hidden_debt",
    category: "financial",
    type: "single",
    maxScore: 60,
    base: {
      title: "Has hidden debt or secret spending ever come up?",
      options: [
        { id: "no", label: "No", score: 0 },
        { id: "small", label: "Small surprise", score: 15, tag: "secret-spending" },
        { id: "big", label: "Big surprise — wallet still recovering", score: 50, tag: "hidden-debt" },
        { id: "ongoing", label: "Ongoing pattern", score: 60, tag: "financial-betrayal" },
      ],
    },
    i18n: {
      zh: {
        title: "有出现过隐藏债务或秘密消费吗？",
        options: [
          { id: "no", label: "没有", score: 0 },
          { id: "small", label: "小意外", score: 15, tag: "secret-spending" },
          { id: "big", label: "大意外——钱包至今没缓过来", score: 50, tag: "hidden-debt" },
          { id: "ongoing", label: "长期模式", score: 60, tag: "financial-betrayal" },
        ],
      },
    },
  },
  {
    id: "joint_finances",
    category: "financial",
    type: "single",
    maxScore: 30,
    base: {
      title: "How are your finances structured?",
      options: [
        { id: "fully_joint", label: "Fully joint", score: 0 },
        { id: "mostly_joint", label: "Mostly joint, some personal", score: 5 },
        { id: "separate", label: "Mostly separate", score: 15 },
        { id: "secretive", label: "Separate AND secretive", score: 30, tag: "financial-distrust" },
      ],
    },
    i18n: {
      zh: {
        title: "你们的财务怎么安排？",
        options: [
          { id: "fully_joint", label: "完全共同账户", score: 0 },
          { id: "mostly_joint", label: "主要共同，少量个人", score: 5 },
          { id: "separate", label: "基本分开", score: 15 },
          { id: "secretive", label: "分开 + 互相隐藏", score: 30, tag: "financial-distrust" },
        ],
      },
    },
  },

  // ============================== FAMILY ==============================
  {
    id: "in_laws",
    category: "family",
    type: "emoji_scale",
    maxScore: 70,
    weight: 70,
    base: {
      title: "How much do the in-laws affect your marriage?",
      subtitle: "0 = invisible, 100 = mother-in-law has opinions in your DMs.",
      minLabel: "Invisible",
      maxLabel: "In your DMs",
    },
    i18n: {
      zh: {
        title: "公婆 / 岳父母对你的婚姻影响多大？",
        subtitle: "0 = 几乎隐形，100 = 婆婆已经在你的 DM 里发表意见了。",
        minLabel: "隐形",
        maxLabel: "天天评论",
      },
    },
  },
  {
    id: "family_interference",
    category: "family",
    type: "multi",
    maxScore: 60,
    base: {
      title: "Which relatives have inserted themselves? (pick all)",
      options: [
        { id: "mil", label: "👵 Mother-in-law", score: 25, tag: "in-laws" },
        { id: "fil", label: "👴 Father-in-law", score: 15, tag: "in-laws" },
        { id: "siblings", label: "🧑‍🤝‍🧑 Siblings", score: 15, tag: "siblings" },
        { id: "exes", label: "💔 Exes", score: 25, tag: "ex-drama" },
        { id: "cousins", label: "🎭 Random cousins", score: 10 },
        { id: "none", label: "Nobody. Bliss.", score: -10 },
      ],
    },
    i18n: {
      zh: {
        title: "哪些亲戚强行加入了你们的剧情？（多选）",
        options: [
          { id: "mil", label: "👵 婆婆 / 岳母", score: 25, tag: "in-laws" },
          { id: "fil", label: "👴 公公 / 岳父", score: 15, tag: "in-laws" },
          { id: "siblings", label: "🧑‍🤝‍🧑 兄弟姐妹", score: 15, tag: "siblings" },
          { id: "exes", label: "💔 前任们", score: 25, tag: "ex-drama" },
          { id: "cousins", label: "🎭 不知道哪冒出来的表亲", score: 10 },
          { id: "none", label: "没有，宁静", score: -10 },
        ],
      },
    },
  },
  {
    id: "parenting_conflict",
    category: "family",
    type: "emoji_scale",
    maxScore: 50,
    weight: 50,
    conditional: { showIf: { q: "has_kids", in: ["yes_young", "yes_teen", "yes_adult", "stepkids"] } },
    base: {
      title: "How much do you fight about parenting?",
      minLabel: "Never",
      maxLabel: "Daily",
    },
    i18n: {
      zh: {
        title: "你们多久为育儿问题吵一次？",
        minLabel: "从不",
        maxLabel: "天天",
      },
    },
  },

  // ============================== LOVE BONUS ==============================
  {
    id: "affection",
    category: "love_bonus",
    type: "emoji_scale",
    maxScore: 60,
    weight: -60,
    base: {
      title: "How much affection is in daily life?",
      subtitle: "Hugs, kisses, hand-holds, soft texts.",
      minLabel: "Almost none",
      maxLabel: "Constant",
    },
    i18n: {
      zh: {
        title: "你们日常中的亲密举动有多少？",
        subtitle: "拥抱、亲吻、牵手、暖心信息。",
        minLabel: "几乎没有",
        maxLabel: "源源不断",
      },
    },
  },
  {
    id: "humor",
    category: "love_bonus",
    type: "emoji_scale",
    maxScore: 50,
    weight: -50,
    base: {
      title: "Do you still laugh together?",
      minLabel: "Never",
      maxLabel: "All the time",
    },
    i18n: {
      zh: {
        title: "你们还一起笑吗？",
        minLabel: "几乎不",
        maxLabel: "经常笑",
      },
    },
  },
  {
    id: "kindness",
    category: "love_bonus",
    type: "emoji_scale",
    maxScore: 50,
    weight: -50,
    base: {
      title: "How kind are they to you on a normal day?",
      minLabel: "Not very",
      maxLabel: "Extremely",
    },
    i18n: {
      zh: {
        title: "在普通日子里TA对你有多温柔？",
        minLabel: "不太",
        maxLabel: "非常温柔",
      },
    },
  },
  {
    id: "would_choose_again",
    category: "love_bonus",
    type: "single",
    maxScore: 40,
    base: {
      title: "Would you choose them again, knowing everything?",
      options: [
        { id: "yes", label: "Yes, in a heartbeat 💖", score: -40, tag: "still-romantic" },
        { id: "probably", label: "Probably, yeah", score: -25 },
        { id: "idk", label: "I genuinely don't know", score: 10 },
        { id: "no", label: "No.", score: 30 },
      ],
    },
    i18n: {
      zh: {
        title: "如果现在重新选一次，你还会选TA吗？",
        options: [
          { id: "yes", label: "会，毫不犹豫 💖", score: -40, tag: "still-romantic" },
          { id: "probably", label: "应该会", score: -25 },
          { id: "idk", label: "真的不知道", score: 10 },
          { id: "no", label: "不会", score: 30 },
        ],
      },
    },
  },

  // ============================== OPEN TEXT (not scored) ==============================
  {
    id: "biggest_plot_twist",
    category: "plot_twists",
    type: "text",
    maxScore: 0,
    base: {
      title: "Biggest plot twist in your marriage so far?",
      subtitle: "One line. Anonymous. Optional.",
      helper: "Up to 240 characters.",
    },
    i18n: {
      zh: {
        title: "你婚姻里最大的反转是什么？",
        subtitle: "一句话。匿名。可选。",
        helper: "最多 240 字。",
      },
    },
  },
];

export function getQuestion(id: string): Question | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
