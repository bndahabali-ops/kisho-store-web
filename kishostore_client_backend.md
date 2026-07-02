# Kisho Store — Client-Facing Backend Architecture

## Final File Structure

```
kishostore_backend/
│
├── app.js                          ← nodemon entry point (delegates to server.js)
├── server.js                       ← full server setup (CORS, helmet, limiters, routes)
├── .env                            ← add ALLOWED_ORIGINS for production domain
│
├── models/
│   ├── Product.model.js            ← re-exports admin/schemas/product.schema.js
│   └── Order.model.js              ← NEW: full order schema with snapshots + indexes
│
├── middlewares/
│   ├── rateLimiter.middleware.js   ← NEW: 3-tier rate limiting strategy
│   ├── sanitize.middleware.js      ← NEW: NoSQL injection + XSS sanitizers
│   ├── error.middleware.js         ← existing global error handler (unchanged)
│   ├── protect.middleware.js       ← existing admin auth guard (unchanged)
│   └── admin.validation.js        ← existing login validation (unchanged)
│
└── modules/
    ├── store/                      ← NEW: entire public-facing store module
    │   ├── validations/
    │   │   └── order.validation.js
    │   ├── repositories/
    │   │   └── order.repository.js
    │   ├── services/
    │   │   ├── product.service.js
    │   │   └── order.service.js    ← atomic stock validation + transaction
    │   ├── controllers/
    │   │   ├── product.controller.js
    │   │   └── order.controller.js
    │   └── routes/
    │       ├── product.router.js
    │       └── order.router.js
    │
    └── admin/
        ├── services/
        │   └── order.service.js    ← NEW: status lifecycle management
        ├── controllers/
        │   └── order.controller.js ← NEW
        └── router/
            └── order.router.js     ← NEW: /api/admin/orders (protected)
```

---

## API Endpoints

### 🌐 Public Store (No Auth Required)

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/store/products` | 60/5min | List products — pagination, filter, search |
| `GET` | `/api/store/products/:id` | 200/10min | Single product detail |
| `POST` | `/api/store/orders` | **10/15min** | Place an order (checkout) |
| `GET` | `/api/health` | none | Health check |

#### Query Params for `GET /api/store/products`:
| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `category` | string | `تيشيرتات` | Filter by category (case-insensitive) |
| `search` | string | `قميص` | Text search on title |
| `minPrice` | number | `150` | Min base price |
| `maxPrice` | number | `500` | Max base price |
| `page` | number | `1` | Page number (default: 1) |
| `limit` | number | `12` | Items per page (max: 50, default: 12) |

#### `POST /api/store/orders` — Request Body:
```json
{
  "items": [
    {
      "productId": "664abc123def456789012345",
      "color": "Wine Red",
      "size": "Large",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "fullName": "Ahmed Mohamed",
    "phone": "01012345678",
    "city": "Cairo",
    "address": "123 Tahrir St, Dokki",
    "email": "ahmed@example.com",
    "notes": "Call before delivery"
  },
  "paymentMethod": "cash_on_delivery"
}
```

#### `POST /api/store/orders` — Success Response (201):
```json
{
  "status": "success",
  "message": "Order placed successfully! We will contact you to confirm.",
  "data": {
    "orderRef": "ORD-1750598000000-A3F2",
    "totalAmount": 598.00,
    "status": "pending",
    "createdAt": "2026-06-22T15:30:00.000Z"
  }
}
```

---

### 🔐 Admin Orders (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/orders` | List all orders (`?status=pending&page=1&limit=20`) |
| `GET` | `/api/admin/orders/search` | Search by customer phone (`?phone=01012345678`) |
| `GET` | `/api/admin/orders/:id` | Full order detail with product names |
| `PATCH` | `/api/admin/orders/:id/status` | Update order status + optional admin note |

#### Status Lifecycle (enforced — no skipping):
```
pending → confirmed → processing → shipped → delivered
   ↓            ↓           ↓
cancelled   cancelled   cancelled
```
> `delivered`, `cancelled`, and `refunded` are **terminal states** — no further transitions allowed.

---

## Security Architecture

```
Request
  │
  ├─ CORS whitelist (trusted origins only)
  ├─ Helmet (secure HTTP headers)
  ├─ Body size limit (15kb)
  ├─ NoSQL injection sanitizer (strips $ and . keys)
  ├─ XSS sanitizer (escapes HTML chars)
  ├─ General rate limiter (200/10min — all /api/* routes)
  │
  ├─ [Order route] ─── orderLimiter (10/15min) ──→ Joi validation ──→ controller
  ├─ [Search route] ── searchLimiter (60/5min) ──→ controller
  └─ [Admin routes] ── protect middleware ────────→ restrictToAdmin ──→ controller
```

---

## Stock Validation — Race Condition Prevention

The `POST /api/store/orders` endpoint uses a **MongoDB Transaction** to guarantee atomicity:

```
1. Open session + startTransaction()
2. Fetch all products in ONE query (batched, not N+1)
3. For each item: atomic findOneAndUpdate with $elemMatch stock guard
   → Filter: { stock: { $gte: quantity } }  ← only matches if stock is sufficient
   → Update: { $inc: { "variants.$.stock": -quantity } }
4. If ANY item returns null → abortTransaction() → 409 Conflict
5. If all succeed → create Order document (inside same session)
6. commitTransaction()
7. finally: endSession() (always releases connection)
```

> **Two customers buying the last item simultaneously**: one transaction commits, the other's `$elemMatch` filter returns `null` → it aborts and receives a `409 Conflict` response. No overselling is possible.

---

## Production Deployment Checklist

> [!IMPORTANT]
> Before going live, complete these steps:

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Add your production domain to `ALLOWED_ORIGINS` in `.env`
- [ ] Ensure MongoDB Atlas cluster is **M10+** (M0 free tier supports transactions but with limits)
- [ ] Set a strong `JWT_SECRET` (min 64 random chars)
- [ ] Enable MongoDB Atlas IP whitelist (allow only your server IP)
- [ ] Set up a process manager (PM2) with `pm2 start app.js`

> [!WARNING]
> MongoDB Transactions require a **Replica Set**. Atlas (any tier) uses replica sets by default. For local development with a standalone `mongod`, you must first run `rs.initiate()` or use `mongod --replSet rs0`.
