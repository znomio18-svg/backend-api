"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const admin = await prisma.user.upsert({
        where: { facebookId: 'admin-seed' },
        update: {},
        create: {
            facebookId: 'admin-seed',
            name: 'Admin User',
            email: 'admin@1MinDrama.mn',
            role: client_1.UserRole.ADMIN,
        },
    });
    console.log('Created admin user:', admin);
    const movies = [
        {
            title: 'The Last Adventure',
            description: 'An epic journey through uncharted territories.',
            thumbnailUrl: 'https://picsum.photos/seed/movie1/400/600',
            videoId: 'sample-video-id-1',
            duration: 7200,
            releaseYear: 2024,
            isFeatured: true,
            isPublished: true,
        },
        {
            title: 'Love in the City',
            description: 'A heartwarming romantic comedy set in Ulaanbaatar.',
            thumbnailUrl: 'https://picsum.photos/seed/movie2/400/600',
            videoId: 'sample-video-id-2',
            duration: 6600,
            releaseYear: 2024,
            isFeatured: true,
            isPublished: true,
        },
        {
            title: 'The Dark Mystery',
            description: 'A thrilling mystery that will keep you on the edge of your seat.',
            thumbnailUrl: 'https://picsum.photos/seed/movie3/400/600',
            videoId: 'sample-video-id-3',
            duration: 7800,
            releaseYear: 2023,
            isFeatured: false,
            isPublished: true,
        },
        {
            title: 'Genghis: The Beginning',
            description: 'Historical epic about the rise of the Mongol Empire.',
            thumbnailUrl: 'https://picsum.photos/seed/movie4/400/600',
            videoId: 'sample-video-id-4',
            duration: 9000,
            releaseYear: 2024,
            isFeatured: true,
            isPublished: true,
        },
        {
            title: 'Space Nomads',
            description: 'A sci-fi adventure in the far reaches of the galaxy.',
            thumbnailUrl: 'https://picsum.photos/seed/movie5/400/600',
            videoId: 'sample-video-id-5',
            duration: 8400,
            releaseYear: 2024,
            isFeatured: false,
            isPublished: true,
        },
    ];
    for (const movie of movies) {
        const created = await prisma.movie.upsert({
            where: { id: movie.videoId },
            update: movie,
            create: movie,
        });
        console.log('Created movie:', created.title);
    }
    const plans = [
        {
            name: 'Сарын эрх',
            nameEn: 'Monthly',
            description: '30 хоногийн бүх кино үзэх эрх',
            price: 9900,
            durationDays: 30,
        },
        {
            name: 'Жилийн эрх',
            nameEn: 'Yearly',
            description: '365 хоногийн бүх кино үзэх эрх',
            price: 99000,
            durationDays: 365,
        },
    ];
    for (const plan of plans) {
        const created = await prisma.subscriptionPlan.upsert({
            where: { id: plan.nameEn?.toLowerCase() || plan.name },
            update: plan,
            create: plan,
        });
        console.log('Created subscription plan:', created.name);
    }
    console.log('Seed completed!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map