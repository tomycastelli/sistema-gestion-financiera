import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const Status = pgEnum("Status", ["cancelled", "confirmed", "pending"]);
export const requestStatus = pgEnum("RequestStatus", [
  "finished",
  "working",
  "pending",
]);

export const transactionsMetadata = pgTable(
  "TransactionsMetadata",
  {
    transactionId: integer("transactionId")
      .notNull()
      .references(() => transactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    uploadedBy: text("uploadedBy")
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    uploadedDate: timestamp("uploadedDate", { mode: "date" })
      .defaultNow()
      .notNull(),
    confirmedBy: text("confirmedBy").references(() => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    confirmedDate: timestamp("confirmedDate", { mode: "date" }),
    history: jsonb("history"),
    metadata: jsonb("metadata"),
    cancelledBy: text("cancelledBy").references(() => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cancelledDate: timestamp("cancelledDate", { mode: "date" }),
  },
  (table) => {
    return {
      transactionIdKey: uniqueIndex(
        "TransactionsMetadata_transactionId_key",
      ).on(table.transactionId),
      transactionIdUploadedByConfirmedByIdx: index(
        "TransactionsMetadata_transactionId_uploadedBy_confirmedBy_idx",
      ).on(table.transactionId, table.uploadedBy, table.confirmedBy),
    };
  },
);

export const verificationToken = pgTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { precision: 3, mode: "string" }).notNull(),
  },
  (table) => {
    return {
      tokenKey: uniqueIndex("VerificationToken_token_key").on(table.token),
      identifierTokenKey: uniqueIndex(
        "VerificationToken_identifier_token_key",
      ).on(table.identifier, table.token),
    };
  },
);

export const operations = pgTable(
  "Operations",
  {
    id: serial("id").primaryKey().notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),
    observations: text("observations"),
  },
  (table) => {
    return {
      dateIdx: index("Operations_date_idx").on(table.date),
    };
  },
);

export const chat = pgTable(
  "Chat",
  {
    id: serial("id").primaryKey().notNull(),
    name: text("name")
  },
)

export const chatToUsers = pgTable(
  "chatToUsers", {
  chatId: integer("chatId").notNull().references(() => chat.id),
  userId: text("userId").notNull().references(() => user.id),
  lastConnection: bigint("lastConnection", { mode: "number" }).notNull().default(0)
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.chatId] })
  }
}
)

export const messages = pgTable(
  "Messages",
  {
    id: serial("id").primaryKey().notNull(),
    chatId: integer("chatId").notNull().references(() => chat.id),
    userId: text("userId").notNull().references(() => user.id, {
      onUpdate: "cascade",
      onDelete: "cascade"
    }),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    message: text("message").notNull()
  },
  (table) => {
    return {
      chatTimestampIdx: index("chat_timestamp_idx").on(table.chatId, table.timestamp)
    }
  }
)

export const transactions = pgTable(
  "Transactions",
  {
    id: serial("id").primaryKey().notNull(),
    operationId: integer("operationId")
      .notNull()
      .references(() => operations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    date: timestamp("date", { mode: "date" }),
    operatorEntityId: integer("operatorEntityId")
      .notNull()
      .references(() => entities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fromEntityId: integer("fromEntityId")
      .notNull()
      .references(() => entities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    toEntityId: integer("toEntityId")
      .notNull()
      .references(() => entities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    currency: text("currency").notNull(),
    amount: doublePrecision("amount").notNull(),
    method: text("method"),
    observations: text("observations"),
    status: Status("status").default("pending").notNull(),
  },
  (table) => {
    return {
      operationIdFromEntityIdToEntityIdDateCurreIdx: index(
        "Transactions_operationId_fromEntityId_toEntityId_date_curre_idx",
      ).on(
        table.operationId,
        table.date,
        table.fromEntityId,
        table.toEntityId,
        table.currency,
      ),
    };
  },
);

export const links = pgTable("Links", {
  id: serial("id").primaryKey().notNull(),
  sharedEntityId: integer("sharedEntityId")
    .notNull()
    .references(() => entities.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  password: text("password").notNull(),
  expiration: date("date", { mode: "date" }).notNull(),
});

export const balances = pgTable(
  "Balances",
  {
    id: serial("id").primaryKey().notNull(),
    account: boolean("account").notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),
    balance: doublePrecision("balance").notNull(),
    otherEntityId: integer("otherEntityId")
      .notNull()
      .references(() => entities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    selectedEntityId: integer("selectedEntityId")
      .notNull()
      .references(() => entities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    currency: text("currency").notNull(),
  },
  (table) => {
    return {
      selectedEntityIdOtherEntityIdDateAccountCurrenIdx: index(
        "Balances_selectedEntityId_otherEntityId_date_account_curren_idx",
      ).on(
        table.account,
        table.date,
        table.otherEntityId,
        table.selectedEntityId,
        table.currency,
      ),
    };
  },
);

export const entities = pgTable(
  "Entities",
  {
    id: serial("id").primaryKey().notNull(),
    name: text("name").notNull(),
    tagName: text("tagName")
      .notNull()
      .references(() => tag.name, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      nameIdx: index("Entities_name_idx").on(table.name),
      nameKey: uniqueIndex("Entities_name_key").on(table.name),
      tagNameIdx: index("Entities_tagName_idx").on(table.tagName),
    };
  },
);

export const oauth_account = pgTable(
  "oauth_account",
  {
    providerId: text("provider", { enum: ["microsoft", "google"] }).notNull(),
    providerUserId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
  }),
);

export const user = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    photoUrl: text("photo_url"),
    permissions: jsonb("permissions"),
    roleId: integer("roleId").references(() => role.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    entityId: integer("entityId").references(() => entities.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => {
    return {
      emailKey: uniqueIndex("User_email_key").on(table.email),
      nameKey: uniqueIndex("User_name_key").on(table.name),
      entityIdKey: uniqueIndex("User_entityId_key").on(table.entityId),
      emailNameIdx: index("User_email_name_idx").on(table.name, table.email),
    };
  },
);

export const role = pgTable(
  "Role",
  {
    id: serial("id").primaryKey().notNull(),
    name: text("name").notNull(),
    permissions: jsonb("permissions").notNull(),
    color: text("color"),
  },
  (table) => {
    return {
      nameKey: uniqueIndex("Role_name_key").on(table.name),
      nameIdx: index("Role_name_idx").on(table.name),
    };
  },
);

export const tag = pgTable(
  "Tag",
  {
    name: text("name").primaryKey().notNull(),
    parent: text("parent"),
    color: text("color"),
  },
  (table) => {
    return {
      tagParentFkey: foreignKey({
        columns: [table.parent],
        foreignColumns: [table.name],
        name: "Tag_parent_fkey",
      })
        .onUpdate("cascade")
        .onDelete("set null"),
    };
  },
);

export const session = pgTable("Session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const movements = pgTable(
  "Movements",
  {
    id: serial("id").primaryKey().notNull(),
    transactionId: integer("transactionId")
      .notNull()
      .references(() => transactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    direction: integer("direction").notNull(),
    type: text("type").notNull(),
    account: boolean("account").default(false).notNull(),
    balance: doublePrecision("balance").notNull(),
    balanceId: integer("balanceId")
      .notNull()
      .references(() => balances.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      transactionIdDirectionIdx: index(
        "Movements_transactionId_direction_idx",
      ).on(table.transactionId, table.direction),
    };
  },
);

export const requests = pgTable("Requests", {
  id: serial("id").primaryKey().notNull(),
  uploadedBy: text("uploadedBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: requestStatus("status").default("pending").notNull(),
  developerMessage: text("developerMessage"),
});

export const tagsManyRelations = relations(tag, ({ many, one }) => ({
  entities: many(entities),
  children: many(tag, { relationName: "children" }),
  parent: one(tag, {
    fields: [tag.parent],
    references: [tag.name],
    relationName: "children",
  }),
}));

export const entitiesRelations = relations(entities, ({ many, one }) => ({
  transactions: many(transactions),
  balances: many(balances),
  links: many(links),
  tag: one(tag, {
    fields: [entities.tagName],
    references: [tag.name],
  }),
}));

export const chatRelations = relations(chat, ({ many }) => ({
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chat, {
    fields: [messages.chatId],
    references: [chat.id]
  })
}))

export const operationManyRelations = relations(operations, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    fromEntity: one(entities, {
      fields: [transactions.fromEntityId],
      references: [entities.id],
    }),
    toEntity: one(entities, {
      fields: [transactions.toEntityId],
      references: [entities.id],
    }),
    operatorEntity: one(entities, {
      fields: [transactions.operatorEntityId],
      references: [entities.id],
    }),
    operation: one(operations, {
      fields: [transactions.operationId],
      references: [operations.id],
    }),
    transactionMetadata: one(transactionsMetadata, {
      relationName: "transactionMetadata",
      fields: [transactions.id],
      references: [transactionsMetadata.transactionId],
    }),
    movements: many(movements),
  }),
);

export const movementsOneRelations = relations(movements, ({ one }) => ({
  transaction: one(transactions, {
    fields: [movements.transactionId],
    references: [transactions.id],
  }),
  balanceId: one(balances, {
    fields: [movements.balanceId],
    references: [balances.id],
  }),
}));

export const transactionsMetadataRelations = relations(
  transactionsMetadata,
  ({ one }) => ({
    uploadedByUser: one(user, {
      fields: [transactionsMetadata.uploadedBy],
      references: [user.id],
      relationName: "uploadedByUser",
    }),
    confirmedByUser: one(user, {
      fields: [transactionsMetadata.confirmedBy],
      references: [user.id],
      relationName: "confirmedByUser",
    }),
    cancelledByUser: one(user, {
      fields: [transactionsMetadata.cancelledBy],
      references: [user.id],
      relationName: "cancelledByUser",
    }),
    transactions: one(transactions, {
      relationName: "transactionMetadata",
      fields: [transactionsMetadata.transactionId],
      references: [transactions.id],
    }),
  }),
);

export const balancesRelations = relations(balances, ({ one, many }) => ({
  selectedEntity: one(entities, {
    fields: [balances.selectedEntityId],
    references: [entities.id],
  }),
  otherEntity: one(entities, {
    fields: [balances.otherEntityId],
    references: [entities.id],
  }),
  movements: many(movements),
}));

export const linksOneRelations = relations(links, ({ one }) => ({
  sharedEntity: one(entities, {
    fields: [links.sharedEntityId],
    references: [entities.id],
  }),
}));

export const rolesManyRelations = relations(role, ({ many }) => ({
  users: many(user),
}));

export const usersRelations = relations(user, ({ one, many }) => ({
  role: one(role, {
    fields: [user.roleId],
    references: [role.id],
  }),
  requests: many(requests),
  transactionsUploads: many(transactionsMetadata, {
    relationName: "uploadedByUser",
  }),
  transactionsConfirmations: many(transactionsMetadata, {
    relationName: "confirmedByUser",
  }),
  transactionsCancellations: many(transactionsMetadata, {
    relationName: "cancelledByUser",
  }),
}));

export const requestsOneRelations = relations(requests, ({ one }) => ({
  uploadedByUser: one(user, {
    fields: [requests.uploadedBy],
    references: [user.id],
  }),
}));

export const insertTransactionsSchema = createInsertSchema(transactions);

export const returnedBalancesSchema = createSelectSchema(balances);
export const returnedMovementsSchema = createSelectSchema(movements);
export const returnedTransactionsSchema = createSelectSchema(transactions);
