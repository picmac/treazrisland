# add_netplay

This migration introduces the foundational Netplay schema:

- Adds `NetplaySessionStatus` and `NetplayParticipantRole` enums to track matchmaking state and participant capabilities.
- Creates `NetplaySession` with unique join codes plus composite status/expiry index for cleanup queries.
- Creates `NetplayParticipant` to store user roles per session with supporting indexes.
- Wires the new tables to existing `User` and `Rom` records for host ownership and optional ROM association.
