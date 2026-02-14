# Chosen Bride Tabernacle — Church Financial Management System (Static)

A **production-ready static web app** for church treasurers, built with **HTML + CSS + Vanilla JavaScript** and **LocalStorage**.

## Pages

- `index.html` (auto-redirects to Login or Dashboard)
- `login.html`
- `dashboard.html`
- `income.html`
- `expenses.html`
- `payouts.html`
- `reports.html`
- `settings.html`

## Default Login

- **Username:** `admin`
- **Password:** `admin123`

After login, go to **Settings → Security** to change the password.

## Data Storage (Important)

- This system uses **LocalStorage** in the browser.
- **Data stays on the device you create it on.**
- **Desktop and Mobile do NOT sync automatically.**
- To move data (and updated passwords) from Desktop to Mobile, you must use **Backup & Restore** in Settings.

## Currency

- Default currency is **Uganda Shillings (UGX)**.

## Backup & Restore (Very Important)

### Export Backup

- Go to `settings.html`
- Click **Export All Data (JSON)**
- Store the file somewhere safe (Google Drive / USB / etc.)

### Restore Backup

- Go to `settings.html`
- Use **Import JSON Backup**
- Confirm import (this overwrites current data)

## Exporting to CSV

- Income / expenses / payouts pages include **Export CSV** buttons.
- Reports page can export the currently generated report to CSV.

## Budget Planning

- Go to `settings.html` → **Budget Planning**
- Choose a month and enter a budget per expense category
- Expenses page will show **Budgeted vs Actual** and highlight overspending

## Receipt Uploads

- On Expenses page, you can upload a receipt image/PDF.
- Receipts are stored as **Base64** inside LocalStorage.
- For reliability, the system enforces a strict limit of **500KB max** per file to prevent storage exhaustion.

## Logo Customization

- The system now uses a local logo file located at `images/logo.png`.
- You can replace this file with any other PNG image (rename it to `logo.png`) to change the branding.


## Customize Categories

- Go to `settings.html` → **Categories**
- Edit the lists (one category per line)
- Click **Save Categories**

These categories will populate the dropdowns on Income and Expenses.

## Deploy on GitHub Pages

1. Create a GitHub repository (e.g. `cbt-finance`).
2. Upload all files in this project to the repo root.
3. In GitHub:
   - **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` and folder `/ (root)`
4. Wait for GitHub Pages to publish.

Your app will be available at something like:

`https://<your-username>.github.io/<repo-name>/`

Note: This app uses `crypto.subtle` for password hashing, which works on **GitHub Pages (HTTPS)**. If you open files directly with `file://`, some browsers may block crypto APIs.

## Notes

- This is a static app — no server required.
- If you clear browser data, you must restore from JSON backup.

