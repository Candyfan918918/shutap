import { createServerFn } from "@tanstack/react-start";

export const pingTally = createServerFn({ method: "GET" }).handler(async () => {
  return { total: 0 };
});
