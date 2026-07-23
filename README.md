# HyperVenue — All-in-One Live Event Platform

Microservices-based ticketing, secure seat locking, and live venue food logistics platform.

## Architecture & Team Allocation
- **Gateway (Port 4000)**: Shared API Router & JWT Verification
- **Auth Service (Port 4001)**: Person A (PostgreSQL + Redis + JWT)
- **Booking Service (Port 4002)**: Person B (PostgreSQL + Redis + Stripe)
- **Food Service (Port 4003)**: Person C (MongoDB + Socket.io)
- **Client (Port 3000)**: React Single-Page App