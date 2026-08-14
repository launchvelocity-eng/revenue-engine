        INSERT INTO storage_tiers (tier_name, price_monthly, storage_gb, retention_days, security_level)
        VALUES 
        ('Tier 1 - Standard', 9.99, 100, 365, 'AES-256'),
        ('Tier 2 - Professional', 29.99, 500, 730, 'AES-256 + MFA'),
        ('Tier 3 - Enterprise', 75000.00, 2000, 180, 'AES-256 + MFA + Hardware-HSM');
