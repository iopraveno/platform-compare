# Platform review

Password-protected presentation comparing Mars, WooCommerce and Shopify Grow for the Czech D2C store.

`index.html` holds only the encrypted presentation (AES-256-GCM, key derived from the password with PBKDF2-SHA256, 600,000 iterations) and a small unlock page. The presentation is decrypted in the browser after the password is entered. The password is not stored anywhere in this repository.

## Deploy

Any static host works. On Vercel: import this repository as a new project, framework preset "Other", no build command, output directory `.` (root). Every push to `main` redeploys.

## Update the presentation

The plain HTML lives outside this repository, because the repository is public.

```bash
DECK_PASSWORD='the password' node scripts/encrypt.mjs path/to/presentation.html
git add index.html && git commit -m "Update presentation" && git push
```

To change the password, run the same command with the new password.
