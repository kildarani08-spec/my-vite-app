# Backend Setup (PHP + MySQL)

This backend implements a real ecommerce API used by the frontend in this repo.

## What is included

- Auth: `register.php`, `login.php`, `logout.php`, `forgot_password.php`, `reset_password.php`
- Storefront: `products.php`, `products_detail.php`, `review.php`, `wishlist.php`, `cart.php`, `checkout.php`, `orders.php`, `order.php`, `profile.php`, `user_addresses.php`
- Admin: `admin_dashboard.php`, `admin_products.php`, `admin_orders.php`, `admin_users.php`, `admin_reviews.php`, `admin_site_content.php`, `admin_audit_logs.php`, `admin_settings.php`, `admin_process_outbox.php`, `admin_notifications.php`
- CMS/public content: `site_content.php`
- Integrations: `payment_prepare.php`, `payment_confirm.php`, `payment_webhook.php`
- Workers: `worker_outbox.php`

## 1) Import database schema

Run the SQL file:

- `backend/database/schema.sql`

This creates all ecommerce tables and seeds:

- Admin user:
  - email: `admin@myshop.com`
  - password: `Admin@123`

## 2) Deploy API folder

Copy `backend/ecommerce` into your PHP server root as:

- `http://localhost/ecommerce`

For example on XAMPP:

- `htdocs/ecommerce`

## 3) Configure DB connection

Update:

- `backend/ecommerce/lib/config.php`

Set your MySQL credentials:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

## 4) CORS origin

If your Vite frontend uses another port or domain, update:

- `CORS_ORIGIN` in `backend/ecommerce/lib/config.php`

Current value:

- `http://localhost:5173`

## 5) Frontend API base

Frontend currently calls:

- `http://localhost/ecommerce`

No changes required if you deploy exactly to `/ecommerce`.

## 6) Payment integration (sandbox, no real charge)

This project now uses a full payment flow without product-level payment offers.
Order totals are based on item price + shipping only.

Sandbox mode is enabled by default and lets you explore integration safely:

- `payment_prepare.php` creates a checkout session
- frontend continues to `payment_confirm.php`
- no real money is charged in sandbox mode

To configure from Admin:

- Open Admin -> Operational Settings -> Payment Gateway
- Keep provider as `razorpay`
- Enable `Sandbox mode (simulate payment, no real charge)`

If you want real Razorpay test checkout instead of simulated mode:

- Disable sandbox mode in Admin Settings
- Set Razorpay credentials in `backend/ecommerce/lib/config.php`
- Keep `paymentGateway.provider` as `razorpay`

Then the flow uses Razorpay order creation + signature verification.

## 7) Razorpay credentials (for real gateway mode)

Update:

- `backend/ecommerce/lib/config.php`

Set:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Gateway flow endpoints:

- `payment_prepare.php` (creates Razorpay order)
- `payment_confirm.php` (verifies signature and places final order)

## Notes

- Token auth is database-backed via `auth_tokens`.
- Auth endpoints include database-backed rate limiting for login/register/forgot-password.
- Expired auth tokens are cleaned automatically during auth flow and token creation.
- Password reset tokens are hashed and stored in `password_resets` with expiry and one-time use enforcement.
- Site-wide admin-editable content is persisted in `settings` (`site_content` key).
- Operational settings are persisted in `settings` (`operational_settings` key).
- Checkout uses admin-managed shipping rules from site content.
- Payment methods are also admin-managed from site content.
- Checkout is idempotent using `idempotencyKey` (form field) or `Idempotency-Key` (header), backed by `checkout_requests`.
- Admin write operations are audit-logged into `admin_audit_logs`.
- Payment webhooks are HMAC-verified (`X-Signature`) using Admin Settings secret when webhook mode is enabled.
- Customer and payment lifecycle events are stored in `order_events` and exposed in order detail APIs.
- Transactional emails are queued into `notification_outbox`; admin can process queue via `admin_process_outbox.php`.
- Notification provider can be configured from Admin Settings: `mail`, `sendgrid`, or `mailgun`.
- For SendGrid: set `notifications.provider=sendgrid` and `notifications.sendgridApiKey`.
- For Mailgun: set `notifications.provider=mailgun`, `notifications.mailgunDomain`, and `notifications.mailgunApiKey`.
- Outbox retries use scheduled `next_attempt_at` with configurable backoff/max attempts from Admin Settings Jobs section.
- `worker_outbox.php` is secured via `X-Worker-Token` and intended for cron/automation-driven queue processing.
- Maintenance mode flag in Admin Settings blocks storefront API endpoints with HTTP 503 while admin endpoints remain accessible.
