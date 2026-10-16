-- One family-goal vote per person per month (v0.583.0).
--
-- Until now a vote was unique per (proposal, person), so one person could vote
-- for every idea in a month. The rule is one vote each, which moves when they
-- tap a different idea; toggleCoopVoteCore enforces that from here on.
--
-- This cleans up anything cast under the old rule: for each person and month
-- (CoopProposal.seasonKey), keep their most recent vote and drop the rest.
-- Ties on createdAt keep the larger id, so the result is deterministic.
-- Idempotent — once one vote per person per month remains, nothing matches.
DELETE FROM "CoopVote" v
USING "CoopVote" w, "CoopProposal" pv, "CoopProposal" pw
WHERE v."proposalId" = pv."id"
  AND w."proposalId" = pw."id"
  AND v."userId" = w."userId"
  AND pv."seasonKey" = pw."seasonKey"
  AND v."id" <> w."id"
  AND (v."createdAt" < w."createdAt"
       OR (v."createdAt" = w."createdAt" AND v."id" < w."id"));
