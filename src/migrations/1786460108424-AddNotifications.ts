import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotifications1786460108424 implements MigrationInterface {
    name = 'AddNotifications1786460108424'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP COLUMN \`channel\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD \`sent_at\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD \`error_message\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP COLUMN \`type\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD \`type\` enum ('booking_confirmation', 'event_reminder', 'payment_failed') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`notifications\` CHANGE \`status\` \`status\` enum ('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued'`);
        await queryRunner.query(`CREATE INDEX \`IDX_310667f935698fcd8cb319113a\` ON \`notifications\` (\`user_id\`, \`created_at\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_310667f935698fcd8cb319113a\` ON \`notifications\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` CHANGE \`status\` \`status\` enum ('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP COLUMN \`type\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD \`type\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP COLUMN \`error_message\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP COLUMN \`sent_at\``);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD \`channel\` varchar(255) NOT NULL`);
    }

}
