# ParishLife: where we are (23 November 2026)

## Done ✅
- The website is live at **parish-life.org**, on Azure.
- Sign-in with password + authenticator code.
- Cloudflare bot check (Turnstile) on sign-in, sign-up and public forms.
- **Sign up with Google** (published to everyone) and **with Microsoft**.
- **Email codes** for confirming an account (Resend), plus DMARC protection.
- **privacy@parish-life.org** forwards to parishlifeprimary@gmail.com.
- **Privacy policy** and **Terms of use** pages.
- **Email and phone push notifications**: tested on your iPhone with the "Send a test notification" button.
- **Your decisions of 21–23 November**, built and live: yearly receipt numbers, Members only, calendar delegates, archdiocese checklists, priest workflows, billing representative, hiding counts under 5, automatic deletion of old notices, and only the bishop or ParishLife registers a church, then hands control to the priest.
- **Backups:** the database can be restored to any moment in the last 30 days, and deleted files for 30 days.
- **Test database** (`ParishLifeTest`), separate from the real one and empty.
- All code is on GitHub (`fullstack-integration`).

## Still to do
0. **Free coverage** is built (not live yet): Administration → Access and billing → "Grant free coverage". Next after deploy: the rest of your fix list (setup checklist, forms, sign-in, spacing).
1. **WhatsApp:** you set up Meta Business, a WhatsApp number, two message templates and a token. Then the Azure chat switches it on.
2. **Google Maps** on the public pages: you said you'll add it.
3. **Restore test every 3 months:** not scheduled yet.
4. **Live tests:** built, and they use only the test database. To run them, open the database firewall for your computer (Azure chat), then follow docs/operations/live-tests.md.
5. **Screens not built yet:** the bishop's calendar editor and delegate list, the archdiocese checklist editor, and the billing representative.
6. **With Georges:** make `fullstack-integration` the main branch and delete the old branches.

## Good to know
- Resend's free plan allows 100 emails a day. Large announcements may need the $20/month plan.
- Code emails may land in Junk at first. This should improve over time.
- The 30-day backups cost a little extra for backup storage (small while the data is small).
