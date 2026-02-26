"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting device authentication data migration...\n');
    const totalUsers = await prisma.user.count();
    console.log(`Total users in database: ${totalUsers}`);
    const facebookUsers = await prisma.user.count({
        where: { facebookId: { not: null } },
    });
    const deviceUsers = await prisma.user.count({
        where: { deviceId: { not: null } },
    });
    const adminUsers = await prisma.user.count({
        where: { role: 'ADMIN' },
    });
    console.log(`Facebook-linked users: ${facebookUsers}`);
    console.log(`Device-based users: ${deviceUsers}`);
    console.log(`Admin users: ${adminUsers}`);
    const adminsWithoutFacebookId = await prisma.user.count({
        where: {
            role: 'ADMIN',
            facebookId: null,
        },
    });
    if (adminsWithoutFacebookId > 0) {
        console.log(`\nWarning: ${adminsWithoutFacebookId} admin user(s) have no facebookId.`);
        console.log('This is expected if admin was created with device auth.');
        console.log('Admin login still works via username/password.');
    }
    const totalPurchases = await prisma.moviePurchase.count();
    const totalPayments = await prisma.payment.count();
    const paidPayments = await prisma.payment.count({
        where: { status: 'PAID' },
    });
    console.log(`\nTotal movie purchases: ${totalPurchases}`);
    console.log(`Total payments: ${totalPayments}`);
    console.log(`Paid payments: ${paidPayments}`);
    const orphanedPurchases = await prisma.$queryRaw `
    SELECT COUNT(*) as count FROM movie_purchases mp
    LEFT JOIN users u ON mp."userId" = u.id
    WHERE u.id IS NULL
  `;
    const orphanedCount = Number(orphanedPurchases[0]?.count || 0);
    if (orphanedCount > 0) {
        console.log(`\nWarning: Found ${orphanedCount} orphaned purchases.`);
        console.log('These purchases have no associated user.');
    }
    console.log('\n=== Migration Summary ===');
    console.log('The schema has been updated to support device-based authentication.');
    console.log('');
    console.log('Changes:');
    console.log('  - facebookId is now nullable (existing users unchanged)');
    console.log('  - deviceId column added (null for existing users)');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Deploy backend with DeviceAuthGuard');
    console.log('  2. Deploy frontend with device ID generation');
    console.log('  3. New users will be created with deviceId only');
    console.log('  4. Facebook login can be re-enabled later without migration');
    console.log('');
    console.log('Migration complete! No data was modified.');
}
main()
    .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=migrate-to-device-auth.js.map