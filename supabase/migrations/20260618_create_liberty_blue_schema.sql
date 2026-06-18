-- Liberty Blue peptide synthesis dashboard schema
-- Local migration file only.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('admin', 'reviewer', 'requester'))
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.reagents (
  id uuid primary key default gen_random_uuid(),
  code text,
  display_name text not null,
  category text not null,
  building_block text,
  molecular_weight numeric,
  billing_unit text not null,
  package_quantity numeric,
  package_unit text,
  package_cost numeric,
  normalized_unit_cost numeric,
  supplier text,
  catalog_number text,
  active boolean not null default true,
  effective_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),

  constraint reagents_category_check
    check (category in ('amino_acid', 'solvent', 'reagent', 'resin', 'consumable', 'service')),

  constraint reagents_molecular_weight_nonnegative
    check (molecular_weight is null or molecular_weight >= 0),

  constraint reagents_package_quantity_nonnegative
    check (package_quantity is null or package_quantity >= 0),

  constraint reagents_package_cost_nonnegative
    check (package_cost is null or package_cost >= 0),

  constraint reagents_normalized_unit_cost_nonnegative
    check (normalized_unit_cost is null or normalized_unit_cost >= 0)
);

create index if not exists reagents_active_idx on public.reagents(active);
create index if not exists reagents_category_idx on public.reagents(category);
create index if not exists reagents_code_idx on public.reagents(code);

create table if not exists public.synthesis_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique not null,

  requester_user_id uuid references public.profiles(id),
  requester_name text not null,
  requester_email text not null,

  pi_name text not null,
  pi_email text not null,
  lab_name text,
  department text,

  sequence_original text not null,
  sequence_normalized text not null,
  sequence_length integer not null,

  n_terminal_form text,
  c_terminal_form text,

  synthesis_scale_mmol numeric not null,
  coupling_equivalents numeric not null,
  overage_percent numeric not null,
  coupling_mode text,
  double_coupling_positions jsonb,

  wash_mode text,
  wash_cycles integer,

  requested_completion_date date,
  preferred_schedule_1 text,
  preferred_schedule_2 text,

  priority text not null default 'normal',
  status text not null default 'pending_review',

  estimated_cost numeric,
  final_cost numeric,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  assigned_to uuid references public.profiles(id),
  admin_notes text,

  constraint synthesis_requests_status_check
    check (status in (
      'draft',
      'submitted',
      'pending_review',
      'changes_requested',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'rejected',
      'cancelled',
      'on_hold'
    )),

  constraint synthesis_requests_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),

  constraint synthesis_requests_sequence_length_nonnegative
    check (sequence_length >= 0),

  constraint synthesis_requests_scale_positive
    check (synthesis_scale_mmol > 0),

  constraint synthesis_requests_coupling_equivalents_positive
    check (coupling_equivalents > 0),

  constraint synthesis_requests_overage_nonnegative
    check (overage_percent >= 0),

  constraint synthesis_requests_wash_cycles_nonnegative
    check (wash_cycles is null or wash_cycles >= 0),

  constraint synthesis_requests_estimated_cost_nonnegative
    check (estimated_cost is null or estimated_cost >= 0),

  constraint synthesis_requests_final_cost_nonnegative
    check (final_cost is null or final_cost >= 0)
);

create index if not exists synthesis_requests_request_number_idx on public.synthesis_requests(request_number);
create index if not exists synthesis_requests_status_idx on public.synthesis_requests(status);
create index if not exists synthesis_requests_priority_idx on public.synthesis_requests(priority);
create index if not exists synthesis_requests_submitted_at_idx on public.synthesis_requests(submitted_at);
create index if not exists synthesis_requests_requester_email_idx on public.synthesis_requests(requester_email);
create index if not exists synthesis_requests_pi_email_idx on public.synthesis_requests(pi_email);

-- Snapshot of reagent quantities and prices used for each submitted request.
-- These rows preserve historical estimates even when the current reagent catalog changes.
create table if not exists public.request_reagents (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null references public.synthesis_requests(id) on delete cascade,
  reagent_id uuid references public.reagents(id),

  reagent_code text,
  reagent_name text not null,
  category text,

  source text not null,

  count_in_sequence integer,
  coupling_cycles integer,

  required_mmol numeric,
  required_quantity numeric,
  quantity_unit text,

  unit_cost_snapshot numeric,
  billing_unit_snapshot text,
  estimated_line_cost numeric,

  created_at timestamptz not null default now(),

  constraint request_reagents_source_check
    check (source in ('hematian_lab', 'requester_supplied', 'not_required')),

  constraint request_reagents_count_nonnegative
    check (count_in_sequence is null or count_in_sequence >= 0),

  constraint request_reagents_coupling_cycles_nonnegative
    check (coupling_cycles is null or coupling_cycles >= 0),

  constraint request_reagents_required_mmol_nonnegative
    check (required_mmol is null or required_mmol >= 0),

  constraint request_reagents_required_quantity_nonnegative
    check (required_quantity is null or required_quantity >= 0),

  constraint request_reagents_unit_cost_snapshot_nonnegative
    check (unit_cost_snapshot is null or unit_cost_snapshot >= 0),

  constraint request_reagents_estimated_line_cost_nonnegative
    check (estimated_line_cost is null or estimated_line_cost >= 0)
);

create index if not exists request_reagents_request_id_idx
  on public.request_reagents(request_id);

-- Status history for synthesis requests.
-- Records each request status transition for auditability and dashboard history views.
create table if not exists public.request_status_history (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null references public.synthesis_requests(id) on delete cascade,

  old_status text,
  new_status text not null,

  reason text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),

  constraint request_status_history_new_status_check
    check (new_status in (
      'draft',
      'submitted',
      'pending_review',
      'changes_requested',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'rejected',
      'cancelled',
      'on_hold'
    )),

  constraint request_status_history_old_status_check
    check (
      old_status is null or old_status in (
        'draft',
        'submitted',
        'pending_review',
        'changes_requested',
        'approved',
        'scheduled',
        'in_progress',
        'completed',
        'rejected',
        'cancelled',
        'on_hold'
      )
    )
);

create index if not exists request_status_history_request_id_idx
  on public.request_status_history(request_id);

-- Notes attached to synthesis requests.
-- Internal notes are visible only to reviewers/admins; external notes may be used later for requester-facing communication.
create table if not exists public.request_notes (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null references public.synthesis_requests(id) on delete cascade,

  note text not null,
  is_internal boolean not null default true,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists request_notes_request_id_idx
  on public.request_notes(request_id);

-- Price-change history for reagent and solvent catalog records.
-- These rows preserve an audit trail of package costs, normalized unit costs, active status, and effective dates.
create table if not exists public.reagent_price_history (
  id uuid primary key default gen_random_uuid(),

  reagent_id uuid not null references public.reagents(id) on delete cascade,

  field_changed text not null,
  old_value jsonb,
  new_value jsonb,

  effective_date date,
  reason text,

  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create index if not exists reagent_price_history_reagent_id_idx
  on public.reagent_price_history(reagent_id);
