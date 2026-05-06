-- AlterTable
ALTER TABLE `menu_items` ADD COLUMN `isOutOfStock` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updatedBy` VARCHAR(191) NULL;
