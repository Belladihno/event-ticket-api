import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizerAccounts1786548040000 implements MigrationInterface {
    name = 'CreateOrganizerAccounts1786548040000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`organizer_accounts\` (\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`organizer_id\` varchar(36) NULL, \`bachs_account_id\` varchar(100) NOT NULL, \`payouts_enabled\` tinyint NOT NULL DEFAULT 0, \`details_submitted\` tinyint NOT NULL DEFAULT 0, \`bank_account_last4\` varchar(4) NULL, \`bank_name\` varchar(100) NULL, \`payouts_enabled_at\` datetime NULL, UNIQUE INDEX \`IDX_organizer_accounts_bachs\` (\`bachs_account_id\`), UNIQUE INDEX \`IDX_organizer_accounts_organizer\` (\`organizer_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`organizer_accounts\` ADD CONSTRAINT \`FK_organizer_accounts_organizer\` FOREIGN KEY (\`organizer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`organizer_accounts\` DROP FOREIGN KEY \`FK_organizer_accounts_organizer\``);
        await queryRunner.query(`DROP INDEX \`IDX_organizer_accounts_organizer\` ON \`organizer_accounts\``);
        await queryRunner.query(`DROP INDEX \`IDX_organizer_accounts_bachs\` ON \`organizer_accounts\``);
        await queryRunner.query(`DROP TABLE \`organizer_accounts\``);
    }
}
