# movieTicket — ER Diagram

Database: **MySQL 8**, schema name `movieTicket`. All prices are whole kyat (MMK) stored as `INT UNSIGNED`.

Project layout: `backend/` (Express + TypeScript + Prisma) and `frontend/` (React + Vite + TypeScript).

```mermaid
erDiagram
    users ||--o{ bookings : makes
    users ||--o{ reviews : writes
    movies ||--o{ reviews : receives
    movies ||--o{ showtimes : "is shown in"
    movies ||--o{ movie_genres : has
    genres ||--o{ movie_genres : groups
    halls ||--o{ seats : contains
    halls ||--o{ showtimes : hosts
    showtimes ||--o{ bookings : has
    showtimes |o--o{ booking_seats : "locks (active only)"
    bookings ||--|{ booking_seats : includes
    seats ||--o{ booking_seats : "booked as"

    users {
        int id PK
        varchar name
        varchar email UK
        varchar phone
        varchar password_hash
        enum role "user | admin"
        datetime created_at
    }
    movies {
        int id PK
        varchar title
        varchar director
        smallint release_year
        smallint duration_min
        enum age_rating "G | PG | PG13 | R"
        text description
        varchar poster_url
        datetime created_at
    }
    genres {
        int id PK
        varchar name UK
    }
    movie_genres {
        int movie_id PK, FK
        int genre_id PK, FK
    }
    halls {
        int id PK
        varchar name UK
        tinyint layout_rows
        tinyint layout_cols
    }
    seats {
        int id PK
        int hall_id FK
        varchar label "A1, unique per hall"
        char row_label "A"
        tinyint number "1"
        tinyint grid_row
        tinyint grid_col
        tinyint width "1, or 2 for couple"
        enum type "standard | vip | couple | wheelchair"
        boolean is_active
    }
    showtimes {
        int id PK
        int movie_id FK
        int hall_id FK
        datetime starts_at
        datetime ends_at
        int price_standard "MMK"
        int price_vip "MMK"
        int price_couple "MMK"
        int full_hall_price "MMK, nullable"
        enum status "scheduled | cancelled"
    }
    bookings {
        int id PK
        varchar booking_code UK
        int user_id FK
        int showtime_id FK
        int total_price "MMK"
        boolean is_full_hall
        enum status "confirmed | cancelled"
        datetime created_at
        datetime cancelled_at
    }
    booking_seats {
        int id PK
        int booking_id FK
        int seat_id FK
        int showtime_id FK "NULL after cancel"
        int price "MMK"
    }
    reviews {
        int id PK
        int user_id FK
        int movie_id FK
        tinyint score "1-10"
        text comment
        datetime created_at
    }
```

## Unique constraints

| Table | Unique on | Why |
|---|---|---|
| `users` | `email` | One account per email |
| `seats` | `(hall_id, label)` | No two seats called "A1" in one hall |
| `seats` | `(hall_id, grid_row, grid_col)` | No two seats in the same spot on the plan |
| `booking_seats` | `(showtime_id, seat_id)` | **A seat can't be booked twice for the same showing** |
| `reviews` | `(user_id, movie_id)` | One review per user per movie |
| `movie_genres` | `(movie_id, genre_id)` | Primary key |

When a booking is cancelled, its `booking_seats.showtime_id` is set to `NULL`. MySQL allows many `NULL`s in a unique index, so the seat becomes free again while the row stays as history.

## Indexes

- `showtimes (movie_id, starts_at)`: upcoming showtimes for a movie
- `showtimes (hall_id, starts_at)`: hall schedule and overlap checks
- `bookings (user_id, created_at)`: "My bookings"
- `reviews (movie_id, created_at)`: newest reviews for a movie

## Rules checked by the backend (not the database)

- **Whole-hall booking:** the show starts at least 7 days from now **and** the showing has no confirmed bookings. Checked inside a transaction with `SELECT … FROM showtimes WHERE id = ? FOR UPDATE`.
- Every booked seat belongs to the showtime's hall and has `is_active = true`.
- Normal bookings: 1 to 10 seats.
- Showtimes in the same hall must not overlap (`starts_at` / `ends_at`).
- Seat price comes from the showtime by seat type: `standard` and `wheelchair` use `price_standard`; `vip` uses `price_vip`; `couple` uses `price_couple` (one price for the pair).
