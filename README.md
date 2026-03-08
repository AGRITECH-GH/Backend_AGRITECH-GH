# AgriTech GH — Backend API

Base URL (local): `http://localhost:8000`
## Auth Endpoints

### Register
`POST /api/auth/register`
```json
{
  "fullName": "",
  "email": "",
  "password": "",
  "role": "FARMER"
}
```

### Login
`POST /api/auth/login`
```json
{
  "email": "",
  "password": "",
  "rememberMe": false
}
```

### Verify Email
`POST /api/auth/verify-email`
```json
{
  "token": ""
}
```

### Resend Verification
`POST /api/auth/resend-verification`
```json
{
  "email": ""
}
```

### Refresh Token
`POST /api/auth/refresh`
No body — uses httpOnly cookie

### Logout
`POST /api/auth/logout`
No body
