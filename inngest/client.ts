import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "lesson-generator",
  checkpointing: {
    maxRuntime: "240s",
  },
  isDev: process.env.NODE_ENV === "development",
});
