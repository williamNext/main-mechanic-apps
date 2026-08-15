# ADR 0001: Deactivate Instead of Delete Mechanics

## Status

Accepted

## Context

Legacy admin removal deletes mechanic identity and cascades through timeslots, appointments, service reports, and revenue records. Current deployment uses one unbacked-up SQLite database. True deletion would erase client service history and finished-job revenue without recovery path.

## Decision

Admin removal deactivates mechanic by setting `mechanics.is_active = false`. Deactivation cancels outstanding appointments, frees their timeslots, notifies affected clients, retains all historical data, and records one audit row per mechanic. Admin may reactivate mechanic later, but reactivation restores only active flag and public projection; it does not restore cancelled appointments or re-block timeslots.

This phase ships no true-delete path for mechanics.

## Consequences

Parity with legacy edge function and ability to truly erase mechanic are given up. Every client's service history and every finished job's revenue remain intact. Deactivated mechanics disappear from `public_mechanics` and cannot be booked, while admin reports and audit history retain their records. True deletion requires future hosting and backup design.
