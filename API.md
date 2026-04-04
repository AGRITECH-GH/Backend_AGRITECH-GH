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
- [Notes for Frontend](#notes-for-frontend)

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
Protected. For logged-in users who know their current password.

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
Protected. All roles. Updates name, phone, region, and bio.

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

### Upload Profile Photo
`POST /api/auth/profile-photo`  
Protected. All roles.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `photo` | File | Single image (jpg, jpeg, png, webp). Max 3MB. |

**Response `200`:**
```json
{
  "message": "Profile photo updated successfully",
  "user": {
    "id": "cmngu98m3...",
    "fullName": "Kofi Mensah",
    "email": "kofi@example.com",
    "profilePhotoUrl": "https://res.cloudinary.com/..."
  }
}
```

> The `profilePhotoUrl` is returned on every login — use it to display the user's avatar.

---

### Remove Profile Photo
`DELETE /api/auth/profile-photo`  
Protected. All roles.

**Response `200`:**
```json
{
  "message": "Profile photo removed successfully"
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

> Frontend should read `token` and `email` from URL query params on `/verify-email-change` page and POST them here. Redirect to login after success.

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
    "id": "cmngu98m3...",
    "title": "Fresh Tomatoes",
    "pricePerUnit": "50",
    "quantity": "100",
    "quantityAvailable": "100",
    "unit": "KG",
    "listingType": "SELL",
    "status": "ACTIVE",
    "location": "Ho, Volta Region",
    "seller": { "id": "...", "fullName": "Kofi Mensah", "email": "..." },
    "category": { ... },
    "images": [ ... ]
  }
}
```

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

**Response `200`:**
```json
{
  "message": "Listing deleted successfully"
}
```

---

### Upload Listing Images
`POST /api/listings/:id/images`  
Protected. Roles: `FARMER`, `AGENT`. Owner only.

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
      "id": "cmngu98m3...",
      "imageUrl": "https://res.cloudinary.com/...",
      "isPrimary": true,
      "sortOrder": 0
    }
  ]
}
```

> The first image uploaded is automatically set as primary. Use `isPrimary: true` to show the main listing image.

---

## Cart

> Cart is for `BUYER` role only.

### Get Cart
`GET /api/cart`  
Protected. Role: `BUYER`

**Response `200`:**
```json
{
  "cart": {
    "id": "cmngu98m3...",
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

**Response `200`:**
```json
{
  "message": "Item removed from cart"
}
```

---

### Clear Cart
`DELETE /api/cart`  
Protected. Role: `BUYER`

**Response `200`:**
```json
{
  "message": "Cart cleared"
}
```

---

### Validate Cart
`GET /api/cart/validate`  
Protected. Role: `BUYER`  
Call this before checkout to check for issues (price changes, out of stock, inactive listings).

**Response `200` (no issues):**
```json
{
  "valid": true,
  "issues": [],
  "total": 500
}
```

**Response `200` (with issues):**
```json
{
  "valid": false,
  "issues": [
    {
      "listingId": "cmngu98m3...",
      "title": "Fresh Tomatoes",
      "issue": "Only 5 KG available, you requested 10"
    }
  ],
  "total": 0
}
```

> Always validate cart before showing the checkout button. If `valid` is false, show the issues to the user before allowing checkout.

---

## Orders

### Place Order (Checkout)
`POST /api/orders`  
Protected. Role: `BUYER`  
Email must be verified.  
Places an order for all items currently in cart. Cart is cleared automatically after successful order.

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
    "id": "cmngu98m3...",
    "totalPrice": "600",
    "paymentMethod": "CASH",
    "status": "PENDING",
    "deliveryAddress": "Accra, Ghana",
    "items": [
      {
        "id": "...",
        "quantityOrdered": "10",
        "unitPriceAtOrder": "50",
        "totalPrice": "500",
        "listing": { "id": "...", "title": "Fresh Tomatoes", "unit": "KG" }
      }
    ],
    "buyer": { "id": "...", "fullName": "Ama Buyer", "email": "..." }
  }
}
```

---

### Get My Orders
`GET /api/orders`  
Protected. All roles.

- `BUYER` sees their placed orders
- `FARMER`/`AGENT` sees orders for their listings
- `ADMIN` sees all orders via `/api/admin/orders`

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

---

### Get Order by ID
`GET /api/orders/:id`  
Protected. Accessible by buyer, seller, assigned agent, or admin only.

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
| `BUYER` | `CANCELLED` (only if current status is `PENDING`) |

**Order lifecycle:**
```
PENDING → CONFIRMED → DISPATCHED → DELIVERED
                ↘ CANCELLED
```

> When an order is cancelled, stock is automatically restored to the listing.

---

## Barter

### Create Barter Request
`POST /api/barter`  
Protected.

**Body (buyer offering description):**
```json
{
  "targetListingId": "cmngu98m3...",
  "offeredDescription": "I have 20kg of fresh yam",
  "offeredQuantity": 20,
  "message": "I would like to exchange my yam for your tomatoes"
}
```

**Body (farmer-to-farmer offering a listing):**
```json
{
  "targetListingId": "cmngu98m3...",
  "offeredListingId": "cmngu98m3...",
  "message": "I want to exchange my maize for your tomatoes"
}
```

**Response `201`:**
```json
{
  "message": "Barter request sent",
  "barterRequest": {
    "id": "cmngu98m3...",
    "status": "PENDING",
    "offeredDescription": "I have 20kg of fresh yam",
    "offeredQuantity": "20",
    "message": "...",
    "requester": { "id": "...", "fullName": "Ama Buyer" },
    "targetListing": { "id": "...", "title": "Fresh Tomatoes" }
  }
}
```

---

### Get My Barter Requests
`GET /api/barter`  
Protected. Returns requests you sent AND requests for your listings.

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

| Role | Allowed statuses |
|------|---------|
| Listing owner (farmer) | `ACCEPTED`, `REJECTED` |
| Requester | `CANCELLED` |

**Response `200`:**
```json
{
  "message": "Barter request accepted",
  "barterRequest": {
    "status": "ACCEPTED",
    "agreedAt": "2026-03-16T19:57:41.305Z",
    ...
  }
}
```

---

### Upload Barter Images
`POST /api/barter/:id/images`  
Protected. Requester only. Upload images of the item being offered.

**Body:** `form-data`  
| Key | Type | Description |
|-----|------|-------------|
| `images` | File | Up to 3 images (jpg, jpeg, png, webp). Max 5MB each. |

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

> Redirect user to `paymentUrl` to complete payment on Paystack's secure page.  
> After payment, Paystack redirects to `https://agritechgh.me/payment/callback?reference=AGRI-xxx`.  
> Read the `reference` from the URL and call the verify endpoint.

---

### Verify Payment
`GET /api/payments/verify/:reference`  
Protected. Role: `BUYER`  
Call this after user returns from Paystack checkout page.

**Response `200`:**
```json
{
  "message": "Payment verified successfully",
  "status": "SUCCESS"
}
```

**Response `400` (payment failed):**
```json
{
  "message": "Payment failed",
  "status": "failed"
}
```

---

### Get Payment Status
`GET /api/payments/order/:orderId`  
Protected.

**Response `200`:**
```json
{
  "payment": {
    "id": "cmngu98m3...",
    "amount": "600",
    "currency": "GHS",
    "status": "SUCCESS",
    "method": "CASH",
    "paidAt": "2026-03-16T16:42:19.079Z",
    "paystackReference": "AGRI-..."
  }
}
```

---

### Paystack Webhook
`POST /api/payments/webhook`  
Public — Paystack only. **Do not call this from the frontend.**

---

## Agents

### Register as Agent
`POST /api/agents/register`  
Protected. Role: `AGENT`  
Creates an agent profile for an already-registered AGENT user.

**Body:**
```json
{
  "assignedRegion": "Greater Accra",
  "commissionRate": 5.0,
  "bio": "Experienced field agent covering Greater Accra"
}
```

---

### Get All Agents
`GET /api/agents`  
Protected.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `region` | string | Filter by region |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

---

### Get Agent by ID
`GET /api/agents/:id`  
Protected.

---

### Register Farmer (as Agent)
`POST /api/agents/register-farmer`  
Protected. Role: `AGENT`  
Agent registers a farmer on their behalf. Farmer is automatically pre-verified.

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

**Response `201`:**
```json
{
  "message": "Farmer registered successfully",
  "farmer": {
    "id": "cmngu98m3...",
    "fullName": "Yaw Farmer",
    "email": "yaw@example.com",
    "role": "FARMER",
    "isVerified": true
  }
}
```

---

### Get My Farmers
`GET /api/agents/my-farmers`  
Protected. Role: `AGENT`  
Returns all farmers managed by the logged-in agent including their listings.

---

### Get Agent Requests
`GET /api/agents/requests`  
Protected. Role: `AGENT`  
Returns pending farmer requests to be managed by this agent.

---

### Request an Agent (Farmer)
`POST /api/agents/:agentId/request`  
Protected. Role: `FARMER`  
Farmer sends a request to be managed by a specific agent.

**Response `201`:**
```json
{
  "message": "Agent request sent",
  "request": { ... }
}
```

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
  "agentId": "cmngu98m3..."
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
  "usersByRole": [
    { "role": "FARMER", "_count": { "role": 10 } },
    { "role": "BUYER", "_count": { "role": 35 } }
  ],
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
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

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

> Use `isActive: false` to disable/revoke a user's account.  
> Use `isActive: true` to re-enable a disabled account.  
> Use `role: "ADMIN"` to promote a user and transfer ownership.

---

### Delete User
`DELETE /api/admin/users/:id`

**Response `200`:**
```json
{
  "message": "User deleted successfully"
}
```

---

### Get All Orders
`GET /api/admin/orders`

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

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

> Use `parentId` to create a subcategory under an existing category.

---

### Get Categories (Admin)
`GET /api/admin/categories`  
Same as public `GET /api/categories` but accessible from admin panel.

---

### Update Category
`PUT /api/admin/categories/:id`

**Body (all optional):**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isActive": false
}
```

> Use `isActive: false` to hide a category from listings.

---

## Categories

### Get All Categories
`GET /api/categories`  
Public. Returns all active categories with their subcategories.

**Response `200`:**
```json
{
  "categories": [
    {
      "id": "cmngu98m3...",
      "name": "Vegetables",
      "description": "Fresh vegetables",
      "iconUrl": null,
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
| `FARMER` | Creates and manages listings, manages orders, can request an agent |
| `BUYER` | Browses listings, manages cart, places orders, initiates barter |
| `AGENT` | Registers and manages farmers, handles listings and orders on their behalf |
| `ADMIN` | Full system access — manages users, categories, and monitors all activity |

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — not allowed to perform this action |
| `404` | Not found |
| `409` | Conflict — resource already exists (e.g. email taken) |
| `429` | Too many requests — rate limited |
| `500` | Internal server error |

**Error response format:**
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

> All other roles: register via `POST /api/auth/register`

---

## Notes for Frontend

1. **Store `accessToken`** in memory or localStorage after login/register
2. **Send token** in every protected request: `Authorization: Bearer <accessToken>`
3. **Token expiry** — access token expires in 15 minutes. Call `POST /api/auth/refresh` when you get a `401` to get a new one. The refresh token is in an httpOnly cookie and is sent automatically.
4. **Base URL** — use `http://localhost:8000` for local development, `https://api.agritechgh.me` for production
5. **Validate cart** before showing checkout button — if `valid` is false, show issues to user
6. **Payment flow**:
   - Call `POST /api/payments/initialize`
   - Redirect user to `paymentUrl`
   - Paystack redirects to `/payment/callback?reference=AGRI-xxx`
   - Read `reference` from URL and call `GET /api/payments/verify/:reference`
   - Show success or failure to user
7. **Email verification** — check `isVerified` on the user object after login. Show a banner for unverified users. Listing creation and order placement are blocked until verified.
8. **Role-based UI** — check `user.role` after login to show the correct dashboard:
   - `FARMER` → listings dashboard
   - `BUYER` → marketplace/cart
   - `AGENT` → agent dashboard with farmer management
   - `ADMIN` → admin panel
9. **Profile photo** — `profilePhotoUrl` is returned on login. If `null`, show a default avatar.
10. **Delete account** — always confirm with password before calling the delete endpoint
11. **Email change flow** — on `/verify-email-change` page, read `token` and `email` from URL query params and POST to `POST /api/auth/confirm-email-change`
12. **Images** — all image URLs from Cloudinary are permanent and can be used directly in `<img>` tags