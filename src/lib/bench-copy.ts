// The Bench voice — canonical system copy.
// Dry, declarative, occasionally savage, never cruel. No "Loading...", no
// exclamation marks, no "Welcome to", no generic "Error". Reach for these
// strings before writing any new system copy.

export const BENCH = {
  loading: {
    feed: "The stream is preparing.",
    story: "The case is being prepared.",
    vote: "Your verdict is being recorded.",
    spillAi: "The Bench is considering your answers.",
    polish: "Polishing your case. Facts intact.",
    courtDeliberating: "The jury is deliberating. Probably arguing.",
    generic: "The court is in session.",
    profile: "The record is being pulled.",
    analytics: "The numbers are being tallied.",
    list: "The docket is being read.",
  },
  empty: {
    feed: "The feed is quiet. Someone has to go first.",
    court: "No cases before the court today. That won't last.",
    comments: "No one has spoken yet. The floor is open.",
    bookmarks: "Nothing saved. Nothing worth returning to yet.",
    hof: "The Hall of Fame is empty. Standards are high here.",
    search: "Nothing matches. The court has no record of this.",
    followers: "No followers yet. Build a reputation first.",
    predictions: "No predictions made. Place yours before it's too late.",
    posts: "No cases filed. The Bench is waiting.",
    scans: "No scans on the record yet.",
    badges: "No badges yet. Earn the Bench's attention.",
    friends: "No allies yet. The bench is solitary by default.",
    blocked: "No one blocked. The peace holds.",
    saves: "Nothing saved. Nothing worth returning to yet.",
  },
  confirm: {
    voteCast: "Your verdict has been recorded.",
    storyPublished: "The Bench has received your case.",
    bookmarkSaved: "Saved for later judgment.",
    storyRetracted: "Case withdrawn. The court has no record of it.",
    sequelPosted: "The case continues. The jury has been notified.",
    predictionLogged: "Prediction logged. The Bench will remember.",
    outcomeLogged: "The record has been updated. The court thanks you.",
    feltThis: "Felt this. The Bench took note.",
    linkCopied: "Link copied. Carry it as you will.",
    accountReady: (alias: string) =>
      `You are: ${alias}. The court is in session.`,
  },
  error: {
    network: "The connection faltered. Try again when ready.",
    auth: "The court could not verify your identity.",
    underage: "Shutap is for adults 18 and older. Come back when you're ready.",
    generic: "Something went wrong. The Bench is displeased.",
    notFound:
      "This case doesn't exist. Or it was retracted. The Bench is saying nothing.",
    pageDidNotLoad: "This page did not load. The Bench is displeased.",
    benchHoarse: "The Bench is hoarse. Ask again.",
    voteNotRecorded: "Your verdict did not land. Try again.",
    actionNotRecorded: "The court did not record that. Try again.",
    predictionNotRecorded: "Prediction did not land. Try again.",
    outcomeNotRecorded: "Outcome did not land. Try again.",
  },
  trust: {
    landing: "Zero real names exposed.",
    footer:
      "Your alias is yours. Your real name never leaves our servers.",
  },
  actions: {
    tryAgain: "Try again",
    reconvene: "Reconvene",
    goHome: "Return to the stream",
  },
} as const;

export type BenchCopy = typeof BENCH;
