-- Enforce explicit, valid state lifecycles
ALTER TABLE tenant_leases 
  ADD CONSTRAINT chk_lease_status 
  CHECK (lease_status IN ('ACTIVE', 'GRACE_PERIOD', 'OFFBOARDING_LOCKED', 'OFFBOARDED'));
