// БД конструктора. PostgreSQL (Railway plugin).
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- Аккаунт владельца ботов ---
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  bots      Bot[]
}

// --- Один Telegram-бот (проект) ---
model Bot {
  id            String       @id @default(cuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  token         String
  username      String?
  isActive      Boolean      @default(false)
  webhookSecret String       @default(cuid())
  createdAt     DateTime     @default(now())
  blocks        Block[]
  subscribers   Subscriber[]
  broadcasts    Broadcast[]

  @@index([userId])
}

// --- Узел сценария (шаг воронки) ---
// type: start | command | message | input
// triggerType: start | command | text
model Block {
  id           String   @id @default(cuid())
  botId        String
  bot          Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  type         String   @default("message")
  name         String   @default("Блок")
  triggerType  String?
  triggerValue String?
  text         String   @default("")
  mediaType    String? // photo
  mediaUrl     String?
  variableName String? // куда сохранить ответ (для input)
  nextBlockId  String? // авто-переход к следующему блоку
  posX         Float    @default(0)
  posY         Float    @default(0)
  createdAt    DateTime @default(now())
  buttons      Button[]

  @@index([botId])
}

// --- Inline-кнопка на блоке ---
// action: goto | url
model Button {
  id            String  @id @default(cuid())
  blockId       String
  block         Block   @relation(fields: [blockId], references: [id], onDelete: Cascade)
  text          String
  action        String  @default("goto")
  targetBlockId String?
  url           String?
  row           Int     @default(0)
  position      Int     @default(0)

  @@index([blockId])
}

// --- Подписчик бота (пользователь Telegram) ---
model Subscriber {
  id             String   @id @default(cuid())
  botId          String
  bot            Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  telegramId     String
  username       String?
  firstName      String?
  lastName       String?
  currentBlockId String?
  awaitingVar    String? // ждём текст → сохранить в эту переменную
  awaitingNext   String? // после сохранения перейти сюда
  variables      Json     @default("{}")
  isBlocked      Boolean  @default(false)
  joinedAt       DateTime @default(now())
  lastActiveAt   DateTime @default(now())

  @@unique([botId, telegramId])
  @@index([botId])
}

// --- Массовая рассылка ---
model Broadcast {
  id        String   @id @default(cuid())
  botId     String
  bot       Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  text      String
  status    String   @default("draft") // draft | sending | done
  sentCount Int      @default(0)
  failCount Int      @default(0)
  createdAt DateTime @default(now())

  @@index([botId])
}
