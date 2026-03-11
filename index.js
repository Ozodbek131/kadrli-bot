require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Bot, session, InlineKeyboard, Keyboard } = require("grammy");

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN .env ichida topilmadi");
}
const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("KadrLi bot ishlayapti");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("HTTP server portda ishlayapti:", PORT);
});

const bot = new Bot(token);

const ADMIN_USERNAME = "UzbRO_007";
const ADMIN_LINK = `https://t.me/${ADMIN_USERNAME}`;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHANNEL_LINK = process.env.CHANNEL_LINK || "https://t.me/kadrli_uz";
const CHANNEL_USERNAME = (process.env.CHANNEL_USERNAME || "kadrli_uz").replace("@", "");
const ADMIN_ID = String(process.env.ADMIN_ID || "");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

// ====== Faylga saqlash ======
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      postCounter: 1,
      stats: {
        freelancerSubmitted: 0,
        jobSubmitted: 0,
        freelancerApproved: 0,
        jobApproved: 0,
        freelancerRejected: 0,
        jobRejected: 0,
      },
      pendingPosts: [],
      approvedPosts: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function loadStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Store o‘qishda xatolik:", e);
    return {
      postCounter: 1,
      stats: {
        freelancerSubmitted: 0,
        jobSubmitted: 0,
        freelancerApproved: 0,
        jobApproved: 0,
        freelancerRejected: 0,
        jobRejected: 0,
      },
      pendingPosts: [],
      approvedPosts: [],
    };
  }
}

function saveStore() {
  const data = {
    postCounter,
    stats,
    pendingPosts: [...pendingPosts.values()],
    approvedPosts: [...approvedPosts.values()],
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const store = loadStore();

let postCounter = store.postCounter || 1;
const stats = store.stats || {
  freelancerSubmitted: 0,
  jobSubmitted: 0,
  freelancerApproved: 0,
  jobApproved: 0,
  freelancerRejected: 0,
  jobRejected: 0,
};

const pendingPosts = new Map((store.pendingPosts || []).map((p) => [String(p.id), p]));
const approvedPosts = new Map((store.approvedPosts || []).map((p) => [String(p.id), p]));

// ====== Session ======
bot.use(
  session({
    initial: () => ({
      step: null,
      freelancer: {},
      job: {},
      rejectPending: null,
    }),
  })
);

// ====== Helpers ======
function isAdmin(ctx) {
  return String(ctx.from?.id) === ADMIN_ID;
}

function clearSession(ctx) {
  ctx.session.step = null;
  ctx.session.freelancer = {};
  ctx.session.job = {};
}

function postContactKeyboard() {
  return new InlineKeyboard()
    .url("👤 Admin / Aloqa", ADMIN_LINK)
    .url("📢 Kanal", CHANNEL_LINK);
}

function adminContactKeyboard() {
  return new InlineKeyboard()
    .url("👤 Admin bilan bog‘lanish", ADMIN_LINK)
    .url("📨 Telegram profilni ochish", ADMIN_LINK)
    .row()
    .url("📢 Kanalga o‘tish", CHANNEL_LINK);
}

const mainMenu = new Keyboard()
  .text("👨‍💻 Freelancer")
  .text("💼 Ish beruvchi")
  .row()
  .text("👑 Admin")
  .text("📜 Qoidalar")
  .row()
  .text("ℹ️ Yordam")
  .resized();

const adminMenu = new Keyboard()
  .text("📊 Statistika")
  .text("📢 Kanal linki")
  .row()
  .text("👤 Admin profili")
  .text("🏠 Asosiy menyu")
  .resized();

function freelancerCategoryKeyboard() {
  return new InlineKeyboard()
    .text("💻 Web dasturlash", "fcat_web").row()
    .text("🎨 Grafik dizayn", "fcat_design").row()
    .text("📱 SMM", "fcat_smm").row()
    .text("🎬 Video montaj", "fcat_video").row()
    .text("🌐 Tarjima", "fcat_translate").row()
    .text("✍️ Copywriting", "fcat_copy").row()
    .text("📊 Office xizmatlari", "fcat_office").row()
    .text("⌨️ Data entry", "fcat_data");
}

function jobCategoryKeyboard() {
  return new InlineKeyboard()
    .text("💻 Web dasturlash", "jcat_web").row()
    .text("🎨 Grafik dizayn", "jcat_design").row()
    .text("📱 SMM", "jcat_smm").row()
    .text("🎬 Video montaj", "jcat_video").row()
    .text("🌐 Tarjima", "jcat_translate").row()
    .text("✍️ Copywriting", "jcat_copy").row()
    .text("📊 Office xizmatlari", "jcat_office").row()
    .text("⌨️ Data entry", "jcat_data");
}

const freelancerCategories = {
  fcat_web: "💻 Web dasturlash",
  fcat_design: "🎨 Grafik dizayn",
  fcat_smm: "📱 SMM",
  fcat_video: "🎬 Video montaj",
  fcat_translate: "🌐 Tarjima",
  fcat_copy: "✍️ Copywriting",
  fcat_office: "📊 Office xizmatlari",
  fcat_data: "⌨️ Data entry",
};

const jobCategories = {
  jcat_web: "💻 Web dasturlash",
  jcat_design: "🎨 Grafik dizayn",
  jcat_smm: "📱 SMM",
  jcat_video: "🎬 Video montaj",
  jcat_translate: "🌐 Tarjima",
  jcat_copy: "✍️ Copywriting",
  jcat_office: "📊 Office xizmatlari",
  jcat_data: "⌨️ Data entry",
};

function hashtagFromCategory(category) {
  const map = {
    "💻 Web dasturlash": "#web",
    "🎨 Grafik dizayn": "#design",
    "📱 SMM": "#smm",
    "🎬 Video montaj": "#video",
    "🌐 Tarjima": "#tarjima",
    "✍️ Copywriting": "#copywriting",
    "📊 Office xizmatlari": "#office",
    "⌨️ Data entry": "#dataentry",
  };
  return map[category] || "#freelance";
}

function freelancerPost(data) {
  const tag = hashtagFromCategory(data.field);
  return (
    "╔══════════════════╗\n" +
    "     🧑‍💻 <b>FREELANCER</b>\n" +
    "╚══════════════════╝\n\n" +
    `👤 <b>Ism:</b> ${data.name}\n` +
    `💼 <b>Yo‘nalish:</b> ${data.field}\n` +
    `🛠 <b>Xizmatlar:</b> ${data.services}\n` +
    `📁 <b>Portfolio:</b> ${data.portfolio}\n` +
    `💰 <b>Narx:</b> ${data.price}\n` +
    `📍 <b>Tajriba:</b> ${data.experience}\n` +
    `📩 <b>Aloqa:</b> ${data.contact}\n\n` +
    `${tag} #freelancer #kadrli`
  );
}

function jobPost(data) {
  const tag = hashtagFromCategory(data.category);
  return (
    "╔════════════════════╗\n" +
    "      💼 <b>ISH BUYURTMASI</b>\n" +
    "╚════════════════════╝\n\n" +
    `🧩 <b>Yo‘nalish:</b> ${data.category}\n` +
    `📋 <b>Vazifa:</b> ${data.task}\n` +
    `💰 <b>Budjet:</b> ${data.budget}\n` +
    `⏰ <b>Muddat:</b> ${data.deadline}\n` +
    `📍 <b>Daraja:</b> ${data.level}\n` +
    `📩 <b>Aloqa:</b> ${data.contact}\n\n` +
    `${tag} #job #kadrli`
  );
}

function createPendingPost({ type, text, photo = null, userId, userName = "", fullName = "" }) {
  const id = String(postCounter++);
  const record = {
    id,
    type,
    text,
    photo,
    userId,
    userName,
    fullName,
    createdAt: Date.now(),
  };
  pendingPosts.set(id, record);
  saveStore();
  return id;
}

async function sendToAdmin(ctx, type, text, photo = null) {
  const postId = createPendingPost({
    type,
    text,
    photo,
    userId: ctx.from.id,
    userName: ctx.from.username || "",
    fullName: ctx.from.first_name || "",
  });

  const keyboard = new InlineKeyboard()
    .text("✅ Tasdiqlash", `approve_${postId}`)
    .text("❌ Rad etish", `reject_${postId}`);

  const caption =
    `📝 <b>Yangi ${type === "freelancer" ? "freelancer" : "ish"} so‘rovi</b>\n` +
    `🆔 <b>ID:</b> ${postId}\n` +
    `👤 <b>User:</b> ${ctx.from.first_name}${ctx.from.username ? " (@" + ctx.from.username + ")" : ""}\n\n` +
    text;

  if (photo) {
    await bot.api.sendPhoto(ADMIN_ID, photo, {
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    await bot.api.sendMessage(ADMIN_ID, caption, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }

  await ctx.reply("✅ So‘rovingiz adminga yuborildi. Tasdiqlansa kanalga chiqadi.");
}

// ====== Obuna tekshiruvi ======
async function ensureSubscribed(ctx) {
  if (!ctx.from) return true;
  if (isAdmin(ctx)) return true;
  if (!CHANNEL_ID) return true;

  try {
    const member = await bot.api.getChatMember(CHANNEL_ID, ctx.from.id);
    const allowedStatuses = ["creator", "administrator", "member"];
    if (allowedStatuses.includes(member.status)) return true;
  } catch (e) {
    console.error("Obuna tekshirishda xatolik:", e.message);
  }

  const joinKeyboard = new InlineKeyboard()
    .url("📢 Kanalga obuna bo‘lish", CHANNEL_LINK)
    .text("✅ Tekshirish", "check_subscription");

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: "Avval kanalga obuna bo‘ling.",
      show_alert: true,
    });
  } else {
    await ctx.reply(
      "🔒 Botdan foydalanish uchun avval kanalga obuna bo‘ling.\n\nObuna bo‘lgach, «✅ Tekshirish» tugmasini bosing.",
      { reply_markup: joinKeyboard }
    );
  }

  return false;
}

// ====== Global middleware ======
bot.use(async (ctx, next) => {
  if (isAdmin(ctx)) return next();
  if (ctx.chat?.type !== "private") return next();

  const ok = await ensureSubscribed(ctx);
  if (!ok) return;

  return next();
});

// ====== Start ======
bot.command("start", async (ctx) => {
  clearSession(ctx);
  ctx.session.rejectPending = null;

  await ctx.reply(
    "KadrLi botiga xush kelibsiz!\n\nKerakli bo‘limni tanlang:",
    { reply_markup: mainMenu }
  );
});

bot.callbackQuery("check_subscription", async (ctx) => {
  const ok = await ensureSubscribed(ctx);
  if (ok) {
    await ctx.answerCallbackQuery({ text: "Obuna tasdiqlandi!" });
    await ctx.reply("✅ Obuna tasdiqlandi. Endi botdan foydalanishingiz mumkin.", {
      reply_markup: mainMenu,
    });
  }
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Sizning ID: ${ctx.from.id}`);
});

bot.command("cancel", async (ctx) => {
  clearSession(ctx);
  ctx.session.rejectPending = null;
  await ctx.reply("❌ Jarayon bekor qilindi.", { reply_markup: mainMenu });
});

bot.command("skip", async (ctx) => {
  if (ctx.session.step === "freelancer_photo") {
    ctx.session.freelancer.photo = null;
    const post = freelancerPost(ctx.session.freelancer);
    stats.freelancerSubmitted += 1;
    saveStore();
    await sendToAdmin(ctx, "freelancer", post, null);
    clearSession(ctx);
    return;
  }

  if (ctx.session.step === "job_photo") {
    ctx.session.job.photo = null;
    const post = jobPost(ctx.session.job);
    stats.jobSubmitted += 1;
    saveStore();
    await sendToAdmin(ctx, "job", post, null);
    clearSession(ctx);
    return;
  }

  await ctx.reply("Hozir skip qilinadigan bosqich yo‘q.");
});

// ====== Post qidirish ======
bot.hears(/^\/find(?:@\w+)?\s+(\d+)$/, async (ctx) => {
  const postId = ctx.match[1];

  const approved = approvedPosts.get(postId);
  if (approved) {
    return ctx.reply(
      "🔎 Post topildi\n\n" +
        `🆔 Raqam: ${postId}\n` +
        `📂 Turi: ${approved.type === "freelancer" ? "Freelancer" : "Ish"}\n` +
        `📢 Link: ${approved.postLink}`,
      {
        reply_markup: new InlineKeyboard().url("📢 Postni ochish", approved.postLink),
      }
    );
  }

  const pending = pendingPosts.get(postId);
  if (pending) {
    return ctx.reply(
      "🕒 Bu post hali pending holatda.\n\n" +
        `🆔 Raqam: ${postId}\n` +
        `📂 Turi: ${pending.type === "freelancer" ? "Freelancer" : "Ish"}`
    );
  }

  return ctx.reply("❌ Bunday post raqami topilmadi.");
});

// ====== Main menu ======
bot.hears("👨‍💻 Freelancer", async (ctx) => {
  ctx.session.freelancer = {};
  ctx.session.step = "freelancer_name";
  await ctx.reply("👤 Ismingizni yozing:");
});

bot.hears("💼 Ish beruvchi", async (ctx) => {
  ctx.session.job = {};
  ctx.session.step = "job_choose_category";
  await ctx.reply("🧩 Ish yo‘nalishini tanlang:", {
    reply_markup: jobCategoryKeyboard(),
  });
});

bot.hears("📜 Qoidalar", async (ctx) => {
  await ctx.reply(
    "📜 KadrLi qoidalari:\n\n" +
      "1. Fake e'lon yubormang\n" +
      "2. Hurmat bilan muomala qiling\n" +
      "3. Spam qilmang\n" +
      "4. Scam va aldov taqiqlanadi\n" +
      "5. Admin tasdiqlagan postlargina kanalga chiqadi"
  );
});

bot.hears("ℹ️ Yordam", async (ctx) => {
  await ctx.reply(
    "ℹ️ Yordam:\n\n" +
      "👨‍💻 Freelancer — xizmat e'loni yuborish\n" +
      "💼 Ish beruvchi — ish buyurtmasi yuborish\n" +
      "👑 Admin — admin bo‘limi\n" +
      "/skip — rasmni o'tkazib yuborish\n" +
      "/cancel — jarayonni bekor qilish\n" +
      "/myid — Telegram ID ni ko‘rish\n" +
      "/find 12 — post raqami bilan qidirish"
  );
});

// ====== Admin ======
bot.hears("👑 Admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply(
      `👤 Admin: @${ADMIN_USERNAME}\n\nAdmin bilan bog‘lanish uchun tugmani bosing.`,
      {
        reply_markup: adminContactKeyboard(),
      }
    );
  }

  await ctx.reply(
    `👑 Admin panel\n\nXush kelibsiz, @${ADMIN_USERNAME}\nQuyidan kerakli bo‘limni tanlang.`,
    { reply_markup: adminMenu }
  );
});

bot.hears("📊 Statistika", async (ctx) => {
  if (!isAdmin(ctx)) return;

  await ctx.reply(
    "📊 KadrLi statistikasi\n\n" +
      `🧑‍💻 Freelancer yuborilgan: ${stats.freelancerSubmitted}\n` +
      `💼 Ish yuborilgan: ${stats.jobSubmitted}\n\n` +
      `✅ Freelancer tasdiqlangan: ${stats.freelancerApproved}\n` +
      `✅ Ish tasdiqlangan: ${stats.jobApproved}\n\n` +
      `❌ Freelancer rad etilgan: ${stats.freelancerRejected}\n` +
      `❌ Ish rad etilgan: ${stats.jobRejected}\n\n` +
      `🗂 Pending postlar: ${pendingPosts.size}\n` +
      `📚 Approved postlar: ${approvedPosts.size}`
  );
});

bot.hears("📢 Kanal linki", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.reply("📢 KadrLi kanal linki:", {
    reply_markup: new InlineKeyboard().url("Kanalni ochish", CHANNEL_LINK),
  });
});

bot.hears("👤 Admin profili", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.reply(`👤 Admin: @${ADMIN_USERNAME}`, {
    reply_markup: adminContactKeyboard(),
  });
});

bot.hears("🏠 Asosiy menyu", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.reply("🏠 Asosiy menyuga qaytdingiz.", { reply_markup: mainMenu });
});

// ====== Freelancer ism -> kategoriya ======
bot.on("message:text", async (ctx, next) => {
  if (ctx.session.step === "freelancer_name") {
    ctx.session.freelancer.name = ctx.message.text;
    ctx.session.step = "freelancer_choose_category";
    await ctx.reply("💼 Yo‘nalishingizni tanlang:", {
      reply_markup: freelancerCategoryKeyboard(),
    });
    return;
  }

  return next();
});

// ====== Freelancer category callbacks ======
for (const key in freelancerCategories) {
  bot.callbackQuery(key, async (ctx) => {
    ctx.session.freelancer.field = freelancerCategories[key];
    ctx.session.step = "freelancer_services";
    await ctx.answerCallbackQuery();
    await ctx.reply("🛠 Xizmatlaringizni yozing:");
  });
}

// ====== Job category callbacks ======
for (const key in jobCategories) {
  bot.callbackQuery(key, async (ctx) => {
    ctx.session.job.category = jobCategories[key];
    ctx.session.step = "job_task";
    await ctx.answerCallbackQuery();
    await ctx.reply("📋 Vazifani batafsil yozing:");
  });
}

// ====== Text flow ======
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  if (isAdmin(ctx) && ctx.session.rejectPending) {
    const pendingId = ctx.session.rejectPending.postId;
    const pending = pendingPosts.get(pendingId);

    if (!pending) {
      ctx.session.rejectPending = null;
      return ctx.reply("Bu post topilmadi yoki allaqachon yakunlangan.");
    }

    const reason = text;

    try {
      await bot.api.sendMessage(
        pending.userId,
        "❌ Sizning postingiz tasdiqlanmadi.\n\n" +
          `🆔 Post raqami: ${pendingId}\n` +
          `📝 Sabab: ${reason}\n\n` +
          "Iltimos, xatoni to‘g‘rilab qayta yuboring."
      );
    } catch (e) {
      console.error("Userga rad sababi yuborilmadi:", e);
    }

    if (pending.type === "freelancer") stats.freelancerRejected += 1;
    if (pending.type === "job") stats.jobRejected += 1;

    pendingPosts.delete(pendingId);
    ctx.session.rejectPending = null;
    saveStore();

    return ctx.reply("✅ Rad etish sababi foydalanuvchiga yuborildi.");
  }

  if (ctx.session.step === "freelancer_services") {
    ctx.session.freelancer.services = text;
    ctx.session.step = "freelancer_portfolio";
    return ctx.reply("📁 Portfolio link yoki tavsif yuboring:");
  }

  if (ctx.session.step === "freelancer_portfolio") {
    ctx.session.freelancer.portfolio = text;
    ctx.session.step = "freelancer_price";
    return ctx.reply("💰 Narxingizni yozing:");
  }

  if (ctx.session.step === "freelancer_price") {
    ctx.session.freelancer.price = text;
    ctx.session.step = "freelancer_experience";
    return ctx.reply("📍 Tajribangizni yozing:");
  }

  if (ctx.session.step === "freelancer_experience") {
    ctx.session.freelancer.experience = text;
    ctx.session.step = "freelancer_contact";
    return ctx.reply("📩 Aloqa uchun username yoki telefon yozing:");
  }

  if (ctx.session.step === "freelancer_contact") {
    ctx.session.freelancer.contact = text;
    ctx.session.step = "freelancer_photo";
    return ctx.reply("🖼 Portfolio rasmi yoki ish namunasi yuboring. Agar rasm bo‘lmasa /skip yozing:");
  }

  if (ctx.session.step === "job_task") {
    ctx.session.job.task = text;
    ctx.session.step = "job_budget";
    return ctx.reply("💰 Budjetni yozing:");
  }

  if (ctx.session.step === "job_budget") {
    ctx.session.job.budget = text;
    ctx.session.step = "job_deadline";
    return ctx.reply("⏰ Muddatni yozing:");
  }

  if (ctx.session.step === "job_deadline") {
    ctx.session.job.deadline = text;
    ctx.session.step = "job_level";
    return ctx.reply("📍 Qaysi darajadagi freelancer kerak? (Junior / Middle / Senior)");
  }

  if (ctx.session.step === "job_level") {
    ctx.session.job.level = text;
    ctx.session.step = "job_contact";
    return ctx.reply("📩 Aloqa uchun username yoki telefon yozing:");
  }

  if (ctx.session.step === "job_contact") {
    ctx.session.job.contact = text;
    ctx.session.step = "job_photo";
    return ctx.reply("🖼 Loyiha banneri, logo yoki referens rasm yuboring. Agar rasm bo‘lmasa /skip yozing:");
  }
});

// ====== Photo flow ======
bot.on("message:photo", async (ctx) => {
  const photos = ctx.message.photo;
  const biggestPhoto = photos[photos.length - 1];
  const fileId = biggestPhoto.file_id;

  if (ctx.session.step === "freelancer_photo") {
    ctx.session.freelancer.photo = fileId;
    const post = freelancerPost(ctx.session.freelancer);
    stats.freelancerSubmitted += 1;
    saveStore();
    await sendToAdmin(ctx, "freelancer", post, fileId);
    clearSession(ctx);
    return;
  }

  if (ctx.session.step === "job_photo") {
    ctx.session.job.photo = fileId;
    const post = jobPost(ctx.session.job);
    stats.jobSubmitted += 1;
    saveStore();
    await sendToAdmin(ctx, "job", post, fileId);
    clearSession(ctx);
    return;
  }

  await ctx.reply("Hozir rasm yuborish bosqichi emas.");
});

// ====== Approve / Reject ======
bot.callbackQuery(/^approve_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCallbackQuery({ text: "Faqat admin tasdiqlay oladi." });
  }

  const postId = ctx.match[1];
  const pending = pendingPosts.get(postId);

  if (!pending) {
    return ctx.answerCallbackQuery({ text: "Bu post topilmadi." });
  }

  let sentMessage;

  if (pending.photo) {
    sentMessage = await bot.api.sendPhoto(CHANNEL_ID, pending.photo, {
      caption: pending.text,
      parse_mode: "HTML",
      reply_markup: postContactKeyboard(),
    });
  } else {
    sentMessage = await bot.api.sendMessage(CHANNEL_ID, pending.text, {
      parse_mode: "HTML",
      reply_markup: postContactKeyboard(),
    });
  }

  const postLink = `https://t.me/${CHANNEL_USERNAME}/${sentMessage.message_id}`;

  approvedPosts.set(postId, {
    ...pending,
    messageId: sentMessage.message_id,
    postLink,
    approvedAt: Date.now(),
  });

  try {
    await bot.api.sendMessage(
      pending.userId,
      "✅ Sizning postingiz tasdiqlandi va kanalga joylandi.\n\n" +
        `🆔 Post raqami: ${postId}\n` +
        `📢 Post linki: ${postLink}`
    );
  } catch (e) {
    console.error("Userga tasdiq xabari yuborilmadi:", e);
  }

  if (pending.type === "freelancer") stats.freelancerApproved += 1;
  if (pending.type === "job") stats.jobApproved += 1;

  pendingPosts.delete(postId);
  saveStore();

  await ctx.answerCallbackQuery({ text: "Post kanalga yuborildi!" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
});

bot.callbackQuery(/^reject_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCallbackQuery({ text: "Faqat admin rad eta oladi." });
  }

  const postId = ctx.match[1];
  const pending = pendingPosts.get(postId);

  if (!pending) {
    return ctx.answerCallbackQuery({ text: "Bu post topilmadi." });
  }

  ctx.session.rejectPending = { postId };

  await ctx.answerCallbackQuery({ text: "Rad etish sababi yozilsin." });
  await ctx.reply(`❌ Post ID ${postId} rad etilmoqda.\n\nEndi rad etish sababini bitta xabar qilib yozing.`);
});

// ====== Errors ======
bot.catch((err) => {
  console.error("BOT XATOLIK:", err);
});

// ====== Start polling ======
bot.start();
console.log("Bot ishga tushdi...");