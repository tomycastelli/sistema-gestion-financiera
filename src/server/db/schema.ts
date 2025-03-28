import {
  bigint,
  boolean,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm/relations";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

const decimalNumber = customType<{ data: number }>({
  dataType() {
    return "numeric(16, 4)";
  },
  fromDriver(value) {
    return Number(value);
  },
});

export const requestStatus = pgEnum("RequestStatus", [
  "finished",
  "working",
  "pending",
]);

export const Status = pgEnum("Status", ["cancelled", "confirmed", "pending"]);

export const balanceType = pgEnum("BalanceType", ["1", "2", "3", "4"]);

export const balances = pgTable(
  "balances",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: balanceType("type").notNull(),
    tag: text("tag"),
    ent_a: integer("ent_a"),
    ent_b: integer("ent_b"),
    account: boolean("account").notNull(),
    currency: text("currency").notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),
    amount: decimalNumber("amount").notNull(),
  },
  (table) => {
    return {
      balancesEntAEntitiesIdFk: foreignKey({
        columns: [table.ent_a],
        foreignColumns: [entities.id],
        name: "Balances_ent_a_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      balancesEntBEntitiesIdFk: foreignKey({
        columns: [table.ent_b],
        foreignColumns: [entities.id],
        name: "Balances_ent_b_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      balancesTagTagNameFk: foreignKey({
        columns: [table.tag],
        foreignColumns: [tag.name],
        name: "Balances_tag_Tag_name_fk",
      })
        .onUpdate("cascade")
        .onDelete("restrict"),
      dateTypeEntAEntBTagCurrencyIdx: index(
        "Balances_date_type_ent_a_ent_b_tag_currency_idx",
      ).using(
        "btree",
        table.date.asc().nullsLast(),
        table.type.asc().nullsLast(),
        table.ent_a.asc().nullsLast(),
        table.ent_b.asc().nullsLast(),
        table.tag.asc().nullsLast(),
        table.currency.asc().nullsLast(),
      ),
    };
  },
);

export const links = pgTable(
  "Links",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sharedEntityId: integer("sharedEntityId").notNull(),
    password: text("password").notNull(),
    expiration: date("date", { mode: "date" }).notNull(),
  },
  (table) => {
    return {
      linksSharedEntityIdEntitiesIdFk: foreignKey({
        columns: [table.sharedEntityId],
        foreignColumns: [entities.id],
        name: "Links_sharedEntityId_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
    };
  },
);

export const chat = pgTable("Chat", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name"),
});

export const globalSettings = pgTable("GlobalSettings", {
  name: text("name").primaryKey().notNull(),
  data: jsonb("data").notNull(),
});

export const messages = pgTable(
  "Messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    chatId: integer("chatId").notNull(),
    userId: text("userId").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    message: text("message").notNull(),
  },
  (table) => {
    return {
      chatTimestampIdx: index("chat_timestamp_idx").using(
        "btree",
        table.chatId.asc().nullsLast(),
        table.timestamp.asc().nullsLast(),
      ),
      messagesChatIdChatIdFk: foreignKey({
        columns: [table.chatId],
        foreignColumns: [chat.id],
        name: "Messages_chatId_Chat_id_fk",
      }),
      messagesUserIdUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [user.id],
        name: "Messages_userId_User_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
    };
  },
);

export const requests = pgTable(
  "Requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    uploadedBy: text("uploadedBy").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: requestStatus("status").default("pending").notNull(),
    developerMessage: text("developerMessage"),
  },
  (table) => {
    return {
      requestsUploadedByUserIdFk: foreignKey({
        columns: [table.uploadedBy],
        foreignColumns: [user.id],
        name: "Requests_uploadedBy_User_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("restrict"),
    };
  },
);

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    rate: decimalNumber("rate").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.currency, table.date],
        name: "currency_date_pk",
      }),
    };
  },
);

export const operations = pgTable(
  "Operations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: timestamp("date", { mode: "date" }).notNull(),
    observations: text("observations"),
  },
  (table) => {
    return {
      dateIdx: index("Operations_date_idx").using(
        "btree",
        table.date.asc().nullsLast(),
      ),
    };
  },
);

export const movements = pgTable(
  "Movements",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    transactionId: integer("transactionId").notNull(),
    direction: integer("direction").notNull(),
    type: text("type").notNull(),
    account: boolean("account").notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),
    // Balance associated data
    balance_1: decimalNumber("balance_1").notNull(),
    balance_1_id: integer("balance_1_id").notNull(),
    balance_2a: decimalNumber("balance_2a").notNull(),
    balance_2a_id: integer("balance_2a_id").notNull(),
    balance_2b: decimalNumber("balance_2b").notNull(),
    balance_2b_id: integer("balance_2b_id").notNull(),
    balance_3a: decimalNumber("balance_3a").notNull(),
    balance_3a_id: integer("balance_3a_id").notNull(),
    balance_3b: decimalNumber("balance_3b").notNull(),
    balance_3b_id: integer("balance_3b_id").notNull(),
    balance_4a: decimalNumber("balance_4a").notNull(),
    balance_4a_id: integer("balance_4a_id").notNull(),
    balance_4b: decimalNumber("balance_4b").notNull(),
    balance_4b_id: integer("balance_4b_id").notNull(),
    balanceId: integer("balanceId"),
  },
  (table) => {
    return {
      transactionIdAccountIdx: index(
        "Movements_transactionId_account_idx",
      ).using(
        "btree",
        table.transactionId.asc().nullsLast(),
        table.account.asc().nullsLast(),
      ),
      movementsBalanceIdBalancesIdFk: foreignKey({
        columns: [table.balanceId],
        foreignColumns: [balances.id],
        name: "Movements_balanceId_Balances_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      movementsTransactionIdTransactionsIdFk: foreignKey({
        columns: [table.transactionId],
        foreignColumns: [transactions.id],
        name: "Movements_transactionId_Transactions_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
    };
  },
);

export const entities = pgTable(
  "Entities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    tagName: text("tagName").notNull(),
  },
  (table) => {
    return {
      nameIdx: index("Entities_name_idx").using(
        "btree",
        table.name.asc().nullsLast(),
      ),
      nameKey: uniqueIndex("Entities_name_key").using(
        "btree",
        table.name.asc().nullsLast(),
      ),
      tagNameIdx: index("Entities_tagName_idx").using(
        "btree",
        table.tagName.asc().nullsLast(),
      ),
      entitiesTagNameTagNameFk: foreignKey({
        columns: [table.tagName],
        foreignColumns: [tag.name],
        name: "Entities_tagName_Tag_name_fk",
      })
        .onUpdate("cascade")
        .onDelete("restrict"),
    };
  },
);

export const transactionsMetadata = pgTable(
  "TransactionsMetadata",
  {
    transactionId: integer("transactionId").notNull(),
    relatedTransactionId: integer("relatedTransactionId"),
    uploadedBy: text("uploadedBy").notNull(),
    uploadedDate: timestamp("uploadedDate", { mode: "date" })
      .defaultNow()
      .notNull(),
    confirmedBy: text("confirmedBy"),
    confirmedDate: timestamp("confirmedDate", { mode: "date" }),
    history: jsonb("history"),
    metadata: jsonb("metadata"),
    cancelledBy: text("cancelledBy"),
    cancelledDate: timestamp("cancelledDate", { mode: "date" }),
  },
  (table) => {
    return {
      transactionIdKey: uniqueIndex(
        "TransactionsMetadata_transactionId_key",
      ).using("btree", table.transactionId.asc().nullsLast()),
      transactionIdUploadedByConfirmedByIdx: index(
        "TransactionsMetadata_transactionId_uploadedBy_confirmedBy_idx",
      ).using(
        "btree",
        table.transactionId.asc().nullsLast(),
        table.uploadedBy.asc().nullsLast(),
        table.confirmedBy.asc().nullsLast(),
      ),
      transactionsMetadataCancelledByUserIdFk: foreignKey({
        columns: [table.cancelledBy],
        foreignColumns: [user.id],
        name: "TransactionsMetadata_cancelledBy_User_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("set null"),
      transactionsMetadataConfirmedByUserIdFk: foreignKey({
        columns: [table.confirmedBy],
        foreignColumns: [user.id],
        name: "TransactionsMetadata_confirmedBy_User_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("set null"),
      transactionsMetadataRelatedTransactionIdTransactionsIdFk: foreignKey({
        columns: [table.relatedTransactionId],
        foreignColumns: [transactions.id],
        name: "TransactionsMetadata_relatedTransactionId_Transactions_id_fk",
      }).onDelete("set null"),
      transactionsMetadataTransactionIdTransactionsIdFk: foreignKey({
        columns: [table.transactionId],
        foreignColumns: [transactions.id],
        name: "TransactionsMetadata_transactionId_Transactions_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      transactionsMetadataUploadedByUserIdFk: foreignKey({
        columns: [table.uploadedBy],
        foreignColumns: [user.id],
        name: "TransactionsMetadata_uploadedBy_User_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("restrict"),
    };
  },
);

export const transactions = pgTable(
  "Transactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    operationId: integer("operationId").notNull(),
    type: text("type").notNull(),
    operatorEntityId: integer("operatorEntityId").notNull(),
    fromEntityId: integer("fromEntityId").notNull(),
    toEntityId: integer("toEntityId").notNull(),
    currency: text("currency").notNull(),
    amount: decimalNumber("amount").notNull(),
    observations: text("observations"),
    status: Status("status").default("pending").notNull(),
    is_approved: boolean("is_approved").notNull(),
  },
  (table) => {
    return {
      operationIdEntAEntBDateCurreIdx: index(
        "Transactions_operationId_ent_a_ent_b_date_curre_idx",
      ).using(
        "btree",
        table.operationId.asc().nullsLast(),
        table.ent_a.asc().nullsLast(),
        table.ent_b.asc().nullsLast(),
        table.currency.asc().nullsLast(),
      ),
      transactionsEntAEntitiesIdFk: foreignKey({
        columns: [table.ent_a],
        foreignColumns: [entities.id],
        name: "Transactions_ent_a_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      transactionsOperationIdOperationsIdFk: foreignKey({
        columns: [table.operationId],
        foreignColumns: [operations.id],
        name: "Transactions_operationId_Operations_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      transactionsOperatorEntityIdEntitiesIdFk: foreignKey({
        columns: [table.operatorEntityId],
        foreignColumns: [entities.id],
        name: "Transactions_operatorEntityId_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
      transactionsEntBEntitiesIdFk: foreignKey({
        columns: [table.ent_b],
        foreignColumns: [entities.id],
        name: "Transactions_ent_b_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("cascade"),
    };
  },
);

export const session = pgTable(
  "Session",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => {
    return {
      sessionUserIdUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [user.id],
        name: "Session_user_id_User_id_fk",
      }),
    };
  },
);

export const role = pgTable(
  "Role",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    permissions: jsonb("permissions").notNull(),
    color: text("color"),
  },
  (table) => {
    return {
      nameIdx: index("Role_name_idx").using(
        "btree",
        table.name.asc().nullsLast(),
      ),
      nameKey: uniqueIndex("Role_name_key").using(
        "btree",
        table.name.asc().nullsLast(),
      ),
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

export const verificationToken = pgTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { precision: 3, mode: "string" }).notNull(),
  },
  (table) => {
    return {
      identifierTokenKey: uniqueIndex(
        "VerificationToken_identifier_token_key",
      ).using(
        "btree",
        table.identifier.asc().nullsLast(),
        table.token.asc().nullsLast(),
      ),
      tokenKey: uniqueIndex("VerificationToken_token_key").using(
        "btree",
        table.token.asc().nullsLast(),
      ),
    };
  },
);

export const user = pgTable(
  "User",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name"),
    email: text("email"),
    photoUrl: text("photo_url"),
    permissions: jsonb("permissions"),
    roleId: integer("roleId"),
    entityId: integer("entityId"),
    preferredEntity: integer("preferred_entity").references(() => entities.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => {
    return {
      emailKey: uniqueIndex("User_email_key").using(
        "btree",
        table.email.asc().nullsLast(),
      ),
      emailNameIdx: index("User_email_name_idx").using(
        "btree",
        table.name.asc().nullsLast(),
        table.email.asc().nullsLast(),
      ),
      entityIdKey: uniqueIndex("User_entityId_key").using(
        "btree",
        table.entityId.asc().nullsLast(),
      ),
      nameKey: uniqueIndex("User_name_key").using(
        "btree",
        table.name.asc().nullsLast(),
      ),
      userEntityIdEntitiesIdFk: foreignKey({
        columns: [table.entityId],
        foreignColumns: [entities.id],
        name: "User_entityId_Entities_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("set null"),
      userRoleIdRoleIdFk: foreignKey({
        columns: [table.roleId],
        foreignColumns: [role.id],
        name: "User_roleId_Role_id_fk",
      })
        .onUpdate("cascade")
        .onDelete("set null"),
    };
  },
);

export const oauth_account = pgTable(
  "oauth_account",
  {
    providerId: text("provider", { enum: ["microsoft", "google"] }).notNull(),
    providerUserId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => {
    return {
      oauthAccountUserIdUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [user.id],
        name: "oauth_account_user_id_User_id_fk",
      }),
      oauthAccountProviderProviderIdPk: primaryKey({
        columns: [table.providerId, table.providerUserId],
        name: "oauth_account_provider_provider_id_pk",
      }),
    };
  },
);

export const chatToUsers = pgTable(
  "chatToUsers",
  {
    chatId: integer("chatId").notNull(),
    userId: text("userId").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastConnection: bigint("lastConnection", { mode: "number" })
      .default(0)
      .notNull(),
  },
  (table) => {
    return {
      chatToUsersChatIdChatIdFk: foreignKey({
        columns: [table.chatId],
        foreignColumns: [chat.id],
        name: "chatToUsers_chatId_Chat_id_fk",
      }),
      chatToUsersUserIdUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [user.id],
        name: "chatToUsers_userId_User_id_fk",
      }),
      chatToUsersUserIdChatIdPk: primaryKey({
        columns: [table.chatId, table.userId],
        name: "chatToUsers_userId_chatId_pk",
      }),
    };
  },
);

export const insertTransactionsSchema = createInsertSchema(transactions).extend(
  { amount: z.number() },
);
export const insertMovementsSchema = createInsertSchema(movements).extend({
  balance_1: z.number().optional(),
  balance_2a: z.number().optional(),
  balance_2b: z.number().optional(),
  balance_3a: z.number().optional(),
  balance_3b: z.number().optional(),
  balance_4a: z.number().optional(),
  balance_4b: z.number().optional(),
});
export const insertBalancesSchema = createInsertSchema(balances).extend({
  amount: z.number(),
});

export const returnedBalancesSchema = createSelectSchema(balances).extend({
  amount: z.number(),
});
export const returnedMovementsSchema = createSelectSchema(movements).extend({
  balance_1: z.number().optional(),
  balance_2a: z.number().optional(),
  balance_2b: z.number().optional(),
  balance_3a: z.number().optional(),
  balance_3b: z.number().optional(),
  balance_4a: z.number().optional(),
  balance_4b: z.number().optional(),
});
export const returnedTransactionsSchema = createSelectSchema(
  transactions,
).extend({ amount: z.number() });
export const returnedOperationsSchema = createSelectSchema(operations);
export const returnedEntitiesSchema = createSelectSchema(entities);
export const returnedTransactionsMetadataSchema =
  createSelectSchema(transactionsMetadata);
export const returnedUserSchema = createSelectSchema(user);
export const returnedTagSchema = createSelectSchema(tag);

export const tagsManyRelations = relations(tag, ({ many, one }) => ({
  entities: many(entities),
  balances: many(balances, { relationName: "tagRelation" }),
  children: many(tag, { relationName: "children" }),
  parent: one(tag, {
    fields: [tag.parent],
    references: [tag.name],
    relationName: "children",
  }),
}));

export const entitiesRelations = relations(entities, ({ many, one }) => ({
  transactions: many(transactions),
  balancesA: many(balances, { relationName: "entA" }),
  balancesB: many(balances, { relationName: "entB" }),
  links: many(links),
  tag: one(tag, {
    fields: [entities.tagName],
    references: [tag.name],
  }),
}));

export const chatRelations = relations(chat, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chat, {
    fields: [messages.chatId],
    references: [chat.id],
  }),
}));

export const operationManyRelations = relations(operations, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    fromEntity: one(entities, {
      fields: [transactions.ent_a],
      references: [entities.id],
      relationName: "fromEntity",
    }),
    toEntity: one(entities, {
      fields: [transactions.ent_b],
      references: [entities.id],
      relationName: "toEntity",
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
  balance: one(balances, {
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
  entA: one(entities, {
    fields: [balances.ent_a],
    references: [entities.id],
  }),
  entB: one(entities, {
    fields: [balances.ent_b],
    references: [entities.id],
  }),
  tagRelation: one(tag, {
    fields: [balances.tag],
    references: [tag.name],
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
