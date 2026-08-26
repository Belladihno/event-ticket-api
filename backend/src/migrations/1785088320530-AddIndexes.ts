import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1785088320530 implements MigrationInterface {
    name = 'AddIndexes1785088320530'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_5c87ad65d48a29c53afa3f9acd\` ON \`venues\` (\`created_at\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_22b517b56b453ab99a8fa1771d\` ON \`events\` (\`organizer_id\`, \`created_at\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_a1a990a89c0cbe6cf4661a6208\` ON \`events\` (\`status\`, \`start_time\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_a1a990a89c0cbe6cf4661a6208\` ON \`events\``);
        await queryRunner.query(`DROP INDEX \`IDX_22b517b56b453ab99a8fa1771d\` ON \`events\``);
        await queryRunner.query(`DROP INDEX \`IDX_5c87ad65d48a29c53afa3f9acd\` ON \`venues\``);
    }

}
