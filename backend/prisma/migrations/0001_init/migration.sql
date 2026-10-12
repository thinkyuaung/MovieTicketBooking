-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `director` VARCHAR(100) NOT NULL,
    `release_year` SMALLINT UNSIGNED NOT NULL,
    `duration_min` SMALLINT UNSIGNED NOT NULL,
    `age_rating` ENUM('G', 'PG', 'PG13', 'R') NOT NULL,
    `description` TEXT NULL,
    `poster_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `genres` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `genres_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movie_genres` (
    `movie_id` INTEGER NOT NULL,
    `genre_id` INTEGER NOT NULL,

    INDEX `movie_genres_genre_id_idx`(`genre_id`),
    PRIMARY KEY (`movie_id`, `genre_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `halls` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `layout_rows` TINYINT UNSIGNED NOT NULL,
    `layout_cols` TINYINT UNSIGNED NOT NULL,

    UNIQUE INDEX `halls_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `seats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hall_id` INTEGER NOT NULL,
    `label` VARCHAR(5) NOT NULL,
    `row_label` VARCHAR(2) NOT NULL,
    `number` TINYINT UNSIGNED NOT NULL,
    `grid_row` TINYINT UNSIGNED NOT NULL,
    `grid_col` TINYINT UNSIGNED NOT NULL,
    `width` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `type` ENUM('standard', 'vip', 'couple', 'wheelchair') NOT NULL DEFAULT 'standard',
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `seats_hall_id_label_key`(`hall_id`, `label`),
    UNIQUE INDEX `seats_hall_id_grid_row_grid_col_key`(`hall_id`, `grid_row`, `grid_col`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `showtimes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `movie_id` INTEGER NOT NULL,
    `hall_id` INTEGER NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `price_standard` INTEGER UNSIGNED NOT NULL,
    `price_vip` INTEGER UNSIGNED NOT NULL,
    `price_couple` INTEGER UNSIGNED NOT NULL,
    `full_hall_price` INTEGER UNSIGNED NULL,
    `status` ENUM('scheduled', 'cancelled') NOT NULL DEFAULT 'scheduled',

    INDEX `showtimes_movie_id_starts_at_idx`(`movie_id`, `starts_at`),
    INDEX `showtimes_hall_id_starts_at_idx`(`hall_id`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_code` VARCHAR(12) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `showtime_id` INTEGER NOT NULL,
    `total_price` INTEGER UNSIGNED NOT NULL,
    `is_full_hall` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelled_at` DATETIME(3) NULL,

    UNIQUE INDEX `bookings_booking_code_key`(`booking_code`),
    INDEX `bookings_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `bookings_showtime_id_idx`(`showtime_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_seats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NOT NULL,
    `seat_id` INTEGER NOT NULL,
    `showtime_id` INTEGER NULL,
    `price` INTEGER UNSIGNED NOT NULL,

    INDEX `booking_seats_booking_id_idx`(`booking_id`),
    INDEX `booking_seats_seat_id_idx`(`seat_id`),
    UNIQUE INDEX `booking_seats_showtime_id_seat_id_key`(`showtime_id`, `seat_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `movie_id` INTEGER NOT NULL,
    `score` TINYINT UNSIGNED NOT NULL,
    `comment` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reviews_movie_id_created_at_idx`(`movie_id`, `created_at`),
    UNIQUE INDEX `reviews_user_id_movie_id_key`(`user_id`, `movie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `movie_genres` ADD CONSTRAINT `movie_genres_movie_id_fkey` FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movie_genres` ADD CONSTRAINT `movie_genres_genre_id_fkey` FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seats` ADD CONSTRAINT `seats_hall_id_fkey` FOREIGN KEY (`hall_id`) REFERENCES `halls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `showtimes` ADD CONSTRAINT `showtimes_movie_id_fkey` FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `showtimes` ADD CONSTRAINT `showtimes_hall_id_fkey` FOREIGN KEY (`hall_id`) REFERENCES `halls`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_showtime_id_fkey` FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_seats` ADD CONSTRAINT `booking_seats_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_seats` ADD CONSTRAINT `booking_seats_seat_id_fkey` FOREIGN KEY (`seat_id`) REFERENCES `seats`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_seats` ADD CONSTRAINT `booking_seats_showtime_id_fkey` FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_movie_id_fkey` FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

