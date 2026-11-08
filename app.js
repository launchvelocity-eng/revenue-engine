            // B. Confirmation to User (e.g., mongealfredoantonio@gmail.com)
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: resendHeaders,
              body: JSON.stringify({
                from: 'Launch Velocity Security <onboarding@resend.dev>',
                to: [email],
                subject: 'Launch Velocity | Vault Provisioning & Access Key Confirmation',
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; background: #090d16; color: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #38bdf8; margin-top: 0;">LAUNCH VELOCITY</h2>
                    <p style="font-size: 16px; color: #e2e8f0;">Hello,</p>
                    <p style="color: #cbd5e1; line-height: 1.5;">
                      Your enterprise storage partition request for <strong>${company}</strong> has been securely logged and provisioned on our zero-trust air-gapped architecture.
                    </p>
                    <div style="background: #1e293b; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #334155;">
                      <p style="margin: 0; font-size: 14px; color: #94a3b8;">Your Hardware-Backed Tenant Access Key:</p>
                      <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 18px; color: #38bdf8;">${tenantKeyId}</p>
                    </div>
                    <p style="font-size: 13px; color: #64748b; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 15px;">
                      Launch Velocity Security Infrastructure — Confidential Enterprise Notice
                    </p>
                  </div>
                `
              })
            });
