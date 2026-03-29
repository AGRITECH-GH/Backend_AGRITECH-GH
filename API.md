# AgriTech GH — Backend API Documentation

Base URL (Development): `http://localhost:8000`  
Base URL (Production): `https://api.agritechgh.me`

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <accessToken>
```

---

## Table of Contents
- [Auth](#auth)
- [Listings](#listings)
- [Cart](#cart)
- [Orders](#orders)
- [Barter](#barter)
- [Payments](#payments)
- [Agents](#agents)
- [Admin](#admin)
- [Categories](#categories)
- [Roles](#roles)
- [Error Responses](#error-responses)

---

## Auth

### Register
`POST /api/auth/register`  
Public. Creates a new user account.

**Body:**
```json
{
  "fullName": "Kofi Mensah",
  "email": "kofi@example.com",
  "password": "mypassword1",
  "role": "FARMER"
}
```

Roles: `FARMER`, `BUYER`, `AGENT`, `ADMIN`

For `AGENT` role, also include:
```json
{
  "assignedRegion": "Greater Accra",
  "commissionRate": 5.0,
  "bio": "Experienced field agent"
}
```

**Response `201`:**
```json
{
  "message": "Account created successfully",
  "accessToken": "eyJ...",
  "user": {
    "id": "clh3z2k...",
    "fullName": "Kofi Mensah",
    "email": "kofi@example.com",
    "role": "FARMER",
    "isVerified": false
  }
}
```

---

### Login
`POST /api/auth/login`  
Public.

**Body:**
```json
{
  "email": "kofi@example.com",
  "password": "mypassword1",
  "rememberMe": false
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJ...",
  "user": {
    "id": "clh3z2k...",
    "fullName": "Kofi Mensah",
    "email": "kofi@example.com",
    "role": "FARMER",
    "isVerified": true
  }
}
```

> Refresh token is set as an httpOnly cookie automatically.

---

### Refresh Token
`POST /api/auth/refresh`  
Public. Uses the httpOnly refresh token cookie to issue a new access token.

**Response `200`:**
```json
{
  "accessToken": "eyJ..."
}
```

---

### Logout
`POST /api/auth/logout`  
Public. Clears the refresh token cookie.

**Response `200`:**
```json
{
  "message": "Logged out successfully"
}
```

---

### Verify Email
`POST /api/auth/verify-email`  
Public. Verifies a user's email using the token from the verification email.

**Body:**
```json
{
  "token": "abc123..."
}
```

**Response `200`:**
```json
{
  "message": "Email verified successfully",
  "accessToken": "eyJ...",
  "user": { ... }
}
```

> On success, auto-login the user — redirect to dashboard.

---

### Resend Verification Email
`POST /api/auth/resend-verification`  
Public.

**Body:**
```json
{
  "email": "kofi@example.com"
}
```

**Response `200`:**
```json
{
  "message": "If that email exists, a verification link has been sent"
}
```

---

### Forgot Password
`POST /api/auth/forgot-password`  
Public.

**Body:**
```json
{
  "email": "kofi@example.com"
}
```

**Response `200`:**
```json
{
  "message": "If that email exists, a reset link has been sent"
}
```

---

### Reset Password
`POST /api/auth/reset-password`  
Public. Uses token from the password reset email.

**Body:**
```json
{
  "token": "abc123...",
  "password": "newpassword1"
}
```

**Response `200`:**
```json
{
  "message": "Password reset successfully"
}
```

---

### Change Password
`PUT /api/auth/change-password`  
🔒 Protected.

**Body:**
```json
{
  "currentPassword": "oldpassword1",
  "newPassword": "newpassword1"
}
```

**Response `200`:**
```json
{
  "message": "Password changed successfully"
}
```

---

## Listings

### Create Listing
`POST /api/listings`  
🔒 Protected. Roles: `FARMER`, `AGENT`  
⚠️ Email must be verified.

**Body:**
```json
{
  "title": "Fresh Tomatoes",
  "description": "Organic tomatoes from Volta Region",
  "pricePerUnit": 50,
  "quantity": 100,
  "quantityAvailable": 100,
  "unit": "KG",
  "location": "Ho, Volta Region",
  "listingType": "SELL",
  "categoryId": "clh3z2k..."
}
```

Units: `KG`, `BAG`, `CRATE`, `PIECE`, `LITRE`, `BUNDLE`  
Listing types: `SELL`, `BARTER`, `BOTH`

**Response `201`:**
```json
{
  "message": "Listing created successfully",
  "listing": { ... }
}
```

---

### Get All Listings
`GET /api/listings`  
Public. Supports filters and pagination.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by title |
| `category` | string | Filter by category ID |
| `listingType` | string | `SELL`, `BARTER`, `BOTH` |
| `location` | string | Filter by location |
| `minPrice` | number | Minimum price per unit |
| `maxPrice` | number | Maximum price per unit |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

**Response `200`:**
```json
{
  "listings": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### Get Single Listing
`GET /api/listings/:id`  
Public.

**Response `200`:**
```json
{
  "listing": {
    "id": "clh3z2k...",
    "title": "Fresh Tomatoes",
    "pricePerUnit": "50",
    "quantityAvailable": "100",
    "unit": "KG",
    "status": "ACTIVE",
    "seller": { "id": "...", "fullName": "Kofi Mensah" },
    "category": { ... },
    "images": [ ... ]
  }
}
```

---

### Update Listing
`PUT /api/listings/:id`  
🔒 Protected. Roles: `FARMER`, `AGENT`. Owner only.

**Body (all optional):**
```json
{
  "title": "Updated Title",
  "pricePerUnit": 60,
  "quantityAvailable": 80,
  "status": "PAUSED"
}
```

Statuses: `ACTIVE`, `SOLD`, `EXPIRED`, `PAUSED`

---

### Delete Listing
`DELETE /api/listings/:id`  
🔒 Protected. Roles: `FARMER`, `AGENT`. Owner only.

**Response `200`:**
```json
{
  "message": "Listing deleted successfully"
}
```

---

### Upload Listing Images
`POST /api/listings/:id/images`  
🔒 Protected. Roles: `FARMER`, `AGENT`. Owner only.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `images` | File | Up to 5 images (jpg, jpeg, png, webp). Max 5MB each. |

**Response `201`:**
```json
{
  "message": "Images uploaded successfully",
  "images": [
    {
      "id": "clh3z2k...",
      "imageUrl": "https://res.cloudinary.com/...",
      "isPrimary": true,
      "sortOrder": 0
    }
  ]
}
```

---

## Cart

> Cart is for `BUYER` role only.

### Get Cart
`GET /api/cart`  
🔒 Protected. Role: `BUYER`

**Response `200`:**
```json
{
  "cart": {
    "id": "clh3z2k...",
    "items": [
      {
        "id": "...",
        "quantity": "10",
        "listing": {
          "id": "...",
          "title": "Fresh Tomatoes",
          "pricePerUnit": "50",
          "quantityAvailable": "90",
          "unit": "KG",
          "status": "ACTIVE",
          "seller": { "id": "...", "fullName": "Kofi Mensah" }
        }
      }
    ],
    "total": 500
  }
}
```

---

### Add Item to Cart
`POST /api/cart/items`  
🔒 Protected. Role: `BUYER`

**Body:**
```json
{
  "listingId": "clh3z2k...",
  "quantity": 10
}
```

> If item already exists in cart, quantity is updated.

---

### Remove Item from Cart
`DELETE /api/cart/items/:listingId`  
🔒 Protected. Role: `BUYER`

---

### Clear Cart
`DELETE /api/cart`  
🔒 Protected. Role: `BUYER`

---

### Validate Cart
`GET /api/cart/validate`  
🔒 Protected. Role: `BUYER`  
Call this before checkout to check for issues (price changes, out of stock).

**Response `200`:**
```json
{
  "valid": true,
  "issues": [],
  "total": 500
}
```

If issues exist:
```json
{
  "valid": false,
  "issues": [
    {
      "listingId": "clh3z2k...",
      "title": "Fresh Tomatoes",
      "issue": "Only 5 KG available, you requested 10"
    }
  ],
  "total": 0
}
```

> Always validate cart before showing the checkout button.

---

## Orders

### Place Order (Checkout)
`POST /api/orders`  
🔒 Protected. Role: `BUYER`  
⚠️ Email must be verified.  
Places an order for all items in cart. Cart is cleared after successful order.

**Body:**
```json
{
  "paymentMethod": "CASH",
  "deliveryAddress": "Accra, Ghana",
  "notes": "Please call before delivery"
}
```

Payment methods: `MOMO`, `CASH`, `BARTER`, `CREDIT`

**Response `201`:**
```json
{
  "message": "Order placed successfully",
  "order": {
    "id": "clh3z2k...",
    "totalPrice": "600",
    "status": "PENDING",
    "items": [ ... ],
    "buyer": { ... }
  }
}
```

---

### Get My Orders
`GET /api/orders`  
🔒 Protected. All roles.

- `BUYER` sees their placed orders
- `FARMER`/`AGENT` sees orders for their listings

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status |
| `page` | number | Page number |
| `limit` | number | Results per page |

---

### Get Order by ID
`GET /api/orders/:id`  
🔒 Protected. Buyer, seller, agent, or admin only.

---

### Update Order Status
`PUT /api/orders/:id/status`  
🔒 Protected.

**Body:**
```json
{
  "status": "CONFIRMED"
}
```

**Who can set what:**
| Role | Allowed statuses |
|------|-----------------|
| `FARMER`/`AGENT` | `CONFIRMED`, `DISPATCHED`, `DELIVERED`, `CANCELLED` |
| `BUYER` | `CANCELLED` (only if status is `PENDING`) |

**Order lifecycle:**
```
PENDING → CONFIRMED → DISPATCHED → DELIVERED
                ↘ CANCELLED
```

> When cancelled, stock is automatically restored.

---

## Barter

### Create Barter Request
`POST /api/barter`  
🔒 Protected.

**Body:**
```json
{
  "targetListingId": "clh3z2k...",
  "offeredDescription": "I have 20kg of fresh yam",
  "offeredQuantity": 20,
  "message": "I would like to exchange my yam for your tomatoes"
}
```

For farmer-to-farmer barter, include `offeredListingId` instead of description:
```json
{
  "targetListingId": "clh3z2k...",
  "offeredListingId": "clh3z2k..."
}
```

---

### Get My Barter Requests
`GET /api/barter`  
🔒 Protected. Returns requests you sent and requests for your listings.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` |

---

### Update Barter Status
`PUT /api/barter/:id`  
🔒 Protected.

**Body:**
```json
{
  "status": "ACCEPTED"
}
```

| Role | Allowed |
|------|---------|
| Listing owner | `ACCEPTED`, `REJECTED` |
| Requester | `CANCELLED` |

---

### Upload Barter Images
`POST /api/barter/:id/images`  
🔒 Protected. Requester only.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `images` | File | Up to 3 images. Max 5MB each. |

---

## Payments

### Initialize Payment
`POST /api/payments/initialize`  
🔒 Protected. Role: `BUYER`

**Body:**
```json
{
  "orderId": "clh3z2k..."
}
```

**Response `200`:**
```json
{
  "message": "Payment initialized",
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "AGRI-1234567890-ABCD1234",
  "amount": 600,
  "currency": "GHS"
}
```

> Redirect user to `paymentUrl` to complete payment.

---

### Verify Payment
`GET /api/payments/verify/:reference`  
🔒 Protected. Role: `BUYER`  
Call this after user returns from Paystack checkout.

**Response `200`:**
```json
{
  "message": "Payment verified successfully",
  "status": "SUCCESS"
}
```

---

### Get Payment Status
`GET /api/payments/order/:orderId`  
🔒 Protected.

---

### Paystack Webhook
`POST /api/payments/webhook`  
Public (Paystack only). Do not call this from frontend.

---

## Agents

### Register as Agent
`POST /api/agents/register`  
🔒 Protected. Role: `AGENT`  
Creates an agent profile for an already-registered AGENT user.

**Body:**
```json
{
  "assignedRegion": "Greater Accra",
  "commissionRate": 5.0,
  "bio": "Experienced field agent"
}
```

---

### Get All Agents
`GET /api/agents`  
🔒 Protected.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `region` | string | Filter by region |
| `page` | number | Page number |
| `limit` | number | Results per page |

---

### Get Agent by ID
`GET /api/agents/:id`  
🔒 Protected.

---

### Register Farmer (as Agent)
`POST /api/agents/register-farmer`  
🔒 Protected. Role: `AGENT`  
Agent registers a farmer on their behalf. Farmer is pre-verified.

**Body:**
```json
{
  "fullName": "Yaw Farmer",
  "email": "yaw@example.com",
  "password": "mypassword1",
  "region": "Ashanti",
  "phoneNumber": "0241234567"
}
```

---

### Get My Farmers
`GET /api/agents/my-farmers`  
🔒 Protected. Role: `AGENT`  
Returns all farmers managed by the logged-in agent including their listings.

---

### Get Agent Requests
`GET /api/agents/requests`  
🔒 Protected. Role: `AGENT`  
Returns pending farmer requests to be managed by this agent.

---

### Request an Agent (Farmer)
`POST /api/agents/:agentId/request`  
🔒 Protected. Role: `FARMER`  
Farmer sends a request to be managed by an agent.

---

### Handle Agent Request
`PUT /api/agents/requests/:requestId`  
🔒 Protected. Role: `AGENT`

**Body:**
```json
{
  "status": "ACCEPTED"
}
```

Statuses: `ACCEPTED`, `REJECTED`

---

### Assign Agent to Order
`PUT /api/agents/orders/:orderId/assign`  
🔒 Protected. Role: `ADMIN`

**Body:**
```json
{
  "agentId": "clh3z2k..."
}
```

---

## Admin

> All admin endpoints require `ADMIN` role.

### Get Dashboard Stats
`GET /api/admin/stats`

**Response `200`:**
```json
{
  "stats": {
    "totalUsers": 50,
    "totalListings": 120,
    "totalOrders": 80,
    "totalBarterRequests": 15
  },
  "usersByRole": [ ... ],
  "recentOrders": [ ... ]
}
```

---

### Get All Users
`GET /api/admin/users`

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `role` | string | Filter by role |
| `isActive` | boolean | Filter by active status |
| `search` | string | Search by name or email |
| `page` | number | Page number |
| `limit` | number | Results per page |

---

### Update User
`PUT /api/admin/users/:id`

**Body (all optional):**
```json
{
  "isActive": false,
  "role": "AGENT",
  "isVerified": true
}
```

> Use `isActive: false` to disable a user's account.

---

### Delete User
`DELETE /api/admin/users/:id`

---

### Get All Orders
`GET /api/admin/orders`

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status |
| `page` | number | Page number |
| `limit` | number | Results per page |

---

### Create Category
`POST /api/admin/categories`

**Body:**
```json
{
  "name": "Vegetables",
  "description": "Fresh vegetables",
  "iconUrl": "https://...",
  "parentId": null
}
```

---

### Get Categories
`GET /api/admin/categories`  
Also available publicly at `GET /api/categories`

---

### Update Category
`PUT /api/admin/categories/:id`

**Body (all optional):**
```json
{
  "name": "Updated Name",
  "isActive": false
}
```

---

## Categories

### Get All Categories
`GET /api/categories`  
Public. Returns active categories with their subcategories.

**Response `200`:**
```json
{
  "categories": [
    {
      "id": "clh3z2k...",
      "name": "Vegetables",
      "description": "Fresh vegetables",
      "children": [
        { "id": "...", "name": "Leafy Greens" }
      ]
    }
  ]
}
```

---

## Roles

| Role | Description |
|------|-------------|
| `FARMER` | Creates and manages listings, manages orders |
| `BUYER` | Browses listings, manages cart, places orders |
| `AGENT` | Registers and manages farmers, handles listings on their behalf |
| `ADMIN` | Full system access, manages users and categories |

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — not allowed to perform this action |
| `404` | Not found |
| `409` | Conflict — resource already exists |
| `429` | Too many requests — rate limited |
| `500` | Internal server error |

**Error format:**
```json
{
  "message": "Description of what went wrong"
}
```

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@agritechgh.me` | `Admin1234` |

> Other roles: register via `POST /api/auth/register`

---

## Notes for Frontend

1. **Store the `accessToken`** in memory or localStorage after login/register
2. **Send the token** in every protected request: `Authorization: Bearer <accessToken>`
3. **Refresh token** is handled via httpOnly cookie automatically — call `POST /api/auth/refresh` when you get a `401` response
4. **Cart base URL** — use `http://localhost:8000` for local development
5. **Validate cart** before showing checkout button
6. **After payment** — redirect user to Paystack URL, then call verify endpoint when they return
7. **Email verification** — show a banner for `isVerified: false` users, block listing creation and orders
8. **Role-based UI** — check `user.role` after login to show the correct dashboard
