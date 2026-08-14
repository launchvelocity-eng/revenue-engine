        const data = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'mongealfredoantonio@gmail.com', // Must match your Resend account email
            subject: 'New LaunchVelocity Waitlist Signup!',
            html: `<p>New signup received: <strong>${email}</strong></p>`
        });
