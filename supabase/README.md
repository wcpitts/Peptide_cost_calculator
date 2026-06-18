# Liberty Blue Supabase

This backend is for the Liberty Blue dashboard only.

This migration is local only and has not been applied.

No Supabase project has been linked yet.

Do not place elevated Supabase keys in browser code.

Role helper functions are local-only until the migration is applied. They are intended for future RLS policies, check the authenticated user's active row in `profiles`, and do not replace database authorization. Admin/reviewer access must still be enforced by RLS, not only by front-end UI hiding.

The `updated_at` trigger is local-only until the migration is applied. It keeps `profiles`, `reagents`, and `synthesis_requests` timestamps current when rows are updated. This task still does not connect to or modify any Supabase project.

The reagent price-history trigger is local-only until the migration is applied. It records changes to package size, package cost, normalized unit cost, billing unit, effective date, and active status. Historical request price snapshots should still be stored separately in `request_reagents`.

The request status-history trigger is local-only until the migration is applied. It records the initial request status when a request is created and later transitions such as pending review, approved, rejected, scheduled, in progress, and completed. This task still does not connect to or modify any Supabase project.

RLS is enabled locally in the migration. RLS policies will be added in later steps, and until policies are added this migration is not ready for production use. This task still does not connect to or modify any Supabase project.

The public calculator should use `get_active_reagent_catalog()` rather than reading the full `reagents` table. This function returns only active catalog fields needed for estimates. Anonymous users should not receive synthesis requests, price history, profiles, notes, or full administrative reagent records. This task still does not connect to or modify any Supabase project.

Profile RLS policies are local-only until the migration is applied. Authenticated users can read their own profile, and admins can manage all profiles. The first admin profile must be created manually during project setup before normal admin management works. This task still does not connect to or modify any Supabase project.

Reagent RLS policies are local-only until the migration is applied. Admins and reviewers can read full reagent records after authentication, and only admins can add, update, or delete reagent records. Anonymous calculator access should use `get_active_reagent_catalog()` instead of direct table reads. This task still does not connect to or modify any Supabase project.

Request read policies are local-only until the migration is applied. Requesters can read only their own requests, and admins and reviewers can read all requests. Write/update policies are intentionally added later.

Admins can directly manage request records after authentication. Reviewers intentionally do not receive broad direct update access yet. Reviewer request actions should be implemented later through a controlled status-transition function, and public/requester submission should also be implemented later through a controlled submission function.

Request reagent snapshots preserve the prices used when the request was submitted. Requesters can read snapshots only for their own requests, while admins and reviewers can read all snapshots. No update/delete policies are added because historical cost snapshots should remain stable.

Status-history rows are created when requests are inserted or their status changes. Requesters can read status history only for their own requests, while admins and reviewers can read all status history. Update/delete policies are intentionally not added.

Internal notes are for admins/reviewers only. Requesters may read only non-internal notes linked to their own requests. Reviewers and admins can create and edit notes, and only admins can delete notes.

Price history is visible to admins and reviewers. Insert access exists so admin reagent edits can be recorded by the trigger. Update/delete policies are intentionally not added because price history is an audit trail. Public users and requesters cannot read reagent price history.

Amino-acid seed data uses placeholders. Prices must be replaced by Hematian Lab values. Molecular weights were copied from the current calculator source and must be verified for the exact protected derivatives before production use.
