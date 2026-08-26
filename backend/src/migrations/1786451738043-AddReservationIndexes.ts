import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservationIndexes1786451738043 implements MigrationInterface {
    name = 'AddReservationIndexes1786451738043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_ea9ecedd029b9d302218892058\` ON \`reservations\` (\`status\`, \`expires_at\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_8a3b7f9fd855a1205b97c2453e\` ON \`reservations\` (\`user_id\`, \`created_at\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_8a3b7f9fd855a1205b97c2453e\` ON \`reservations\``);
        await queryRunner.query(`DROP INDEX \`IDX_ea9ecedd029b9d302218892058\` ON \`reservations\``);
    }

}
