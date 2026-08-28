import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentConnectFields1786548042000 implements MigrationInterface {
    name = 'AddPaymentConnectFields1786548042000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`bachs_connect_account_id\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`platform_fee_amount\` decimal(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`bachs_refund_id\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`refund_status\` varchar(255) NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`refunded_at\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`bachs_session_id\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`bachs_checkout_url\` varchar(500) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`event_title\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`promo_link_id\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN \`event_id\` varchar(36) NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_payments_bachs_session\` ON \`payments\` (\`bachs_session_id\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_payments_promo_link\` ON \`payments\` (\`promo_link_id\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_payments_event\` ON \`payments\` (\`event_id\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_payments_event_status\` ON \`payments\` (\`event_id\`, \`status\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_payments_event_status\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`IDX_payments_event\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`IDX_payments_promo_link\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`IDX_payments_bachs_session\` ON \`payments\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`event_id\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`promo_link_id\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`event_title\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`bachs_checkout_url\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`bachs_session_id\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`refunded_at\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`refund_status\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`bachs_refund_id\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`platform_fee_amount\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`bachs_connect_account_id\``);
    }
}
