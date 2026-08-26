import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFavorites1786548020000 implements MigrationInterface {
    name = 'AddFavorites1786548020000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`favorites\` (\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(255) NOT NULL, \`user_id\` varchar(36) NULL, \`event_id\` varchar(36) NULL, UNIQUE INDEX \`IDX_favorites_user_event\` (\`user_id\`, \`event_id\`), INDEX \`IDX_favorites_user_created\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`favorites\` ADD CONSTRAINT \`FK_favorites_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`favorites\` ADD CONSTRAINT \`FK_favorites_event\` FOREIGN KEY (\`event_id\`) REFERENCES \`events\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`favorites\` DROP FOREIGN KEY \`FK_favorites_event\``);
        await queryRunner.query(`ALTER TABLE \`favorites\` DROP FOREIGN KEY \`FK_favorites_user\``);
        await queryRunner.query(`DROP INDEX \`IDX_favorites_user_created\` ON \`favorites\``);
        await queryRunner.query(`DROP INDEX \`IDX_favorites_user_event\` ON \`favorites\``);
        await queryRunner.query(`DROP TABLE \`favorites\``);
    }

}