import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePayoutRequests1786548041000 implements MigrationInterface {
    name = 'CreatePayoutRequests1786548041000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`payout_requests\` (\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`organizer_id\` varchar(36) NULL, \`bachs_account_id\` varchar(100) NOT NULL, \`amount\` decimal(12,2) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'pending', \`bachs_payout_id\` varchar(100) NULL, \`failure_reason\` text NULL, \`arrived_at\` datetime NULL, UNIQUE INDEX \`IDX_payout_requests_bachs_payout\` (\`bachs_payout_id\`), INDEX \`IDX_payout_requests_organizer\` (\`organizer_id\`), INDEX \`IDX_payout_requests_organizer_created\` (\`organizer_id\`, \`created_at\`), INDEX \`IDX_payout_requests_organizer_status\` (\`organizer_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`payout_requests\` ADD CONSTRAINT \`FK_payout_requests_organizer\` FOREIGN KEY (\`organizer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`payout_requests\` DROP FOREIGN KEY \`FK_payout_requests_organizer\``);
        await queryRunner.query(`DROP INDEX \`IDX_payout_requests_organizer_status\` ON \`payout_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_payout_requests_organizer_created\` ON \`payout_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_payout_requests_organizer\` ON \`payout_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_payout_requests_bachs_payout\` ON \`payout_requests\``);
        await queryRunner.query(`DROP TABLE \`payout_requests\``);
    }
}
