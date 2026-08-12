# 02 — Every server failure returns the house error envelope

**What to build:** Whatever goes wrong inside the server, the client receives exactly one shape: `{ error: '<lowercase message>' }`. A client never sees a raw stack trace, an internal message, or Fastify's default 500 body.

Three branches, in this order:

1. A deliberate `HttpError` returns its own status code and its own message.
2. A Fastify error carrying a `statusCode` below 500 keeps that status, with its message lowercased — a malformed JSON body still returns 400 and an unknown route still returns 404, rather than being flattened into a 500. Debugging stays honest.
3. Anything else becomes `500 { error: 'internal error' }`, and the original message never reaches the client.

The handler is registered inside `buildApp`, alongside the routes, so that every test exercises the same error handling the real server uses — there is no test-only code path.

This does not exist today. Without it every endpoint author invents a different mechanism and the envelope guarantee (decision D-C) quietly fails. It is built now rather than in Phase 2 because Phase 2's first endpoint is the concurrency-critical booking path, which should inherit error handling rather than invent it under pressure.

The `HttpError` class and helper shapes are specified in `PROJECT_CONTEXT.md` §9.4. Follow the existing `tests/routes/auth.test.ts` pattern, which already drives the app end to end through `buildApp` plus `app.inject` with a throwaway database from `tests/helpers/db.ts`.

**Blocked by:** None — can start immediately. Independent of ticket 01, though landing 01 first means this ships behind a gate that actually runs its tests.

**Status:** ready-for-agent

- [ ] A route that throws an `HttpError` responds with that error's status and its message in the envelope
- [ ] A route that throws an unexpected exception responds `500 { error: 'internal error' }` and the original message appears nowhere in the response
- [ ] A malformed JSON request body still returns Fastify's 400, not a 500
- [ ] A request to an unknown route still returns 404
- [ ] Every message in the envelope is lowercase
- [ ] The handler is registered inside `buildApp`, and the tests build the app through that same function
- [ ] The existing auth route tests still pass unchanged
