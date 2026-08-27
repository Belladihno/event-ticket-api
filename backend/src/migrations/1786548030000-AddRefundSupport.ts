import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefundSupport1786548030000 implements MigrationInterface {
    name = 'AddRefundSupport1786548030000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // payments.status: add 'refunded'
        await queryRunner.query(`ALTER TABLE \`payments\` MODIFY COLUMN \`status\` ENUM('pending','successful','failed','refunded') NOT NULL DEFAULT 'pending'`);
        // reservations.status: add 'refunded'
        await queryRunner.query(`ALTER TABLE \`reservations\` MODIFY COLUMN \`status\` ENUM('pending','expired','confirmed','refunded') NOT NULL DEFAULT 'pending'`);
        // tickets: add refund columns
        await queryRunner.query(`ALTER TABLE \`tickets\` ADD COLUMN \`is_refunded\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`tickets\` ADD COLUMN \`refunded_at\` datetime NULL`);
        // notifications.type: add 'refund_issued'
        await queryRunner.query(`ALTER TABLE \`notifications\` MODIFY COLUMN \`type\` ENUM('booking_confirmation','event_reminder','payment_failed','refund_issued') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notifications\` MODIFY COLUMN \`type\` ENUM('booking_confirmation','event_reminder','payment_failed') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`tickets\` DROP COLUMN \`refunded_at\``);
        await queryRunner.query(`ALTER TABLE \`tickets\` DROP COLUMN \`is_refunded\``);
        await queryRunner.query(`ALTER TABLE \`reservations\` MODIFY COLUMN \`status\` ENUM('pending','expired','confirmed') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE \`payments\` MODIFY COLUMN \`status\` ENUM('pending','successful','failed') NOT NULL DEFAULT 'pending'`);
    }

}
