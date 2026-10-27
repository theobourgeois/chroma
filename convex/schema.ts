import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /** A phone or browser that wants the daily reminder. */
  devices: defineTable({
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    /** When the next reminder goes out. */
    nextAt: v.number(),
    /** Text for that reminder; cleared once sent so a missed day gets the generic one. */
    body: v.optional(v.string()),
    job: v.optional(v.id("_scheduled_functions")),
  }).index("by_endpoint", ["endpoint"]),
});
