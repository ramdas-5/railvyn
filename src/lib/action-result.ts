import type { ZodError } from "zod";
import { toUserMessage } from "@/lib/errors";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const IDLE_ACTION: ActionState = { status: "idle" };

export function actionError(error: unknown): ActionState {
  return { status: "error", message: toUserMessage(error) };
}

export function actionSuccess(message: string): ActionState {
  return { status: "success", message };
}

export function zodActionError(error: ZodError): ActionState {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};
  const raw = flattened.fieldErrors as Record<string, string[] | undefined>;
  for (const [key, messages] of Object.entries(raw)) {
    if (messages && messages.length > 0) fieldErrors[key] = messages;
  }
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors,
  };
}

export function fieldMessage(state: ActionState, name: string): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}
