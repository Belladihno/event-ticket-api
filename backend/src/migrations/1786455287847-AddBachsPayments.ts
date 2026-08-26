import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBachsPayments1786455287847 implements MigrationInterface {
    name = 'AddBachsPayments1786455287847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`processed_webhook_events\` (\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(255) NOT NULL, \`event_id\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, UNIQUE INDEX \`IDX_3370770d472af629203588a298\` (\`event_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`sections\` ADD \`bachs_product_id\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sections\` DROP COLUMN \`bachs_product_id\``);
        await queryRunner.query(`DROP INDEX \`IDX_3370770d472af629203588a298\` ON \`processed_webhook_events\``);
        await queryRunner.query(`DROP TABLE \`processed_webhook_events\``);
    }

}
