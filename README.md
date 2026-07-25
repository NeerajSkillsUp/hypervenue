# HyperVenue — All-in-One Live Event Platform

Microservices-based ticketing, secure seat locking, and live venue food logistics platform.

## Architecture & Team Allocation
- **Gateway (Port 4000)**: Shared API Router & JWT Verification
- **Auth Service (Port 4001)**: Person A (PostgreSQL + Redis + JWT)
- **Booking Service (Port 4002)**: Person B (PostgreSQL + Redis + Stripe)
- **Food Service (Port 4003)**: Person C (MongoDB + Socket.io)
- **Client (Port 3000)**: React Single-Page App

## Usage Example
- suppose i want to watch IND vs PAK in a stadium, the first thing i will do is search for an app/website to book tickets right! 
- then i will find HyperVenue and then i will register/login! 
- then i will see all the seats with their numbers and the status : booked/available!  
- then i will try booking some available seat  and finally pay for it 
- then a Unique QR code will be generated for my booked ticket for the seat 
- then i will reach the stadium on the match time and scan it to enter 
- finally i will sit on my seat and watch
- suppose i am hungry after 30 minutes, definitely i will try to go to some vendor out there and will miss that part of the match/event 
- this problem will be solved by HyperVenue 
- suppose a vendor has a dashboard and has listed food menu on our app/web  
- then i will add items to cart, pay for the cart, ordering  food at my seat through HyperVenue 
- a runner working for the vendor will be delivering the food just like swiggy delivery at exact seat number
- this way i won't be skipping anything (for which i paid far more than the food) 