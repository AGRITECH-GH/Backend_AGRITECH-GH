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
    "id": "cmngu98m3...",
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
    "id": "cmngu98m3...",
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

> On success, auto-login the user and redirect to dashboard.

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
Public. Sends a password reset link to the user's email.

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
🔒 Protected. For logged-in users who know their current password.

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

### Edit Profile
`PUT /api/auth/edit-profile`  
🔒 Protected. All roles.

**Body (all optional):**
```json
{
  "fullName": "Kofi Mensah Updated",
  "phoneNumber": "0241234567",
  "region": "Greater Accra",
  "bio": "Experienced agent (AGENT role only)"
}
```

**Response `200`:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "cmngu98m3...",
    "fullName": "Kofi Mensah Updated",
    "email": "kofi@example.com",
    "phoneNumber": "0241234567",
    "region": "Greater Accra",
    "role": "FARMER",
    "isVerified": true,
    "profilePhotoUrl": null
  }
}
```

---

### Request Email Change
`POST /api/auth/request-email-change`  
Protected. Sends a verification email to the new email address.

**Body:**
```json
{
  "newEmail": "newemail@example.com",
  "password": "currentpassword1"
}
```

**Response `200`:**
```json
{
  "message": "Verification email sent to your new email address"
}
```

> Password is required to confirm identity before changing email.

---

### Confirm Email Change
`POST /api/auth/confirm-email-change`  
Public. Called when user clicks the link in the verification email.

**Body:**
```json
{
  "token": "abc123...",
  "newEmail": "newemail@example.com"
}
```

**Response `200`:**
```json
{
  "message": "Email updated successfully"
}
```

> Frontend should read `token` and `email` from the URL query params on `/verify-email-change` page and POST them here. Redirect to login after success.

---

### Delete Account
`DELETE /api/auth/delete-account`  
Protected. User deletes their own account. Requires password confirmation.

**Body:**
```json
{
  "password": "mypassword1"
}
```

**Response `200`:**
```json
{
  "message": "Account deleted successfully"
}
```

> After success, clear the access token and redirect to home/login page.

---

## Listings

### Create Listing
`POST /api/listings`  
Protected. Roles: `FARMER`, `AGENT`  
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
  "categoryId": "cmngu98m3..."
}
```

Units: `KG`, `BAG`, `CRATE`, `PIECE`, `LITRE`, `BUNDLE`  
Listing types: `SELL`, `BARTER`, `BOTH`

---

### Get All Listings
`GET /api/listings`  
Public.

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

---

### Get Single Listing
`GET /api/listings/:id`  
Public.

---

### Update Listing
`PUT /api/listings/:id`  
Protected. Roles: `FARMER`, `AGENT`. Owner only.

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
Protected. Roles: `FARMER`, `AGENT`. Owner only.

---

### Upload Listing Images
`POST /api/listings/:id/images`  
Protected. Roles: `FARMER`, `AGENT`. Owner only.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `images` | File | Up to 5 images (jpg, jpeg, png, webp). Max 5MB each. |

---

## Cart

> Cart is for `BUYER` role only.

### Get Cart
`GET /api/cart`  
Protected. Role: `BUYER`

---

### Add Item to Cart
`POST /api/cart/items`  
Protected. Role: `BUYER`

**Body:**
```json
{
  "listingId": "cmngu98m3...",
  "quantity": 10
}
```

> If item already exists in cart, quantity is updated.

---

### Remove Item from Cart
`DELETE /api/cart/items/:listingId`  
Protected. Role: `BUYER`

---

### Clear Cart
`DELETE /api/cart`  
Protected. Role: `BUYER`

---

### Validate Cart
`GET /api/cart/validate`  
Protected. Role: `BUYER`  
Call this before checkout to check for issues.

**Response `200`:**
```json
{
  "valid": true,
  "issues": [],
  "total": 500
}
```

> Always validate cart before showing the checkout button.

---

## Orders

### Place Order (Checkout)
`POST /api/orders`  
Protected. Role: `BUYER`  
Email must be verified.

**Body:**
```json
{
  "paymentMethod": "CASH",
  "deliveryAddress": "Accra, Ghana",
  "notes": "Please call before delivery"
}
```

Payment methods: `MOMO`, `CASH`, `BARTER`, `CREDIT`

---

### Get My Orders
`GET /api/orders`  
Protected. All roles.

- `BUYER` sees their placed orders
- `FARMER`/`AGENT` sees orders for their listings

---

### Get Order by ID
`GET /api/orders/:id`  
Protected. Buyer, seller, agent, or admin only.

---

### Update Order Status
`PUT /api/orders/:id/status`  
Protected.

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
Protected.

**Body:**
```json
{
  "targetListingId": "cmngu98m3...",
  "offeredDescription": "I have 20kg of fresh yam",
  "offeredQuantity": 20,
  "message": "I would like to exchange my yam for your tomatoes"
}
```

For farmer-to-farmer barter:
```json
{
  "targetListingId": "cmngu98m3...",
  "offeredListingId": "cmngu98m3..."
}
```

---

### Get My Barter Requests
`GET /api/barter`  
Protected.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` |

---

### Update Barter Status
`PUT /api/barter/:id`  
Protected.

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
Protected. Requester only.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `images` | File | Up to 3 images. Max 5MB each. |

---

## Payments

### Initialize Payment
`POST /api/payments/initialize`  
Protected. Role: `BUYER`

**Body:**
```json
{
  "orderId": "cmngu98m3..."
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
Protected. Role: `BUYER`  
Call after user returns from Paystack checkout.

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
Protected.

---

### Paystack Webhook
`POST /api/payments/webhook`  
Public (Paystack only). Do not call from frontend.

---

## Agents

### Register as Agent
`POST /api/agents/register`  
Protected. Role: `AGENT`

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
Protected.

---

### Get Agent by ID
`GET /api/agents/:id`  
Protected.

---

### Register Farmer (as Agent)
`POST /api/agents/register-farmer`  
Protected. Role: `AGENT`  
Farmer is automatically pre-verified.

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
Protected. Role: `AGENT`

---

### Get Agent Requests
`GET /api/agents/requests`  
Protected. Role: `AGENT`

---

### Request an Agent
`POST /api/agents/:agentId/request`  
Protected. Role: `FARMER`

---

### Handle Agent Request
`PUT /api/agents/requests/:requestId`  
Protected. Role: `AGENT`

**Body:**
```json
{
  "status": "ACCEPTED"
}
```

---

### Assign Agent to Order
`PUT /api/agents/orders/:orderId/assign`  
Protected. Role: `ADMIN`

**Body:**
```json
{
  "agentId": "cmngu98m3..."
}
```

---

## Admin

> All admin endpoints require `ADMIN` role.

### Get Dashboard Stats
`GET /api/admin/stats`

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

> Use `isActive: false` to disable/revoke access.  
> Use `role: "ADMIN"` to transfer ownership to another user.

---

### Delete User
`DELETE /api/admin/users/:id`

---

### Get All Orders
`GET /api/admin/orders`

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
Public.

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

1. **Store `accessToken`** in memory or localStorage after login/register
2. **Send token** in every protected request: `Authorization: Bearer <accessToken>`
3. **Token expiry** — access token expires in 15 minutes. Call `POST /api/auth/refresh` when you get a `401` to get a new one
4. **Base URL** — `http://localhost:8000` for local, `https://api.agritechgh.me` for production
5. **Validate cart** before showing checkout button
6. **Payment flow** — redirect to `paymentUrl`, call verify endpoint when user returns
7. **Email verification** — show banner for `isVerified: false` users, block listing creation and orders
8. **Role-based UI** — check `user.role` after login to show correct dashboard
9. **Delete account** — always confirm with password before calling
10. **Email change** — on `/verify-email-change` page, read `token` and `email` from URL and POST to `confirm-email-change`