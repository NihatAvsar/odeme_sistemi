-- CreateTable
CREATE TABLE `order_requests` (
    `id` VARCHAR(191) NOT NULL,
    `restaurantId` VARCHAR(191) NOT NULL,
    `tableSessionId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `requestedBy` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `note` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `rejectedBy` VARCHAR(191) NULL,
    `rejectedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `order_requests_restaurantId_status_createdAt_idx`(`restaurantId`, `status`, `createdAt`),
    INDEX `order_requests_tableSessionId_status_idx`(`tableSessionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_requests` ADD CONSTRAINT `order_requests_restaurantId_fkey` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_requests` ADD CONSTRAINT `order_requests_tableSessionId_fkey` FOREIGN KEY (`tableSessionId`) REFERENCES `table_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_requests` ADD CONSTRAINT `order_requests_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
