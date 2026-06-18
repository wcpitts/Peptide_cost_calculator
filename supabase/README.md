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
