import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventSearchIndexes1786548017134 implements MigrationInterface {
    name = 'AddEventSearchIndexes1786548017134'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_venues_city\` ON \`venues\` (\`city\`)`);
        await queryRunner.query(`CREATE FULLTEXT INDEX \`IDX_events_title_description\` ON \`events\` (\`title\`, \`description\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_events_title_description\` ON \`events\``);
        await queryRunner.query(`DROP INDEX \`IDX_venues_city\` ON \`venues\``);
    }

}