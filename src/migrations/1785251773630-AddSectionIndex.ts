import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSectionIndex1785251773630 implements MigrationInterface {
    name = 'AddSectionIndex1785251773630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_6815e0e95397dfbb0a5fd270b2\` ON \`sections\` (\`event_id\`, \`name\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_6815e0e95397dfbb0a5fd270b2\` ON \`sections\``);
    }

}
