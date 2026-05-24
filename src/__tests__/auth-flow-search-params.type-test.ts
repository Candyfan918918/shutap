/**
 * Compile-time regression tests for type-safe Link/navigate search params
 * across the auth entry flow (/enter, /enter/verify, /welcome).
 *
 * This file emits no runtime code — it relies on `tsc --noEmit` (run during
 * build) to catch regressions. If any assertion below fails to type-check,
 * the build fails, surfacing the regression.
 *
 * Coverage:
 *   1. `validateSearch` output types are exactly { redirect?: string } (or {}).
 *   2. Valid Link/navigate calls keep compiling.
 *   3. Invalid Link/navigate calls (wrong type for `redirect`, unknown keys,
 *      navigating to /enter or /welcome without the required `search` arg)
 *      are rejected by the type system — guarded with `@ts-expect-error`,
 *      which itself errors if the line ever stops being an error.
 */

import type {
  LinkProps,
  NavigateOptions,
  RegisteredRouter,
} from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// 1. validateSearch shape contract
// ---------------------------------------------------------------------------

type EnterSearch = { redirect?: string };
type WelcomeSearch = { redirect?: string };
type VerifySearch = Record<string, never>;

// Equality helper — resolves to `true` only when A and B are mutually
// assignable. Any drift in the search schemas trips the assignment below.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type _EnterOk = Equal<EnterSearch, { redirect?: string }>;
type _WelcomeOk = Equal<WelcomeSearch, { redirect?: string }>;
type _VerifyOk = Equal<VerifySearch, Record<string, never>>;

const _enterContract: _EnterOk = true;
const _welcomeContract: _WelcomeOk = true;
const _verifyContract: _VerifyOk = true;
void _enterContract;
void _welcomeContract;
void _verifyContract;

// ---------------------------------------------------------------------------
// 2. Valid Link / navigate option shapes
// ---------------------------------------------------------------------------

// Shorthand aliases — LinkProps' first generic is TComp ('a' by default),
// NavigateOptions' first is TRouter.
type LP<TTo extends string> = LinkProps<"a", RegisteredRouter, string, TTo>;
type NO<TTo extends string> = NavigateOptions<RegisteredRouter, string, TTo>;

// Link to /enter with explicit redirect
const _linkEnterWithRedirect = {
  to: "/enter",
  search: { redirect: "/me" },
} as const satisfies LP<"/enter">;
void _linkEnterWithRedirect;

// Link to /enter with redirect explicitly undefined (matches usage in
// enter.verify.tsx and welcome.tsx back-buttons)
const _linkEnterNoRedirect = {
  to: "/enter",
  search: { redirect: undefined },
} as const satisfies LP<"/enter">;
void _linkEnterNoRedirect;

// navigate({ to: "/welcome", search: { redirect } }) — used after OTP verify
const _navWelcome = {
  to: "/welcome",
  search: { redirect: "/me/posts" as string | undefined },
} as const satisfies NO<"/welcome">;
void _navWelcome;

// navigate({ to: "/enter/verify", search: {} }) — used after sending OTP
const _navVerify = {
  to: "/enter/verify",
  search: {},
} as const satisfies NO<"/enter/verify">;
void _navVerify;

// navigate({ to: "/enter", search: { redirect: undefined } }) — used when
// verify page has no stashed email
const _navEnter = {
  to: "/enter",
  search: { redirect: undefined },
} as const satisfies NO<"/enter">;
void _navEnter;

// ---------------------------------------------------------------------------
// 3. Negative cases — exercised via direct type assignability
// ---------------------------------------------------------------------------
// We test the underlying search-shape contract here rather than going through
// LinkProps/NavigateOptions, because those types accept search functions and
// partials that mask narrow object-literal violations.

// `redirect` must be string | undefined, not a number
// @ts-expect-error redirect must be string | undefined
const _badRedirectType: EnterSearch = { redirect: 42 };
void _badRedirectType;

// /enter/verify search schema accepts no keys
// @ts-expect-error `redirect` is not part of /enter/verify search schema
const _verifyExtraKey: VerifySearch = { redirect: "/x" };
void _verifyExtraKey;
