import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "lesson-generator",
  isDev: process.env.NODE_ENV === "development",
});
