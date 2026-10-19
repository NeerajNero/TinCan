/**
 * In-app help: one short sheet per game, together activity and slow feature.
 * Shown once automatically the first time a screen opens on a device, then
 * only from the ? button. `label` is the one-line sub-label on Play tiles.
 * Write for two friends in different places: short lines, each starting with
 * an emoji, no jargon.
 */
export type HowToKey =
  | "tictactoe"
  | "connectfour"
  | "chess"
  | "checkers"
  | "pictionary"
  | "trivia"
  | "quiz"
  | "word"
  | "twenty"
  | "wyr"
  | "nhie"
  | "tod"
  | "convo"
  | "wheel"
  | "whiteboard"
  | "pixel"
  | "watch"
  | "listen"
  | "radio"
  | "timer"
  | "cook"
  | "pet"
  | "plant"
  | "garden"
  | "jar"
  | "capsules"
  | "envelopes"
  | "daily"
  | "calls";

export interface HowTo {
  title: string;
  /** One line for tiles and lists. */
  label: string;
  /** 3–4 lines, each starting with an emoji. */
  steps: string[];
  tip?: string;
}

export const HOWTO: Record<HowToKey, HowTo> = {
  tictactoe: {
    title: "Tic-tac-toe",
    label: "Three in a row · quick one",
    steps: ["📨 Tap the tile — a Join card lands in chat and they get a push", "❌ Whoever invites plays X and goes first", "🔁 Take turns; you'll get a ping when it's yours", "🏁 Three in a row wins — Rematch swaps who goes first"],
    tip: "You don't both need to be online — play a move whenever you're free.",
  },
  connectfour: {
    title: "Connect Four",
    label: "Drop discs · four in a row",
    steps: ["📨 Invite from the tile; Join in chat accepts for them", "⬇️ Tap a column to drop your disc to the lowest free spot", "🔴 Four in a row wins — across, up or diagonal", "🔁 A full board is a draw; Rematch lets the other one start"],
  },
  chess: {
    title: "Chess",
    label: "The long game · play over days",
    steps: ["📨 Invite from the tile — the inviter plays white", "👆 Tap a piece, then tap where it goes", "👑 A pawn on the last row picks its promotion", "🏳️ Resign or cancel from the ✕ menu in the header"],
    tip: "A game can run for days; it ends on its own after a week with no moves.",
  },
  checkers: {
    title: "Checkers",
    label: "Jump and crown",
    steps: ["📨 Invite from the tile — the inviter moves first", "↗️ Pieces move diagonally forward one square", "🦘 If you can jump, you must — chains of jumps are one move", "👑 Reach the far row to crown a king that moves both ways"],
    tip: "80 moves without a capture or crowning ends in a draw.",
  },
  pictionary: {
    title: "Pictionary",
    label: "Draw & guess · 3 rounds",
    steps: ["✏️ One of you draws, the other guesses", "🎯 The drawer picks one of three secret words", "⏱️ 60 seconds per word, 3 rounds, you swap each round", "💬 Type guesses — spaces and caps don't matter"],
    tip: "Faster guesses score more. Inviting drops a Join card in chat and a toast.",
  },
  trivia: {
    title: "Trivia duel",
    label: "10 questions · 15 s each",
    steps: ["🧠 Ten questions from the same shuffled set for both of you", "⚡ Live: open the round on both phones — it starts when you're both in", "⏱️ 15 seconds each; the answer and a one-line fact stay up after each", "🏆 Scores compare once you've both finished"],
    tip: "Live not starting? “Play async instead” switches the round — nobody loses it.",
  },
  quiz: {
    title: "Know-me quiz",
    label: "How well do they know you?",
    steps: ["✍️ Write at least 5 questions about yourself", "✅ Give the right answer plus three convincing decoys", "📬 Publish it — a Join card lands in chat and they get a push", "🎉 See their score and what they picked for each one"],
    tip: "The best decoys are things that almost sound like you.",
  },
  word: {
    title: "Daily word",
    label: "Same word for both · 6 tries",
    steps: ["🔤 One five-letter word a day, the same for both of you", "🟩 Green: right letter, right spot · 🟨 yellow: wrong spot", "6️⃣ Six guesses on your own — no peeking (Invite nudges them to play)", "🏆 Both finished? Fewer guesses wins · tap “What does it mean?”"],
    tip: "A new word arrives at midnight on your shared calendar.",
  },
  twenty: {
    title: "20 Questions",
    label: "Guess the secret · yes / no",
    steps: ["🤫 One of you picks a secret thing (or a random one)", "❓ The other asks yes-or-no questions, one at a time", "🙂 Answer Yes, No or Sort of — up to 20 questions", "🎯 Make a final guess any time; the secret is revealed after"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  wyr: {
    title: "Would you rather",
    label: "Pick one · see if you agree",
    steps: ["🃏 You both see the same card", "👈 Pick a side — theirs stays hidden until you've both chosen", "🤝 The tally counts how often you agree", "➡️ Either of you can flip to the next card"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  nhie: {
    title: "Never have I ever",
    label: "Confess · keep score",
    steps: ["🃏 Same card on both phones", "🙋 Tap “I have” or “I haven't” — answers reveal together", "🔢 Every “I have” scores a point on the tally", "➡️ Either of you flips to the next one; Invite calls them in"],
    tip: "Ask the story behind it in chat.",
  },
  tod: {
    title: "Truth or dare",
    label: "Spin · take turns",
    steps: ["🎲 On your turn, spin — it lands on truth or dare", "🗣️ Answer the truth, or do the dare on a call or in chat", "🔁 Then it's your friend's turn to spin", "⏭️ Not feeling one? Flip to the next card"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  convo: {
    title: "Conversation cards",
    label: "Big and small questions",
    steps: ["🃏 One shared card with a question for you both", "🗣️ Answer it on a call, in chat or with a voice note", "➡️ Either of you flips to the next card", "🔄 Reset the deck from the bottom to reshuffle"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  wheel: {
    title: "Hangout wheel",
    label: "Spin for something to do",
    steps: ["🎡 Spin the wheel of things to do together, apart", "💬 The result is posted to chat with a “Let's!”", "🔁 Not this one? Spin again"],
  },
  whiteboard: {
    title: "Whiteboard",
    label: "Draw on one canvas",
    steps: ["🖍️ Draw with your finger — your friend sees each stroke live", "🎨 Pick a colour and width, or switch to the eraser", "👆 Their dot shows where they're drawing", "📸 Snapshot sends the board to chat; Clear wipes it for both"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  pixel: {
    title: "Pixel art",
    label: "32×32 · sixteen colours",
    steps: ["🟪 One shared 32×32 grid", "🎨 Pick a colour and tap or drag to paint", "👆 You'll see your friend's cursor while they paint", "📸 Snapshot sends the picture to chat"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  watch: {
    title: "Watch together",
    label: "YouTube in sync",
    steps: ["🔗 Paste a YouTube link, or tap Invite to pull your friend in", "▶️ Play, pause and seek on both phones; if you drift, it catches up", "⭐ Tap ★ by the title to keep a video in your shared playlist", "💬 The chat button opens a Watch-only chat, apart from your main chat"],
    tip: "Start it on a call so you can laugh at the same moment.",
  },
  listen: {
    title: "Listen together",
    label: "Music in sync · shared queue",
    steps: ["🔗 Add YouTube songs to the queue; Invite brings your friend in", "🎧 Play and pause together — audio only, no video", "⭐ Tap ★ to keep a song in your playlist, then queue it any time", "💬 The chat button opens a Listen-only chat, apart from your main chat"],
  },
  radio: {
    title: "Radio",
    label: "Live stations · India and World",
    steps: ["📻 Pick a station: All India Radio under India, more under World", "▶️ Play and pause together", "🎶 It's live, so you both hear the same song at the same time", "🔁 Your last station waits in the top card for one-tap replay"],
    tip: "Invite in the header drops a Join card in chat and a toast on their phone.",
  },
  timer: {
    title: "Focus timer",
    label: "Pomodoro · 25 / 5",
    steps: ["⏳ One shared timer: 25 minutes focus, then a 5-minute break", "▶️ Either of you can start, pause or reset it; Invite calls them in", "🔔 A chime marks the end of each phase", "🌱 Finished focus sessions are counted for the day"],
    tip: "Say what you're each working on before you start.",
  },
  cook: {
    title: "Cook-along",
    label: "Same recipe · steps tick live",
    steps: ["📖 Pick a recipe, or add one — either of you can", "✅ Tick steps off as you go; they tick on both phones", "📞 Best on a call while you both cook", "🔄 Reset to start the recipe over"],
    tip: "“Start cooking together” sends an invite: a Join card in chat and a toast.",
  },
  pet: {
    title: "Your pet",
    label: "Look after it together",
    steps: ["🍪 Feed it and 🎾 play with it — either of you can; both drain over a day", "👆 Tap it for a reaction, hold to pet it (that cheers it up too)", "😴 Tuck it in and it sleeps for 8 hours", "⭐ It levels up every 7 days of your shared streak"],
    tip: "You'll both get a ping when it's about to get hungry.",
  },
  plant: {
    title: "Your plant",
    label: "Grows with your streak",
    steps: ["🔥 Your streak counts days you both opened Tincan", "🌱 Every 3 days of streak, the plant grows a stage (10 in all)", "🥀 Miss a day and it droops — it never shrinks, and perks up next time"],
  },
  garden: {
    title: "Garden",
    label: "Stickers for things you did together",
    steps: ["🌼 Doing things together unlocks stickers — 24 to find", "🎨 First drawing, a finished trivia round, 100 messages…", "🔒 Locked ones show a hint of how to get them"],
  },
  jar: {
    title: "Jar",
    label: "Little notes to draw later",
    steps: ["✍️ Drop short notes into your friend's jar", "🫙 They draw one at random whenever they like", "📜 Drawn notes move to the drawn list"],
    tip: "Write a few at once so there's always one waiting.",
  },
  capsules: {
    title: "Time capsules",
    label: "Sealed until a date",
    steps: ["✍️ Write something, add photos, pick an unlock date", "🔒 Your friend can't read it until then — not even a peek", "🔔 You both get a ping when it opens", "🗑️ You can delete it while it's still locked"],
  },
  envelopes: {
    title: "Open-when envelopes",
    label: "For the right moment",
    steps: ["💌 Write a letter for a moment — “sad”, “bored”, “miss me”…", "🔒 It stays sealed until your friend taps Open", "📬 Opening is one-way, and you get a ping when they do"],
  },
  daily: {
    title: "Daily question",
    label: "One question a day, for both",
    steps: ["💭 The same question for both of you each day", "✍️ Answer it to see your friend's answer", "🔔 You'll get a ping when they answer", "📚 Past questions and answers live in Memories"],
  },
  calls: {
    title: "Call-time finder",
    label: "When you're both free",
    steps: ["🗓️ Paint your free half-hours each week, in your own time", "🌍 Overlaps show in both your time zones", "📞 Tap Propose to send a slot to chat"],
    tip: "Set it once — it repeats every week.",
  },
};
