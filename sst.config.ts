import { type SSTConfig } from "sst";
import { NextjsSite } from "sst/constructs";
import { env } from "~/env.mjs";

export default {
  config(_input) {
    return {
      name: "sistema-maika",
      region: "sa-east-1",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new NextjsSite(stack, "site", {
        environment: {
          DATABASE_URL: env.DATABASE_URL,
          NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
          NEXTAUTH_URL: "https://d30zt9jpiei5fi.cloudfront.net",
          MONGODB_URL: env.MONGODB_URL,
          MONGODB_PASS: env.MONGODB_PASS,
          AZURE_AD_CLIENT_ID: env.AZURE_AD_CLIENT_ID,
          AZURE_AD_CLIENT_SECRET: env.AZURE_AD_CLIENT_SECRET,
          AZURE_AD_TENANT_ID: env.AZURE_AD_TENANT_ID,
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
          REDIS_URL: env.REDIS_URL,
        },
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;
